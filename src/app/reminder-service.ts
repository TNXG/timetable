import type { ReminderMethod } from "../domain/types";
import { useSyncExternalStore } from "react";
import { planNotifications } from "../domain/notification-plan";
import { calendarPermission, clearCalendar, requestCalendarPermission, syncCalendar } from "./calendar";
import { clearNotifications, notificationStatus, replaceNotifications } from "./notifications";
import { store } from "./store";

export const REMINDER_METHODS = [["off", "关闭"], ["calendar", "系统日历"], ["notification", "应用通知"]] as const;
let status = { busy: false, refreshing: false, checked: false, refreshedAt: 0, refreshError: "", error: "", permission: "prompt", notificationsEnabled: false, exactAlarms: false, canPromote: false, focusModuleActive: false };
const listeners = new Set<() => void>();
let revision = 0;
let timer: number | undefined;
let tail = Promise.resolve();
let changing = false;

function update(patch: Partial<typeof status>) {
  status = { ...status, ...patch };
  listeners.forEach(fn => fn());
}
export function useReminderStatus() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => status);
}

let checking: Promise<void> | null = null;
/** 状态刷新只读取权限，不重建排程，也不改变提醒方式或禁用整个表单。 */
export function refreshReminderStatus(): Promise<void> {
  if (checking)
    return checking;
  const method = store.state.prefs.reminderMethod;
  update({ refreshing: true, refreshError: "" });
  checking = Promise.resolve().then(async () => {
    try {
      if (method === "notification") {
        const native = await notificationStatus();
        if (store.state.prefs.reminderMethod === method)
          update({ ...native, checked: true, refreshedAt: Date.now(), refreshError: "" });
      } else if (method === "calendar") {
        const permission = await calendarPermission();
        if (store.state.prefs.reminderMethod === method)
          update({ permission, checked: true, refreshedAt: Date.now(), refreshError: "" });
      }
    } catch (error) {
      update({ refreshError: error instanceof Error ? error.message : "状态刷新失败" });
    } finally {
      checking = null;
      update({ refreshing: false });
    }
  });
  return checking;
}

/** 所有投影与切换串行；版本号在排队前推进，使在途旧投影无法落到新通道。 */
export function syncReminders(): Promise<void> {
  const version = revision;
  const action = async () => {
    if (version !== revision || changing)
      return;
    update({ busy: true, error: "" });
    try {
      const method = store.state.prefs.reminderMethod;
      if (method === "calendar") {
        const permission = await calendarPermission();
        update({ permission, checked: true });
        if (version === revision)
          await syncCalendar();
      } else if (method === "notification") {
        const native = await notificationStatus();
        update({ ...native, checked: true });
        if (version === revision) {
          await replaceNotifications(planNotifications(store.snapshot(), store.state.tasks, store.state.prefs, new Date()));
        }
      }
    } catch (error) {
      update({ error: error instanceof Error ? error.message : "提醒更新失败" });
    } finally {
      update({ busy: false });
    }
  };
  tail = tail.then(action, action);
  return tail;
}

export function scheduleReminderSync(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { timer = undefined; void syncReminders(); }, 500);
}

export function setReminderMethod(method: ReminderMethod): Promise<boolean> {
  if (method === store.state.prefs.reminderMethod && store.state.prefs.reminderSetupDone) {
    return refreshReminderStatus().then(() => true);
  }
  const version = ++revision;
  window.clearTimeout(timer);
  timer = undefined;
  changing = true;
  // Stop calendar's own gate immediately, including an in-flight batch.
  const old = store.state.prefs.reminderMethod;
  const setup = store.state.prefs.reminderSetupDone;
  store.setPrefs({ reminderMethod: "off" });
  let cleanupStarted = false;
  const action = async () => {
    update({ busy: true, error: "" });
    try {
      if (version !== revision)
        return false;
      if (method === "calendar" && await requestCalendarPermission() !== "granted")
        throw new Error("日历权限未获允许");
      if (method === "notification") {
        const native = await notificationStatus(true);
        update({ ...native, checked: true });
        if (native.permission !== "granted" || !native.notificationsEnabled)
          throw new Error("通知权限未获允许");
      }
      if (old === "calendar" && method !== "calendar" && await requestCalendarPermission() !== "granted")
        throw new Error("日历权限未获允许，无法移除旧提醒");
      if (version !== revision)
        return false;
      cleanupStarted = true;
      await clearCalendar();
      await clearNotifications();
      if (version !== revision)
        return false;
      store.setPrefs({ reminderMethod: method, reminderSetupDone: true });
      if (method === "calendar")
        await syncCalendar();
      else if (method === "notification")
        await replaceNotifications(planNotifications(store.snapshot(), store.state.tasks, store.state.prefs, new Date()));
      return true;
    } catch (error) {
      // Old choice is retained only on permission denial, before any cleanup begins.
      if (version === revision) {
        store.setPrefs(cleanupStarted ? { reminderMethod: "off", reminderSetupDone: setup }
          : { reminderMethod: old, reminderSetupDone: setup });
      }
      update({ error: error instanceof Error ? error.message : "提醒方式切换失败" });
      return false;
    } finally {
      if (version === revision) changing = false;
      update({ busy: false });
    }
  };
  const result = tail.then(action, action);
  tail = result.then(() => undefined);
  return result;
}

export async function clearReminders(): Promise<void> {
  revision++;
  changing = true;
  window.clearTimeout(timer);
  timer = undefined;
  store.setPrefs({ reminderMethod: "off" });
  await tail;
  try {
    await clearCalendar();
    await clearNotifications();
  } finally {
    changing = false;
  }
}
