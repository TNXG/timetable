import type { EduHttp, EduPlugin, School } from "../domain/edu/plugin";
import type { ZfKb, ZfTerm } from "../domain/edu/zhengfang";
import type { NormalizedCourse, RuleOutput } from "../domain/importer";
import type { RuleManifest } from "../domain/rules";
import type { EduBgNav } from "./edu-browser";
/** 教务自动更新：优先使用学校 Profile 的 Cookie；Cookie 失效时用 Android Keystore 凭据静默重建会话。每天最多自动检查一次。 */
import { useSyncExternalStore } from "react";
import { captchaAnswer } from "../domain/edu/captcha";
import { EDU_PLUGINS } from "../domain/edu/plugin";
import { detectSystem, isTimetablePage, scrubUrl } from "../domain/edu/systems";
import { parseZfKbList, termLabel } from "../domain/edu/zhengfang";
import { normalize } from "../domain/importer";
import { parseHtml } from "../domain/importers/html";
import { uid } from "../domain/store";
import { CAPTCHA_OCR_VIEWS, edu, eduCredentials, eduOcr, eduProfile, nativeEdu } from "./edu-browser";

import { extendGrid, semesterEnded } from "./semester";
import { store } from "./store";

export const EDU_RULE: RuleManifest = { id: "builtin-edu", name: "教务系统", version: "1.0", input: "json", createdAt: 0, updatedAt: 0 };

export type EduSyncResult = "ok" | "nochange" | "expired" | "error";

/** 导入时记下的抓取来源：学校、当时所在的课表页、正方选的学期 */
export interface EduSyncSource {
  school: School;
  pageUrl: string;
  term?: ZfTerm;
}

export interface EduSync extends EduSyncSource {
  enabled: boolean;
  lastAt: number;
  lastResult: EduSyncResult | "";
  lastChanges: number;
  /** 最近一次更新失败的原因；成功或重新绑定后清除。 */
  lastMessage?: string;
  failStreak: number;
}

export interface SyncOutcome {
  result: EduSyncResult;
  changes: number;
  message?: string;
  /** 连续失效自动关闭时的提示 */
  note?: string;
}

const KEY = "tt.edu.sync";
const PAGE_TIMEOUT = 45_000;
const RESUME_GAP = 24 * 3600_000;
/** 连续失效几次后自动关闭 */
const MAX_EXPIRED = 3;

let cur: EduSync | null | undefined;
const subs = new Set<() => void>();

function load(): EduSync | null {
  if (cur !== undefined)
    return cur;
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<EduSync>) : null;
    cur = v && v.school && typeof v.pageUrl === "string"
      ? {
          school: v.school,
          pageUrl: v.pageUrl,
          term: v.term,
          enabled: !!v.enabled,
          lastAt: typeof v.lastAt === "number" ? v.lastAt : 0,
          lastResult: v.lastResult ?? "",
          lastChanges: typeof v.lastChanges === "number" ? v.lastChanges : 0,
          lastMessage: typeof v.lastMessage === "string" ? v.lastMessage : undefined,
          failStreak: typeof v.failStreak === "number" ? v.failStreak : 0,
        }
      : null;
  } catch {
    cur = null;
  }
  return cur;
}

function save(v: EduSync | null) {
  cur = v;
  try {
    if (v)
      localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* 存不下也不影响本次 */
  }
  for (const fn of subs) fn();
}

export const getEduSync = (): EduSync | null => load();

export function useEduSync(): EduSync | null {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    load,
  );
}

/** 导入完成时记下绑定并按开关定自动更新；同校重新导入保留上次更新状态，失效计数清零 */
export function bindEduSync(src: EduSyncSource, enabled: boolean) {
  const prev = load();
  const same = prev && eduProfile(prev.school.url) === eduProfile(src.school.url);
  save({
    ...src,
    enabled,
    lastAt: same ? prev.lastAt : 0,
    lastResult: same && prev.lastResult !== "expired" ? prev.lastResult : "",
    lastChanges: same ? prev.lastChanges : 0,
    lastMessage: same && prev.lastResult !== "expired" ? prev.lastMessage : undefined,
    failStreak: 0,
  });
}

/** 重新认证成功后恢复当前绑定，不创建新的账号记录。 */
export function restoreEduSync() {
  const s = load();
  if (!s)
    return;
  save({ ...s, lastAt: 0, lastResult: "", lastChanges: 0, lastMessage: undefined, failStreak: 0 });
}

export function setEduSyncEnabled(on: boolean) {
  const s = load();
  if (!s)
    return;
  save({ ...s, enabled: on, failStreak: on ? 0 : s.failStreak });
}

/** 退出登录：先阻止同步写回和重建 Cookie，等在途请求结束后清除会话与凭据。 */
export async function logoutEduSync(): Promise<void> {
  if (logoutTask)
    return logoutTask;
  logoutTask = clearEduSession().finally(() => {
    logoutTask = null;
  });
  return logoutTask;
}

let logoutTask: Promise<void> | null = null;

async function clearEduSession(): Promise<void> {
  const s = load();
  loggingOut = true;
  sessionVersion++;
  save(null);
  cancelPage?.();
  try {
    if (running)
      await running;
  } finally {
    let profileError: unknown;
    try {
      if (s && !await edu.clearProfile(s.school.url))
        throw new Error("学校会话未能彻底删除");
    } catch (e) {
      profileError = e;
    }
    let cleared = false;
    try {
      cleared = await eduCredentials.clear();
    } finally {
      loggingOut = false;
    }
    if (!cleared && nativeEdu())
      throw new Error("保存的教务凭据未能删除");
    if (profileError)
      throw profileError;
  }
}

/** 内置浏览器正在前台时不做后台抓取 */
let browserOpen = false;
export const setEduBrowserOpen = (v: boolean) => {
  browserOpen = v;
};
let sessionVersion = 0;
let loggingOut = false;
let cancelPage: (() => void) | null = null;

const aborted = (): SyncOutcome => ({ result: "error", changes: 0, message: "已退出登录" });

function waitPage(): Promise<EduBgNav> {
  const { promise, resolve, reject } = Promise.withResolvers<EduBgNav>();
  let last: EduBgNav | null = null;
  let settle = 0;
  let off = () => {};
  const timer = window.setTimeout(() => {
    off();
    window.clearTimeout(settle);
    cancelPage = null;
    reject(new Error("页面没有响应"));
  }, PAGE_TIMEOUT);
  const done = () => {
    window.clearTimeout(timer);
    off();
    cancelPage = null;
    if (last)
      resolve(last);
    else reject(new Error("页面没有响应"));
  };
  cancelPage = () => {
    window.clearTimeout(settle);
    window.clearTimeout(timer);
    off();
    cancelPage = null;
    resolve({ url: "", title: "", error: "已退出登录" });
  };
  /* 登录页常带跳转：等主文档稳定（800ms 内没有新的完成事件）再判定 */
  off = edu.onBgNav((e) => {
    window.clearTimeout(settle);
    last = e;
    settle = window.setTimeout(done, 800);
  });
  return promise;
}

/** 和当前课表相比会变的处数：新增、消失、恢复、排课变化、老师变化（用户改过的课不算） */
export function countChanges(incoming: NormalizedCourse[]): number {
  const diff = store.previewImport(incoming);
  return diff.added.length + diff.removed.length + diff.changed.length;
}

type Renewal = { renewed: true } | { renewed: false; message: string; expired: boolean };

async function renewSession(s: EduSync, version: number): Promise<Renewal> {
  const plugin: EduPlugin | undefined = EDU_PLUGINS.find(p => p.url === s.school.url);
  if (plugin?.auth.kind !== "login")
    return { renewed: false, message: "该学校不支持静默登录，请手动重新登录", expired: true };
  const credentials = await eduCredentials.load();
  if (version !== sessionVersion)
    return { renewed: false, message: "已退出登录", expired: false };
  if (!credentials)
    return { renewed: false, message: "登录已失效，未保存账号密码", expired: true };
  const http: EduHttp = req => edu.http(req);
  const profile = eduProfile(s.school.url);
  for (let round = 0; round < 3; round++) {
    const begin = await plugin.auth.flow.begin(http, url => edu.getCookies(profile, url));
    if (version !== sessionVersion)
      return { renewed: false, message: "已退出登录", expired: false };
    let captcha = "";
    if (begin.kind === "ready") {
      if (version !== sessionVersion)
        return { renewed: false, message: "已退出登录", expired: false };
      if (!await edu.replaceCookies(profile, begin.jars))
        throw new Error("教务会话 Cookie 保存失败");
      return { renewed: true };
    }
    if (begin.captcha) {
      for (let view = 0; view < CAPTCHA_OCR_VIEWS; view++) {
        captcha = captchaAnswer(await eduOcr.recognize(begin.captcha, view).then(r => r.text, () => "")) ?? "";
        if (captcha)
          break;
      }
      if (!captcha)
        continue;
    }
    if (version !== sessionVersion)
      return { renewed: false, message: "已退出登录", expired: false };
    const result = await plugin.auth.flow.login(http, { ...credentials, captcha });
    if (version !== sessionVersion)
      return { renewed: false, message: "已退出登录", expired: false };
    if (result.kind === "ok") {
      if (version !== sessionVersion)
        return { renewed: false, message: "已退出登录", expired: false };
      if (!await edu.replaceCookies(profile, result.jars))
        throw new Error("教务会话 Cookie 保存失败");
      return { renewed: true };
    }
    if (!result.captcha)
      return { renewed: false, message: result.message, expired: true };
  }
  return { renewed: false, message: "验证码识别失败，无法自动登录", expired: false };
}

/** 只有学校抓取脚本或登录页明确标出的失效才触发重登；其他 HTTP/解析失败不重试密码。 */
const looksExpired = (e: unknown) => e instanceof Error && /登录已失效/.test(e.message);

function finish(s: EduSync, result: EduSyncResult, message?: string, changes = 0): SyncOutcome {
  const failStreak = result === "expired" ? s.failStreak + 1 : result === "error" ? s.failStreak : 0;
  let enabled = s.enabled;
  let note: string | undefined;
  if (failStreak >= MAX_EXPIRED && enabled) {
    enabled = false;
    note = "登录已失效，已关闭自动更新";
  }
  save({ ...s, enabled, lastAt: Date.now(), lastResult: result, lastChanges: changes, lastMessage: result === "error" || result === "expired" ? message || (result === "expired" ? "登录已失效" : "未知错误") : undefined, failStreak });
  return { result, changes, message, note };
}

async function doSync(): Promise<SyncOutcome> {
  const s = load();
  if (!s || loggingOut)
    return { result: "error", changes: 0, message: "未开启自动更新" };
  const version = sessionVersion;
  if (!nativeEdu())
    return finish(s, "error", "仅在应用内可用");
  if (browserOpen)
    return finish(s, "error", "浏览器打开中");
  const sem = store.state.semester;
  if (!sem || semesterEnded(sem))
    return finish(s, "error", "学期已结束");
  const t0 = performance.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const page = waitPage();
      // school.url 是 CAS 入口；pageUrl 是 JW 课表页，两者必须共用同一个学校 Profile。
      try {
        await edu.bgOpen(s.pageUrl, s.school.url);
      } catch (e) {
        cancelPage?.();
        void page.catch(() => {});
        throw e;
      }
      const nav = await page;
      if (version !== sessionVersion)
        return aborted();
      if (nav.error)
        throw new Error(`页面打不开：${nav.error}`);
      const sys = detectSystem(nav.url, s.school.system);
      if (!isTimetablePage(sys, nav.url, nav.title))
        throw new Error(`${/\/(?:cas\/login|[^/]*login[^/]*\.(?:html?|jsp|aspx?))(?:[/?#]|$)/i.test(nav.url) ? "登录已失效" : "未进入课表页"}：跳转到了 ${scrubUrl(nav.url)}`);

      let out: RuleOutput;
      if (sys === "zhengfang_new" && s.term) {
        const list: ZfKb[] = await edu.bgZfFetch(s.term.xnm, s.term.xqm);
        out = { ...parseZfKbList(list), semester: { name: termLabel(s.term) } };
      } else {
        out = parseHtml(await edu.bgPageHtml(), { mode: "grid" });
      }
      if (version !== sessionVersion)
        return aborted();
      if (out.courses.length === 0)
        throw new Error("没有解析出课程");

      const need = Math.min(20, Math.max(0, ...out.courses.map(c => c.endPeriod)));
      const target = need > sem.timeGrid.length ? { ...sem, timeGrid: extendGrid(sem.timeGrid, need) } : sem;
      const pending = normalize(out, target);
      const changes = countChanges(pending.courses);
      if (changes === 0)
        return finish(s, "nochange");
      if (target !== sem)
        store.setSemester(target);
      store.applyImport(pending.courses, {
        id: uid(),
        semesterId: target.id,
        ruleId: EDU_RULE.id,
        ruleName: EDU_RULE.name,
        ruleVersion: EDU_RULE.version,
        at: Date.now(),
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        failed: pending.diagnostics.filter(d => d.level === "error").length,
        diagnostics: pending.diagnostics,
      });
      return finish(s, "ok", undefined, changes);
    } catch (e) {
      if (version !== sessionVersion)
        return aborted();
      const message = e instanceof Error ? e.message : String(e);
      if (!looksExpired(e))
        return finish(s, "error", message);
      if (attempt === 1)
        return finish(s, "expired", message);
      // 关闭旧 WebView 以释放 Profile；续登用 CAS+教务会话，成功后仅重试一次抓取。
      await edu.bgClose().catch(() => {});
      try {
        const renewal = await renewSession(s, version);
        if (version !== sessionVersion)
          return aborted();
        if (!renewal.renewed)
          return finish(s, renewal.expired ? "expired" : "error", renewal.message);
      } catch (renewError) {
        if (version !== sessionVersion)
          return aborted();
        return finish(s, "error", renewError instanceof Error ? renewError.message : String(renewError));
      }
    } finally {
      await edu.bgClose().catch(() => {});
    }
  }
  return finish(s, "error", "课表抓取重试未完成");
}

let running: Promise<SyncOutcome> | null = null;

/** 立即更新；同时只跑一个 */
export function syncNow(): Promise<SyncOutcome> {
  if (!running) {
    running = doSync().finally(() => {
      running = null;
    });
  }
  return running;
}

export const eduSyncing = () => running !== null;

/** 回前台静默检查：开着、距上次超过 24 小时。 */
export function resumeSync(): Promise<SyncOutcome> | null {
  const s = load();
  if (!s || !s.enabled || browserOpen || running)
    return null;
  if (Date.now() - s.lastAt < RESUME_GAP)
    return null;
  return syncNow();
}

export function outcomeText(o: SyncOutcome): string {
  if (o.note)
    return o.note;
  switch (o.result) {
    case "ok":
      return `课表已更新，${o.changes} 处变更`;
    case "nochange":
      return "课表没有变化";
    case "expired":
      return o.message || "需要重新登录";
    default:
      return o.message ? `更新失败，${o.message}` : "更新失败";
  }
}

function when(at: number): string {
  const d = new Date(at);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(today) - day(d)) / 86400_000);
  if (diff === 0)
    return `今天 ${hm}`;
  if (diff === 1)
    return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

/** 学期页状态行文案 */
export function statusText(s: EduSync): { text: string; danger: boolean } {
  if (s.lastResult === "expired")
    return { text: "需要重新登录", danger: true };
  if (!s.lastAt || !s.lastResult)
    return { text: s.enabled ? "还没更新过" : "已登录", danger: false };
  const t = when(s.lastAt);
  if (s.lastResult === "ok")
    return { text: `${t}，${s.lastChanges} 处变更`, danger: false };
  if (s.lastResult === "nochange")
    return { text: `${t}，无变化`, danger: false };
  return { text: `${t}，更新失败`, danger: false };
}
