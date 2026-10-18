import type { State } from "../store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrate, emptyState, memoryPersistence, Store } from "../store";

const h = vi.hoisted(() => ({
  current: null as Store | null,
  permission: "granted",
  calendarEvents: [] as string[],
  jobs: [] as unknown[],
  blockedRemoval: false,
  calendarSync: vi.fn(),
}));
vi.mock("../../app/store", () => ({ get store() { return h.current!; } }));
vi.mock("../../app/calendar", () => ({
  calendarPermission: async () => h.permission,
  requestCalendarPermission: async () => h.permission,
  clearCalendar: async () => {
    if (h.blockedRemoval) throw new Error("日历清理失败");
    h.calendarEvents = [];
  },
  syncCalendar: async () => { h.calendarSync(); h.calendarEvents = ["课程", "作业"]; },
}));
vi.mock("../../app/notifications", () => ({
  notificationStatus: async () => ({ permission: h.permission, notificationsEnabled: h.permission === "granted", exactAlarms: true, canPromote: true, scheduled: h.jobs.length }),
  clearNotifications: async () => { h.jobs = []; },
  replaceNotifications: async (jobs: unknown[]) => { h.jobs = jobs; },
}));
import { clearReminders, refreshReminderStatus, setReminderMethod, syncReminders } from "../../app/reminder-service";

beforeEach(async () => {
  vi.stubGlobal("window", globalThis);
  h.current = new Store(memoryPersistence());
  h.blockedRemoval = false;
  h.permission = "granted";
  await clearReminders();
  h.calendarSync.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("reminder method migration", () => {
  it.each([true, false])("migrates explicit legacy calendar choice %s without enabling local notifications", (enabled) => {
    const raw = { ...emptyState(), prefs: { calendarSyncEnabled: enabled, calendarSyncSetupDone: true } } as unknown as State;
    expect(hydrate(raw).prefs).toMatchObject({ reminderMethod: enabled ? "calendar" : "off", reminderSetupDone: true });
  });
  it("does not treat corrupted legacy consent as permission", () => {
    const raw = { ...emptyState(), prefs: { calendarSyncEnabled: "true", calendarSyncSetupDone: 1 } } as unknown as State;
    expect(hydrate(raw).prefs).toMatchObject({ reminderMethod: "off", reminderSetupDone: false });
  });
  it("keeps a saved local-notification choice on reload", () => {
    const state = emptyState();
    state.prefs.reminderMethod = "notification";
    state.prefs.reminderSetupDone = true;
    expect(hydrate(state).prefs.reminderMethod).toBe("notification");
  });
});

describe("mutually exclusive reminder delivery", () => {
  it("removes calendar events before enabling local delivery and removes local jobs on return", async () => {
    expect(await setReminderMethod("calendar")).toBe(true);
    expect(h.calendarEvents).toEqual(["课程", "作业"]);
    expect(await setReminderMethod("notification")).toBe(true);
    expect(h.calendarEvents).toEqual([]);
    expect(h.current!.state.prefs.reminderMethod).toBe("notification");
    h.jobs = [{ key: "pending-homework" }];
    expect(await setReminderMethod("calendar")).toBe(true);
    expect(h.jobs).toEqual([]);
    expect(h.calendarEvents).toEqual(["课程", "作业"]);
  });
  it("does not enable the new backend if old calendar cleanup fails", async () => {
    await setReminderMethod("calendar");
    h.blockedRemoval = true;
    expect(await setReminderMethod("notification")).toBe(false);
    expect(h.current!.state.prefs.reminderMethod).toBe("off");
    expect(h.jobs).toEqual([]);
    expect(h.calendarEvents).toEqual(["课程", "作业"]);
  });
  it("keeps the old delivery choice when new permission is denied", async () => {
    await setReminderMethod("calendar");
    h.permission = "denied";
    expect(await setReminderMethod("notification")).toBe(false);
    expect(h.current!.state.prefs.reminderMethod).toBe("calendar");
    expect(h.calendarEvents).toEqual(["课程", "作业"]);
  });
  it("clears both backends when switched off and does not recreate them during sync", async () => {
    await setReminderMethod("calendar");
    expect(await setReminderMethod("off")).toBe(true);
    await syncReminders();
    expect(h.calendarEvents).toEqual([]);
    expect(h.jobs).toEqual([]);
    expect(h.current!.state.prefs).toMatchObject({ reminderMethod: "off", reminderSetupDone: true });
  });
  it("refreshes notification permission without replacing jobs or clearing the selected method", async () => {
    await setReminderMethod("notification");
    const jobs = h.jobs;
    await Promise.all([refreshReminderStatus(), refreshReminderStatus()]);
    expect(h.jobs).toBe(jobs);
    expect(h.current!.state.prefs.reminderMethod).toBe("notification");
  });
  it("can refresh again after querying while reminders were off", async () => {
    await refreshReminderStatus();
    await setReminderMethod("notification");
    h.permission = "denied";
    await refreshReminderStatus();
    h.permission = "granted";
    await refreshReminderStatus();
    expect(h.current!.state.prefs.reminderMethod).toBe("notification");
    expect(h.jobs).toEqual([]);
  });
});
