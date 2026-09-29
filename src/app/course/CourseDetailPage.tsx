import type { Snapshot } from "../../domain/engine";
import type { Course, Task } from "../../domain/types";
/** 课程详情：下一次上课、学期进度、出勤、待办、贴纸与隐藏 */
import { useMemo, useRef, useState } from "react";
import EditLine from "~icons/mingcute/edit-line";
import PhoneLine from "~icons/mingcute/phone-line";
import SearchLine from "~icons/mingcute/search-line";
import { dateOf, fmtMinutes, weekdayOf } from "../../domain/dates";
import { searchStickers, stickerFor, stickerOf } from "../../domain/stickers";
import { maskHasWeek } from "../../domain/weeks";
import { nowMinutes, todayStr } from "../semester";
import { Sticker, stickerTilt, useStickersOn } from "../Sticker";
import { store, useStore } from "../store";
import { CourseTasks } from "../todo";
import { Card, md, Page, Sheet, SheetClose, SheetHead, TextInput, tint, TopBar, WD_SHORT } from "../ui";
import { dayLabel, formatPhone, mergeRules } from "./shared";

/* ---------------- 课程详情（内页） ---------------- */

export function CourseDetailPage({
  course,
  snap,
  composing,
  onBack,
  onEdit,
  onCapture,
  onOpenTask,
}: {
  course: Course;
  snap: Snapshot;
  onBack: () => void;
  onEdit: () => void;
  composing: boolean;
  onCapture: (kind: "camera" | "text") => void;
  onOpenTask: (t: Task) => void;
}) {
  const state = useStore();
  const cur = state.courses.find(c => c.id === course.id) ?? course;
  const rules = state.rules.filter(r => r.courseId === cur.id);
  const today = todayStr();
  const now = nowMinutes();
  const sem = snap.semester;

  /** 这门课在整个学期展开出的每一次，用于进度与出勤 */
  const sessions = useMemo(() => {
    const out: { date: string; ruleId: string; startPeriod: number; endPeriod: number; start: number; end: number; location?: string }[] = [];
    for (const r of rules) {
      for (let w = 1; w <= sem.totalWeeks; w++) {
        if (!maskHasWeek(r.weeksMask, w))
          continue;
        const date = dateOf(sem, w, r.weekday);
        const s = sem.timeGrid.find(t => t.index === r.startPeriod);
        const e = sem.timeGrid.find(t => t.index === r.endPeriod);
        out.push({ date, ruleId: r.id, startPeriod: r.startPeriod, endPeriod: r.endPeriod, start: s?.start ?? 0, end: e?.end ?? 0, location: r.location });
      }
    }
    return out.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  }, [rules, sem]);

  const ovOf = (ruleId: string, date: string) => state.overrides.find(o => o.ruleId === ruleId && o.date === date);
  const passed = sessions.filter(s => s.date < today || (s.date === today && s.end <= now));
  const next = sessions.find(s => s.date > today || (s.date === today && s.end > now));
  const attended = passed.filter(s => ovOf(s.ruleId, s.date)?.kind !== "leave" && ovOf(s.ruleId, s.date)?.kind !== "cancelled");
  const absent = passed.filter(s => ovOf(s.ruleId, s.date)?.kind === "leave");
  const rate = passed.length > 0 ? Math.round((attended.length / passed.length) * 100) : 0;
  const weeksSpan = sessions.length > 0 ? `${md(sessions[0].date)} – ${md(sessions[sessions.length - 1].date)}` : "";
  const phoneLink = cur.teacherPhone
    ? (
        <a key="phone" href={`tel:${cur.teacherPhone}`} className="inline-flex items-center gap-1 text-(--c-accent)">
          <span className="font-semibold tabular-nums">{formatPhone(cur.teacherPhone)}</span>
          <PhoneLine width="12" height="12" aria-hidden="true" />
        </a>
      )
    : null;
  const stickersOn = useStickersOn();
  const sticker = stickerFor(cur);
  const [pickSticker, setPickSticker] = useState(false);
  const holdRef = useRef<number | null>(null);
  const holdProps = {
    onPointerDown: () => {
      if (holdRef.current != null)
        window.clearTimeout(holdRef.current);
      holdRef.current = window.setTimeout(() => {
        holdRef.current = null;
        setPickSticker(true);
      }, 420);
    },
    onPointerUp: () => {
      if (holdRef.current != null)
        window.clearTimeout(holdRef.current);
      holdRef.current = null;
    },
    onPointerCancel: () => {
      if (holdRef.current != null)
        window.clearTimeout(holdRef.current);
      holdRef.current = null;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (holdRef.current != null && e.buttons === 0) {
        window.clearTimeout(holdRef.current);
        holdRef.current = null;
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  const tasks = state.tasks.filter(t => t.courseId === cur.id);

  const merged = mergeRules(rules);
  const todayWd = weekdayOf(today);
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-4 pb-10 scrollbar-none">
        <TopBar
          title={cur.name}
          onBack={onBack}
          trail={(
            <button
              onClick={onEdit}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
            >
              <EditLine width="15" height="15" style={{ color: "var(--c-accent2)" }} />
            </button>
          )}
        />

        <div className="mt-3 space-y-3">
          <Card className="relative">
            {sticker && stickersOn && (
              <span {...holdProps} className="absolute -top-4.5 -right-1.5 select-none touch-manipulation" style={{ WebkitTouchCallout: "none" }}>
                <Sticker id={sticker} size={74} tilt={stickerTilt(cur.name)} />
              </span>
            )}
            <div className={`flex items-start justify-between ${sticker && stickersOn ? "pr-16" : ""}`}>
              <div className="text-[12.5px] font-medium text-(--c-ink3)">
                {[cur.source === "import" ? "规则导入" : "手动添加", weeksSpan].filter(Boolean).join("，")}
              </div>
              {!(sticker && stickersOn) && <i {...holdProps} className="mt-1 ml-3 h-2.5 w-2.5 flex-none rounded-full" style={{ background: cur.color }} />}
            </div>
            <div className="mt-5">
              {([
                ["下次上课", next
                  ? (
                      <span key="next" className="tabular-nums">
                        {dayLabel(next.date, today)}
                        {" "}
                        {fmtMinutes(next.start)}
                        {" "}
                        –
                        {" "}
                        {fmtMinutes(next.end)}
                      </span>
                    )
                  : "本学期已上完"],
                ["地点", [...new Set(rules.map(r => r.location).filter(Boolean))].join("、") || "—"],
                ["老师", [...new Set([cur.teacher, ...rules.map(r => r.teacher)].filter(Boolean))].join("、") || "—"],
                ...(phoneLink ? [["教师电话", phoneLink] as [string, React.ReactNode]] : []),
              ] as [string, React.ReactNode][]).map(([k, v], i) => (
                <div key={k} className={`flex items-baseline ${i > 0 ? "mt-4" : ""}`}>
                  <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">{k}</span>
                  <span className="text-[14px] text-(--c-ink)">{v}</span>
                </div>
              ))}
            </div>

            {merged.length > 0 && (
              <div className="mt-5">
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                    const segs = merged.filter(m => m.weekday === wd);
                    const on = segs.length > 0;
                    return (
                      <div key={wd} className="flex flex-col items-center">
                        <span className={`text-[11px] font-bold ${wd === todayWd ? "text-(--c-accent)" : "text-(--c-ink4)"}`}>{WD_SHORT[wd]}</span>
                        <div
                          className={`mt-1.5 flex w-full flex-col items-center justify-center rounded-[10px] py-2 ${on ? "" : "bg-(--c-bg)"}`}
                          style={on ? { background: tint(cur.color, 22), minHeight: 46 } : { minHeight: 46 }}
                        >
                          {on
                            ? segs.map((m, i) => {
                                const s = sem.timeGrid.find(t => t.index === m.startPeriod);
                                const e = sem.timeGrid.find(t => t.index === m.endPeriod);
                                return (
                                  <span key={m.startPeriod} className={`flex flex-col items-center text-[10.5px] font-bold leading-[1.35] tabular-nums text-(--c-ink) ${i > 0 ? "mt-1.5" : ""}`}>
                                    <span>{s ? fmtMinutes(s.start) : `第${m.startPeriod}节`}</span>
                                    <span className="text-(--c-ink4)">{e ? fmtMinutes(e.end) : `第${m.endPeriod}节`}</span>
                                  </span>
                                );
                              })
                            : <span className="text-[11px] font-medium text-(--c-ink5)">–</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-baseline">
              <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">学期进度</span>
              <span className="text-[14px] font-semibold tabular-nums text-(--c-ink)">
                {passed.length}
                {" "}
                /
                {" "}
                {sessions.length}
                {" "}
                次
              </span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-(--c-surface2)">
              <i className="block h-full rounded-full bg-(--c-accent)" style={{ width: `${sessions.length ? (passed.length / sessions.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">出勤</span>
              <span className="text-[14px] font-semibold tabular-nums text-(--c-ink)">
                {passed.length === 0 ? "—" : `${attended.length} / ${passed.length}，出勤率 ${rate}%`}
              </span>
            </div>
            {passed.length > 0 && (
              <div className="mt-3 flex gap-1.5">
                {sessions.slice(0, 12).map((s) => {
                  const ov = ovOf(s.ruleId, s.date);
                  const done = s.date < today || (s.date === today && s.end <= now);
                  const cls = !done ? "bg-(--c-surface2)" : ov?.kind === "leave" ? "bg-(--c-ink5)" : ov?.kind === "cancelled" ? "bg-(--c-surface2)" : "bg-(--c-accent)";
                  return <div key={s.ruleId + s.date} className={`h-1 flex-1 rounded-full ${cls}`} />;
                })}
              </div>
            )}
            {absent.length > 0 && (
              <div className="mt-2.5 text-[11.5px] font-medium text-(--c-ink5)">
                请假
                {absent.length}
                {" "}
                次
              </div>
            )}
          </Card>

          <Card>
            <CourseTasks
              tasks={tasks}
              course={cur}
              composing={composing}
              onOpen={onOpenTask}
              onCamera={() => onCapture("camera")}
              onText={() => onCapture("text")}
            />
          </Card>
        </div>
      </div>
      {pickSticker && (
        <StickerPicker
          course={cur}
          onPick={(id) => {
            store.setCourseSticker(cur.id, id);
            setPickSticker(false);
          }}
          onClose={() => setPickSticker(false)}
        />
      )}
    </Page>
  );
}

function StickerPicker({ course, onPick, onClose }: { course: Course; onPick: (id: string | undefined) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const dismissRef = useRef<(() => void) | null>(null);
  const auto = stickerOf(course.name);
  const cur = stickerFor(course);
  const ids = useMemo(() => searchStickers(q).filter(id => q || id !== auto), [q, auto]);
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismissRef}
      className="px-4 pb-3"
      header={(
        <>
          <SheetHead title="课程贴纸" sub={course.name} trail={<SheetClose onClick={() => dismissRef.current?.()} />} />
          <div className="mx-4 mb-3 flex items-center rounded-[14px] bg-(--c-bg) px-3.5 py-2.5">
            <SearchLine width="15" height="15" className="mr-2.5 flex-none" style={{ color: "var(--c-ink4)" }} />
            <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="搜索学科或语言" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </div>
        </>
      )}
    >
      <div className="grid grid-cols-5 gap-2">
        {!q && (
          <button
            onClick={() => onPick(undefined)}
            aria-label="自动"
            className={`flex aspect-square items-center justify-center rounded-[16px] bg-(--c-bg) transition-transform duration-150 active:scale-[.94] ${course.sticker === undefined ? "ring-2 ring-inset ring-(--c-accent)" : ""}`}
          >
            {auto ? <Sticker id={auto} size={38} /> : <span className="h-9.5 w-9.5 rounded-full border-[1.8px] border-dashed border-(--c-ink5)" />}
          </button>
        )}
        {ids.map((id) => {
          const on = cur === id && course.sticker !== undefined;
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className={`flex aspect-square items-center justify-center rounded-[16px] bg-(--c-bg) transition-transform duration-150 active:scale-[.94] ${on ? "ring-2 ring-inset ring-(--c-accent)" : ""}`}
            >
              <Sticker id={id} size={38} />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
