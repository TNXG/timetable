import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ReminderJob } from "../domain/notification-plan";

export interface NotificationStatus {
  permission: "granted" | "prompt" | "denied" | "unsupported";
  notificationsEnabled: boolean;
  exactAlarms: boolean;
  canPromote: boolean;
  focusModuleActive: boolean;
  scheduled: number;
}
interface ReminderPlugin {
  inspect: () => Promise<NotificationStatus>;
  requestPermission: () => Promise<NotificationStatus>;
  replace: (options: { json: string }) => Promise<void>;
  clear: () => Promise<void>;
  openSettings: () => Promise<void>;
}
const native = registerPlugin<ReminderPlugin>("TtReminders");
const unsupported: NotificationStatus = { permission: "unsupported", notificationsEnabled: false, exactAlarms: false, canPromote: false, focusModuleActive: false, scheduled: 0 };

export async function notificationStatus(request = false): Promise<NotificationStatus> {
  if (Capacitor.getPlatform() !== "android")
    return unsupported;
  return request ? native.requestPermission() : native.inspect();
}
export async function replaceNotifications(jobs: ReminderJob[]): Promise<void> {
  if (Capacitor.getPlatform() !== "android")
    throw new Error("当前平台不支持应用通知");
  await native.replace({ json: JSON.stringify({ jobs }) });
}
export async function clearNotifications(): Promise<void> {
  if (Capacitor.getPlatform() === "android")
    await native.clear();
}
export async function openNotificationSettings(): Promise<void> {
  if (Capacitor.getPlatform() === "android")
    await native.openSettings();
}
