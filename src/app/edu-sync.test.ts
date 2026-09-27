import type { ZfKb } from "../domain/edu/zhengfang";
import type { Semester } from "../domain/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zfFetchJs } from "../domain/edu/scripts";
import { defaultSemester } from "./semester";
import { store } from "./store";

const { bridge, platform, credentials, login } = vi.hoisted(() => ({
  platform: { current: "android" },
  credentials: { load: vi.fn(), clear: vi.fn() },
  login: { begin: vi.fn(), submit: vi.fn() },
  bridge: {
    nav: null as null | ((e: { url: string; title: string }) => void),
    bgOpen: vi.fn(), bgClose: vi.fn(), bgZfFetch: vi.fn(), bgPageHtml: vi.fn(),
    getCookies: vi.fn(), replaceCookies: vi.fn(), clearProfile: vi.fn(), http: vi.fn(),
  },
}));
const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  clear: () => data.clear(), getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key),
});
vi.stubGlobal("window", globalThis);

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => platform.current } }));
vi.mock("./edu-browser", () => ({
  nativeEdu: () => true, eduProfile: (url: string) => `edu-${new URL(url).host}`,
  eduCredentials: credentials, eduOcr: { recognize: vi.fn() }, CAPTCHA_OCR_VIEWS: 2,
  edu: { ...bridge, onBgNav: (fn: (e: { url: string; title: string }) => void) => {
    bridge.nav = fn;
    return () => { bridge.nav = null; };
  } },
}));
vi.mock("../domain/edu/plugin", () => ({ EDU_PLUGINS: [{ url: "https://qyrz.xjvut.edu.cn/cas/login", auth: { kind: "login", flow: { begin: login.begin, login: login.submit } } }] }));
vi.mock("./store", () => ({ store: {
  state: { semester: null as Semester | null },
  previewImport: vi.fn((incoming: { course: { name: string } }[]) => ({ added: incoming.filter(c => c.course.name === "高等数学"), removed: [], changed: [] })),
  setSemester: vi.fn(), applyImport: vi.fn(),
} }));
import { bindEduSync, getEduSync, logoutEduSync, restoreEduSync, syncNow } from "./edu-sync";

const school = { url: "https://qyrz.xjvut.edu.cn/cas/login", name: "新疆理工职业大学", system: "zhengfang_new" as const };
const pageUrl = "https://jw.xjvut.edu.cn:6082/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html";
const course = { kcmc: "高等数学", xm: "张老师", cdmc: "教学楼 201", xqj: "1", jcs: "1-2", zcd: "1-16周" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  store.state.semester = defaultSemester("2026-09-07");
  bridge.bgOpen.mockImplementation(async () => { queueMicrotask(() => bridge.nav?.({ url: pageUrl, title: "学生课表" })); });
  bridge.bgClose.mockResolvedValue(undefined);
  bridge.bgZfFetch.mockResolvedValue([course]);
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

function fetchInBoundPage(xnm: string, xqm: string, fetch: (url: string, init: { method: string; credentials: string; body: string }) => Promise<unknown>): Promise<ZfKb[]> {
  const execute = new Function("fetch", "location", `return (async function(){${zfFetchJs(xnm, xqm)}})();`) as (
    request: (url: string, init: { method: string; credentials: string; body: string }) => Promise<unknown>, location: { pathname: string }
  ) => Promise<ZfKb[]>;
  return execute(fetch, { pathname: "/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html" });
}

describe("native timetable sync", () => {
  it("fetches the bound term using the existing school cookies, then imports parsed lessons", async () => {
    const server = vi.fn(async (url: string, init: { method: string; credentials: string; body: string }) => {
      const params = new URLSearchParams(init.body);
      const authorized = init.method === "POST" && init.credentials === "include" && params.get("xnm") === "2025"
        && params.get("xqm") === "12" && params.get("kzlx") === "ck"
        && params.get("xsdm") === "" && params.get("kclbdm") === "" && params.get("kclxdm") === "";
      return { status: authorized ? 200 : 400, ok: authorized, url, text: async () => authorized ? JSON.stringify({ kbList: [course] }) : "bad request" };
    });
    bridge.bgZfFetch.mockImplementation((xnm: string, xqm: string) => fetchInBoundPage(xnm, xqm, server));
    bindEduSync({ school, pageUrl, term: { xnm: "2025", xqm: "12" } }, true);
    expect(await finishSync()).toMatchObject({ result: "ok", changes: 1 });
    expect(server).toHaveBeenCalledWith("/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151", expect.any(Object));
    expect(bridge.bgOpen).toHaveBeenCalledExactlyOnceWith(pageUrl, school.url);
    expect(store.applyImport).toHaveBeenCalledWith([
      expect.objectContaining({ course: expect.objectContaining({ name: "高等数学", teacher: "张老师" }), rules: [expect.objectContaining({ weekday: 1, startPeriod: 1, endPeriod: 2, location: "教学楼 201" })] }),
    ], expect.any(Object));
    expect(credentials.load).not.toHaveBeenCalled();
    expect(login.begin).not.toHaveBeenCalled();
  });

  it("renews a genuinely expired cookie session with saved credentials and fetches the bound timetable", async () => {
    let authorized = false;
    const server = vi.fn(async (url: string, init: { body: string }) => ({
      status: authorized ? 200 : 901, ok: authorized, url,
      text: async () => JSON.stringify({ kbList: [course] }),
      requestedTerm: new URLSearchParams(init.body).get("xqm"),
    }));
    bridge.bgZfFetch.mockImplementation((xnm: string, xqm: string) => fetchInBoundPage(xnm, xqm, server));
    bridge.replaceCookies.mockImplementation(async () => { authorized = true; return true; });
    bindEduSync({ school, pageUrl, term: { xnm: "2025", xqm: "12" } }, true);
    expect(await finishSync()).toMatchObject({ result: "ok", changes: 1 });
    expect(bridge.bgOpen).toHaveBeenCalledTimes(2);
    expect(server).toHaveBeenCalledTimes(2);
    await expect(server.mock.results[1].value).resolves.toMatchObject({ requestedTerm: "12" });
    expect(credentials.load).toHaveBeenCalledTimes(1);
    expect(login.submit).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { username: "student", password: "secret", captcha: "" });
    expect(bridge.replaceCookies).toHaveBeenCalledWith("edu-qyrz.xjvut.edu.cn", [{ url: school.url, cookies: ["TGC=new"] }]);
    expect(store.applyImport).toHaveBeenCalledOnce();
  });

  it("reports expiration when no credentials were saved, without retrying", async () => {
    bridge.bgZfFetch.mockRejectedValueOnce(new Error("登录已失效"));
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
    bridge.bgZfFetch.mockRejectedValueOnce(new Error("登录已失效"));
    login.submit.mockResolvedValue({ kind: "fail", message: "账号或密码不对" });
    expect(await finishSync()).toMatchObject({ result: "expired", message: "账号或密码不对" });
  });

  it("retries only once after renewal when the renewed session is still unauthorized", async () => {
    bridge.bgZfFetch.mockRejectedValue(new Error("登录已失效"));
    expect(await finishSync()).toMatchObject({ result: "expired", message: "登录已失效" });
    expect(bridge.bgOpen).toHaveBeenCalledTimes(2);
    expect(credentials.load).toHaveBeenCalledTimes(1);
    expect(login.submit).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-authentication errors, invalid JSON, or unrelated redirects", async () => {
    bridge.bgZfFetch.mockRejectedValueOnce(new Error("HTTP 500"));
    expect(await finishSync()).toMatchObject({ result: "error", message: "HTTP 500" });
    expect(credentials.load).not.toHaveBeenCalled();

    bridge.bgZfFetch.mockImplementationOnce((xnm: string, xqm: string) => fetchInBoundPage(xnm, xqm, async url => ({
      status: 200, ok: true, url, text: async () => "<!doctype html><h1>Maintenance</h1>",
    })));
    expect(await finishSync()).toMatchObject({ result: "error" });
    expect(credentials.load).not.toHaveBeenCalled();

    bridge.bgZfFetch.mockImplementationOnce((xnm: string, xqm: string) => fetchInBoundPage(xnm, xqm, async url => ({
      status: 200, ok: true, url, text: async () => JSON.stringify({ error: "maintenance" }),
    })));
    expect(await finishSync()).toMatchObject({ result: "error", message: "课表接口没有返回 kbList" });
    expect(credentials.load).not.toHaveBeenCalled();

    bridge.bgOpen.mockImplementationOnce(async () => { queueMicrotask(() => bridge.nav?.({ url: "https://jw.xjvut.edu.cn:6082/error.html", title: "维护中" })); });
    expect(await finishSync()).toMatchObject({ result: "error", message: expect.stringContaining("未进入课表页") });
    expect(credentials.load).not.toHaveBeenCalled();
  });

  it("logout while credentials are being read cannot restart login or recreate cookies", async () => {
    bridge.bgZfFetch.mockRejectedValueOnce(new Error("登录已失效"));
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
    bridge.bgZfFetch.mockRejectedValueOnce(new Error("登录已失效"));
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
    bridge.bgZfFetch.mockImplementation(() => pending.promise);
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
