import type { Snapshot } from "./engine";
import type { Prefs, Task } from "./types";
import { planCalendar } from "./calendar-plan";
import { atMinutes, fmtMinutes, fromDate } from "./dates";

export interface ReminderJob {
  key: string;
  notificationKey: string;
  at: number;
  until: number;
  kind: "course" | "task" | "exam";
  title: string;
  text: string;
  link: string;
  promote: boolean;
  phase?: "before" | "during";
  countdown?: boolean;
  startAt?: number;
  endAt?: number;
  location?: string;
  timeRange?: string;
  detail?: string;
}

/** 同一领域规则投影到本地通知；日历重复课程展开为单次，不再解析 RRULE。 */
export function planNotifications(snap: Snapshot | null, tasks: Task[], prefs: Prefs, now: Date): ReminderJob[] {
  const timestamp = now.getTime();
  const jobs: ReminderJob[] = [];
  for (const item of planCalendar(snap, tasks, prefs, now, true)) {
    if (item.kind === "week" || !item.reminders.length || item.event.cancelled)
      continue;
    const event = item.event;
    const course = item.kind === "course";
    const start = event.start;
    const until = course ? event.end! : Math.max(event.end ?? start, start + 60_000);
    if (until <= timestamp)
      continue;
    const notificationKey = `${item.key}:${start}`;
    const base = {
      notificationKey,
      kind: item.kind,
      title: event.title,
      text: [event.location, new Date(start).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · "),
      startAt: start,
      endAt: until,
      location: event.location ?? "",
      timeRange: course ? `${fmtMinutes(new Date(start).getHours() * 60 + new Date(start).getMinutes())}–${fmtMinutes(new Date(until).getHours() * 60 + new Date(until).getMinutes())}` : "",
      detail: event.description ?? "",
      link: event.link ?? "timetable://open/day/" + fromDate(now),
    };
    for (const lead of item.reminders) {
      // Android Calendar 全天事件提醒以本地午夜为基准。
      const reference = event.allDay ? atMinutes(new Date(start).toISOString().slice(0, 10), 0) : start;
      const at = reference - lead * 60_000;
      const primary = course && lead === prefs.classLead;
      const end = primary ? until : course ? start - prefs.classLead * 60_000 : until;
      if (end <= timestamp || (!course && at <= timestamp))
        continue;
      if (course && !primary && at <= timestamp)
        continue;
      jobs.push({ ...base, key: `${notificationKey}:lead:${lead}:${at}`, at, until: end, promote: primary,
        ...(course ? { phase: "before" as const, text: ["即将上课", event.location, base.timeRange].filter(Boolean).join(" · ") } : {}) });
    }
    if (course) {
      jobs.push({ ...base, key: `${notificationKey}:during`, at: start, until, promote: true,
        phase: "during", countdown: prefs.showDismissCountdown,
        text: ["上课中", event.location, base.timeRange].filter(Boolean).join(" · ") });
    }
  }
  return jobs.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}
