import { describe, expect, it } from "vitest";
import { planNotifications } from "../notification-plan";
import { defaultPrefs } from "../types";
import type { Snapshot } from "../engine";
import { weeksToMask } from "../weeks";

const snap: Snapshot = {
  semester: { id: "s", name: "秋", startDate: "2026-08-31", totalWeeks: 2, holidays: false, vacations: [], examWeeks: [], timeGrid: [{ index: 1, start: 480, end: 525 }] },
  courses: [{ id: "c", semesterId: "s", name: "数学", color: "#123456", identityKey: "数学", hidden: false, source: "import" }],
  rules: [{ id: "r", courseId: "c", weekday: 1, startPeriod: 1, endPeriod: 1, weeksMask: weeksToMask([1, 2]), location: "A101" }],
  overrides: [], entries: [],
};
const prefs = defaultPrefs();

describe("native notification plan", () => {
  it("uses one course notification identity across advance reminder and ongoing phase", () => {
    const jobs = planNotifications(snap, [], prefs, new Date("2026-08-31T07:00:00"));
    const first = jobs.filter(j => j.until === new Date("2026-08-31T08:45:00").getTime());
    expect(first.map(j => new Date(j.at).toTimeString().slice(0, 5))).toEqual(["07:45", "08:00"]);
    expect(first[0].notificationKey).toBe(first[1].notificationKey);
    expect(first.every(j => j.promote)).toBe(true);
    expect(jobs.find(j => new Date(j.at).getHours() === 7 && new Date(j.at).getMinutes() === 30)?.promote).toBe(false);
  });
  it.each(["cancelled", "leave", "muted"] as const)("does not notify a %s course", (kind) => {
    const s = { ...snap, overrides: [{ id: "o", ruleId: "r", date: "2026-08-31", kind, createdAt: 0 }] };
    expect(planNotifications(s, [], prefs, new Date("2026-08-31T07:00:00")).some(j => j.at < new Date("2026-09-01").getTime())).toBe(false);
  });
  it("drops completed tasks and missed reminder times but keeps future deadlines", () => {
    const task = { id: "t", title: "习题", kind: "homework" as const, due: "2026-08-31", dueMinutes: 600, done: false, createdAt: 0 };
    const jobs = planNotifications(null, [task], { ...prefs, taskLeads: [120, 15] }, new Date("2026-08-31T08:30:00"));
    expect(jobs.map(j => new Date(j.at).toTimeString().slice(0, 5))).toEqual(["09:45"]);
    expect(planNotifications(null, [{ ...task, done: true }], prefs, new Date("2026-08-31T07:00:00"))).toEqual([]);
  });
  it("moves a course reminder to its override date and location", () => {
    const s: Snapshot = { ...snap, overrides: [{ id: "o", ruleId: "r", date: "2026-08-31", kind: "moved", newDate: "2026-09-01", newLocation: "B202", createdAt: 0 }] };
    const jobs = planNotifications(s, [], prefs, new Date("2026-08-31T07:00:00"));
    expect(jobs.some(j => new Date(j.at).getDate() === 31)).toBe(false);
    expect(jobs.find(j => new Date(j.at).getDate() === 1)?.text).toContain("B202");
  });
  it("changes only the ongoing course countdown while keeping schedule and identity stable", () => {
    const now = new Date("2026-08-31T08:10:00");
    const on = planNotifications(snap, [], { ...prefs, showDismissCountdown: true }, now).find(j => j.phase === "during")!;
    const off = planNotifications(snap, [], { ...prefs, showDismissCountdown: false }, now).find(j => j.phase === "during")!;
    expect(on.countdown).toBe(true);
    expect(off.countdown).toBe(false);
    expect(off.key).toBe(on.key);
    expect(off.endAt).toBe(new Date("2026-08-31T08:45:00").getTime());
    expect(off.text).toBe("上课中 · A101 · 08:00–08:45");
  });
});
