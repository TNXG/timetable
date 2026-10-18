import type { Semester } from "../types";
import { describe, expect, it } from "vitest";
import { parseIcs } from "../importers/ics";

const sem: Semester = {
  id: "s1",
  name: "2026 秋季",
  startDate: "2026-08-31",
  totalWeeks: 8,
  timeGrid: [
    { index: 1, start: 480, end: 525 },
    { index: 2, start: 535, end: 580 },
    { index: 3, start: 600, end: 645 },
    { index: 4, start: 655, end: 700 },
  ],
  vacations: [],
  holidays: false,
  examWeeks: [],
};
const legacyIcs = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  `X-TT-SEMESTER:${JSON.stringify({ name: sem.name, startDate: sem.startDate, totalWeeks: sem.totalWeeks, timeGrid: sem.timeGrid }).replace(/,/g, "\\,")}`,
  "BEGIN:VEVENT",
  "SUMMARY:高等数学",
  "DTSTART:20260831T080000",
  "DTEND:20260831T094000",
  "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=8",
  "EXDATE:20260914T080000,20260928T080000",
  "LOCATION:教三 302",
  "DESCRIPTION:王立群\\n13800138000",
  "X-TT-COLOR:#4FA3A1",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("iCS 导入", () => {
  it("带学期元数据的文件保留周次、节次、教师、电话和颜色", () => {
    const other: Semester = { ...sem, id: "x", name: "别人的学期", startDate: "2026-02-23", totalWeeks: 16, timeGrid: sem.timeGrid.slice(0, 2) };
    const out = parseIcs(legacyIcs, other);
    expect(out.diagnostics.filter(d => d.level === "error")).toEqual([]);
    expect(out.semester).toEqual({ name: "2026 秋季", startDate: "2026-08-31", totalWeeks: 8 });
    expect(out.timeGrid).toHaveLength(4);
    expect(out.courses).toHaveLength(1);
    expect(out.courses[0]).toMatchObject({
      name: "高等数学",
      teacher: "王立群",
      teacherPhone: "13800138000",
      location: "教三 302",
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      weeks: "1,2,4,6,7,8",
      color: "#4FA3A1",
    });
  });

});
