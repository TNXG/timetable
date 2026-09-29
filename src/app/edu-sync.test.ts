import type { ZfWeeklyTimetable } from "../domain/edu/zhengfang";
import type { Semester } from "../domain/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "../domain/dates";
import { zfWeeklyFetchJs } from "../domain/edu/scripts";
import { bindEduSync, getEduSync, logoutEduSync, restoreEduSync, syncNow } from "./edu-sync";
import { defaultSemester } from "./semester";
import { store } from "./store";

const { bridge, platform, credentials, login } = vi.hoisted(() => ({
  platform: { current: "android" },
  credentials: { load: vi.fn(), clear: vi.fn() },
  login: { begin: vi.fn(), submit: vi.fn() },
  bridge: {
    nav: null as null | ((e: { url: string; title: string }) => void),
    bgOpen: vi.fn(),
    bgClose: vi.fn(),
    bgZfWeeklyFetch: vi.fn(),
    bgPageHtml: vi.fn(),
    getCookies: vi.fn(),
    replaceCookies: vi.fn(),
    clearProfile: vi.fn(),
    http: vi.fn(),
  },
}));
const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  clear: () => data.clear(),
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
});
vi.stubGlobal("window", globalThis);

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => platform.current } }));
vi.mock("./edu-browser", () => ({
  nativeEdu: () => true,
  eduProfile: (url: string) => `edu-${new URL(url).host}`,
  eduCredentials: credentials,
  eduOcr: { recognize: vi.fn() },
  CAPTCHA_OCR_VIEWS: 2,
  edu: { ...bridge, onBgNav: (fn: (e: { url: string; title: string }) => void) => {
    bridge.nav = fn;
    return () => { bridge.nav = null; };
  } },
}));
vi.mock("../domain/edu/plugin", () => ({ EDU_PLUGINS: [{ url: "https://qyrz.xjvut.edu.cn/cas/login", auth: { kind: "login", flow: { begin: login.begin, login: login.submit } } }] }));
vi.mock("./store", () => ({ store: {
  state: { semester: null as Semester | null },
  previewImport: vi.fn((incoming: { course: { name: string } }[]) => ({ added: incoming.filter(c => c.course.name === "高等数学"), removed: [], changed: [] })),
  setSemester: vi.fn(),
  applyImport: vi.fn(),
} }));

const school = { url: "https://qyrz.xjvut.edu.cn/cas/login", name: "新疆理工职业大学", system: "zhengfang_new" as const };
const pageUrl = "https://jw.xjvut.edu.cn:6082/jwglxt/kbcx/xskbcxMobile_cxXskbcxIndex.html?gnmkdm=Y253510";
const course = { kcmc: "高等数学", xm: "张老师", cdmc: "教学楼 201", xqj: "1", jcs: "1-2", zcd: "1-16周" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  store.state.semester = defaultSemester("2026-09-07");
  bridge.bgOpen.mockImplementation(async () => { queueMicrotask(() => bridge.nav?.({ url: pageUrl, title: "学生课表" })); });
  bridge.bgClose.mockResolvedValue(undefined);
  bridge.bgZfWeeklyFetch.mockResolvedValue({ weeks: Array.from({ length: 19 }, (_, i) => ({ zs: String(i + 1), rq: `${addDays("2026-08-31", i * 7)}/${addDays("2026-08-31", i * 7 + 6)}` })), courses: [{ ...course, zcd: "5" }] });
  bridge.replaceCookies.mockResolvedValue(true);
  bridge.clearProfile.mockResolvedValue(true);
  credentials.clear.mockResolvedValue(true);
  credentials.load.mockResolvedValue({ username: "student", password: "secret" });
  login.begin.mockResolvedValue({ kind: "form", captcha: null });
  login.submit.mockResolvedValue({ kind: "ok", jars: [{ url: school.url, cookies: ["TGC=new"] }] });
  bindEduSync({ school, pageUrl, term: { xnm: "2026", xqm: "3" } }, true);
});
afterEach(() => { vi.useRealTimers(); });

async function finishSync() {
  const result = syncNow();
  await vi.runAllTimersAsync();
  return result;
}

function fetchInBoundPage(xnm: string, xqm: string, fetch: (url: string, init: { method: string; credentials: string; body: string }) => Promise<unknown>): Promise<ZfWeeklyTimetable> {
  // eslint-disable-next-line no-new-func -- 在与浏览器注入一致的环境里执行生产抓取脚本源码
  const execute = new Function("fetch", "location", `return (async function(){${zfWeeklyFetchJs(xnm, xqm)}})();`) as (
    request: (url: string, init: { method: string; credentials: string; body: string }) => Promise<unknown>,
    location: { pathname: string },
  ) => Promise<ZfWeeklyTimetable>;
  return execute(fetch, { pathname: "/jwglxt/kbcx/xskbcxMobile_cxXskbcxIndex.html" });
}

describe("native timetable sync", () => {
  it("fetches every bound week with school cookies, then imports weekly lessons", async () => {
    const server = vi.fn(async (url: string, init: { method: string; credentials: string; body: string }) => {
      const params = new URLSearchParams(init.body);
      const term = params.get("xnm") === "2025" && params.get("xqm") === "12";
      const week = params.get("zs");
      const authorized = init.method === "POST" && init.credentials === "include" && term;
      const weeks = Array.from({ length: 19 }, (_, i) => ({ zs: String(i + 1), rq: `${addDays("2026-08-31", i * 7)}/${addDays("2026-08-31", i * 7 + 6)}` }));
      const valid = authorized && (week === null || params.get("kblx") === "1" && params.get("doType") === "app");
      return { status: valid ? 200 : 400, ok: valid, url, text: async () => valid ? JSON.stringify(week === null ? weeks : { kbList: week === "5" ? [course] : [] }) : "bad request", json: async () => weeks };
    });
    bridge.bgZfWeeklyFetch.mockImplementation((xnm: string, xqm: string) => fetchInBoundPage(xnm, xqm, server));
    bindEduSync({ school, pageUrl, term: { xnm: "2025", xqm: "12" } }, true);
    expect(await finishSync()).toMatchObject({ result: "ok", changes: 1 });
    expect(server).toHaveBeenCalledTimes(20);
    expect(server).toHaveBeenCalledWith("/jwglxt/kbcx/xskbcxMobile_cxXsKb.html", expect.objectContaining({ body: "xnm=2025&xqm=12&zs=5&kblx=1&doType=app" }));
    expect(bridge.bgOpen).toHaveBeenCalledExactlyOnceWith(pageUrl, school.url);
    expect(store.setSemester).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2026-08-31", totalWeeks: 19 }));
    expect(store.applyImport).toHaveBeenCalledWith([
      expect.objectContaining({ course: expect.objectContaining({ name: "高等数学", teacher: "张老师" }), rules: [expect.objectContaining({ weekday: 1, startPeriod: 1, endPeriod: 2, location: "教学楼 201" })] }),
    ], expect.any(Object));
    expect(credentials.load).not.toHaveBeenCalled();
    expect(login.begin).not.toHaveBeenCalled();
  });

  it("周次元数据缺周时不覆盖现有课表", async () => {
    bridge.bgZfWeeklyFetch.mockResolvedValueOnce({ weeks: [{ zs: "1", rq: "2026-08-31/2026-09-06" }, { zs: "3", rq: "2026-09-14/2026-09-20" }], courses: [] });
    expect(await finishSync()).toMatchObject({ result: "error", message: "周课表读取失败" });
    expect(store.setSemester).not.toHaveBeenCalled();
    expect(store.applyImport).not.toHaveBeenCalled();
  });

  it("renews a genuinely expired cookie session and fetches the bound weekly timetable", async () => {
    let authorized = false;
    bridge.bgZfWeeklyFetch.mockImplementation(async () => {
      if (!authorized)
        throw new Error("登录已失效");
      return { weeks: Array.from({ length: 19 }, (_, i) => ({ zs: String(i + 1), rq: `${addDays("2026-08-31", i * 7)}/${addDays("2026-08-31", i * 7 + 6)}` })), courses: [{ ...course, zcd: "5" }] };
    });
    bridge.replaceCookies.mockImplementation(async () => { authorized = true; return true; });
    bindEduSync({ school, pageUrl, term: { xnm: "2025", xqm: "12" } }, true);
    expect(await finishSync()).toMatchObject({ result: "ok", changes: 1 });
    expect(bridge.bgOpen).toHaveBeenCalledTimes(2);
    expect(bridge.bgZfWeeklyFetch).toHaveBeenCalledTimes(2);
    expect(credentials.load).toHaveBeenCalledTimes(1);
    expect(login.submit).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { username: "student", password: "secret", captcha: "" });
    expect(store.applyImport).toHaveBeenCalledOnce();
  });

  it("reports expiration when no credentials were saved, without retrying", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("登录已失效"));
    credentials.load.mockResolvedValue(null);
    expect(await finishSync()).toMatchObject({ result: "expired", message: "登录已失效，未保存账号密码" });
    expect(bridge.bgOpen).toHaveBeenCalledTimes(1);
    expect(getEduSync()?.lastMessage).toBe("登录已失效，未保存账号密码");
    expect(getEduSync()?.school).toEqual(school);
    restoreEduSync();
    expect(getEduSync()).toMatchObject({ school, lastResult: "", failStreak: 0 });
    expect(login.begin).not.toHaveBeenCalled();
  });

  it("returns the precise login failure, not a generic expired message", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("登录已失效"));
    login.submit.mockResolvedValue({ kind: "fail", message: "账号或密码不对" });
    expect(await finishSync()).toMatchObject({ result: "expired", message: "账号或密码不对" });
  });

  it("retries only once after renewal when the renewed session is still unauthorized", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValue(new Error("登录已失效"));
    expect(await finishSync()).toMatchObject({ result: "expired", message: "登录已失效" });
    expect(bridge.bgOpen).toHaveBeenCalledTimes(2);
    expect(credentials.load).toHaveBeenCalledTimes(1);
    expect(login.submit).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-authentication errors or unrelated redirects", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("HTTP 500"));
    expect(await finishSync()).toMatchObject({ result: "error", message: "HTTP 500" });
    expect(credentials.load).not.toHaveBeenCalled();

    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("课表接口没有返回 kbList"));
    expect(await finishSync()).toMatchObject({ result: "error", message: "课表接口没有返回 kbList" });
    expect(credentials.load).not.toHaveBeenCalled();

    bridge.bgOpen.mockImplementationOnce(async () => { queueMicrotask(() => bridge.nav?.({ url: "https://jw.xjvut.edu.cn:6082/error.html", title: "维护中" })); });
    expect(await finishSync()).toMatchObject({ result: "error", message: expect.stringContaining("未进入课表页") });
    expect(credentials.load).not.toHaveBeenCalled();
  });

  it("logout while credentials are being read cannot restart login or recreate cookies", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("登录已失效"));
    const pending = Promise.withResolvers<{ username: string; password: string }>();
    credentials.load.mockImplementation(() => pending.promise);
    const sync = syncNow();
    await vi.advanceTimersByTimeAsync(800);
    const logout = logoutEduSync();
    expect(getEduSync()).toBeNull();
    pending.resolve({ username: "student", password: "secret" });
    expect(await sync).toMatchObject({ result: "error", message: "已退出登录" });
    await logout;
    expect(login.begin).not.toHaveBeenCalled();
    expect(bridge.replaceCookies).not.toHaveBeenCalled();
    expect(bridge.clearProfile).toHaveBeenCalledWith(school.url);
    expect(credentials.clear).toHaveBeenCalledOnce();
  });

  it("logout during credential login discards its returned cookie jars", async () => {
    bridge.bgZfWeeklyFetch.mockRejectedValueOnce(new Error("登录已失效"));
    const pending = Promise.withResolvers<{ kind: "ok"; jars: { url: string; cookies: string[] }[] }>();
    login.submit.mockImplementation(() => pending.promise);
    const sync = syncNow();
    await vi.advanceTimersByTimeAsync(800);
    expect(login.submit).toHaveBeenCalledOnce();
    const logout = logoutEduSync();
    pending.resolve({ kind: "ok", jars: [{ url: school.url, cookies: ["TGC=old"] }] });
    expect(await sync).toMatchObject({ result: "error", message: "已退出登录" });
    await logout;
    expect(bridge.replaceCookies).not.toHaveBeenCalled();
    expect(credentials.clear).toHaveBeenCalledOnce();
    expect(getEduSync()).toBeNull();
  });

  it("logout waits for in-flight fetch, then clears bound record, school Profile, and credentials", async () => {
    const pending = Promise.withResolvers<typeof course[]>();
    bridge.bgZfWeeklyFetch.mockImplementation(() => pending.promise);
    const sync = syncNow();
    await vi.advanceTimersByTimeAsync(800);
    const logout = logoutEduSync();
    expect(getEduSync()).toBeNull();
    pending.resolve([course]);
    await sync;
    await logout;
    expect(bridge.clearProfile).toHaveBeenCalledWith(school.url);
    expect(credentials.clear).toHaveBeenCalledOnce();
    expect(store.applyImport).not.toHaveBeenCalled();
    expect(getEduSync()).toBeNull();
  });
});
