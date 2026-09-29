import type { Snapshot } from "../../domain/engine";
import type { Occurrence, ScheduleAdjustment } from "../../domain/types";
import type { Rect } from "../ui";
import DownLine from "~icons/mingcute/down-line";
import UpLine from "~icons/mingcute/up-line";
import { AnimatePresence, motion } from "motion/react";
/** 今天：跨日连续时间线 + 底部日期条；轻点进详情，长按弹快捷菜单 */
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, diffDays, fmtDuration, fmtMinutes, inVacation, weekdayOf, weekOf } from "../../domain/dates";
import { occurrencesOn } from "../../domain/engine";
import { holidaysBetween } from "../../domain/holidays";
import { justEndedClass } from "../../domain/next-class";
import { stickerOfOcc } from "../../domain/stickers";
import { termEnd } from "../semester";
import { Sticker } from "../Sticker";
import { ClassEndCard } from "../todo";
import { BackPill, BottomVeil, md, SearchButton, StickyHead, WD } from "../ui";
import { CalendarSheet } from "./calendar";
import { DateStrip } from "./DateStrip";
import { useNowMinutes, useToday } from "./hooks";
import { pressProps } from "./press";

export function TodayView({
  snap,
  anchor,
  setAnchor,
  onPick,
  onMenu,
  onSearch,
  onImport,
  onManual,
  onAdjustment,
  onNewSemester,
  onCapture,
  liftKey,
}: {
  snap: Snapshot;
  anchor: string;
  setAnchor: (d: string) => void;
  onPick: (o: Occurrence) => void;
  onMenu: (o: Occurrence, r: Rect, el: HTMLElement) => void;
  onSearch: () => void;
  onImport: () => void;
  onManual: () => void;
  onAdjustment: () => void;
  onNewSemester: () => void;
  onCapture: (kind: "camera" | "text", courseId?: string) => void;
  liftKey?: string;
}) {
  const today = useToday();
  const now = useNowMinutes();
  const [cal, setCal] = useState(false);
  const [expandedHolidays, setExpandedHolidays] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstDay = snap.semester.startDate < anchor ? snap.semester.startDate : anchor;
  const lastDay = termEnd(snap.semester) > anchor ? termEnd(snap.semester) : anchor;
  const [range, setRange] = useState(() => ({ anchor, start: addDays(anchor, -21), end: addDays(anchor, 34) }));
  if (range.anchor !== anchor)
    setRange({ anchor, start: addDays(anchor, -21), end: addDays(anchor, 34) });
  const start = range.anchor !== anchor ? (addDays(anchor, -21) < firstDay ? firstDay : addDays(anchor, -21)) : range.start < firstDay ? firstDay : range.start;
  const end = range.anchor !== anchor ? (addDays(anchor, 34) > lastDay ? lastDay : addDays(anchor, 34)) : range.end > lastDay ? lastDay : range.end;
  /* 吸顶标题下方的日期与日期条保持一致 */
  const dayTop = (sc: HTMLElement, el: HTMLElement) =>
    el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  const restoreRef = useRef<{ date: string; top: number } | null>(null);
  const jumpRef = useRef<string | null>(null);
  const holidayAnchorRef = useRef(new Map<string, number>());
  const toggleHoliday = (name: string, firstDate: string) => {
    const sc = scrollRef.current;
    const group = sc?.querySelector<HTMLElement>(`[data-group-start="${firstDate}"]`);
    const open = expandedHolidays.includes(name);
    if (group && sc) {
      const top = group.getBoundingClientRect().top;
      if (open) {
        const anchorTop = holidayAnchorRef.current.get(firstDate);
        if (anchorTop != null)
          sc.scrollTo({ top: sc.scrollTop + top - anchorTop, behavior: "smooth" });
      } else {
        holidayAnchorRef.current.set(firstDate, top);
      }
    }
    selectedGroupRef.current = view;
    setExpandedHolidays(xs => xs.includes(name) ? xs.filter(x => x !== name) : [...xs, name]);
  };
  useLayoutEffect(() => {
    const restore = restoreRef.current;
    if (!restore)
      return;
    restoreRef.current = null;
    const sc = scrollRef.current;
    const el = sc?.querySelector<HTMLElement>(`[data-day="${restore.date}"]`);
    if (sc && el)
      sc.scrollTop += el.getBoundingClientRect().top - restore.top;
  }, [start, end]);
  useLayoutEffect(() => {
    const target = jumpRef.current;
    if (!target)
      return;
    jumpRef.current = null;
    const sc = scrollRef.current;
    const el = sc?.querySelector<HTMLElement>(`[data-day="${target}"]`);
    if (sc && el)
      sc.scrollTop = Math.max(0, dayTop(sc, el) - ((sc.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) - 8);
  }, [start, end]);
  /* 底部日期条跟随滚动位置：滚到「明天」那段时选中项切到明天 */
  const [view, setView] = useState(anchor);
  const selectedGroupRef = useRef(anchor);
  /* anchor 变化时在渲染期同步选中项（React 推荐的「渲染期派生」写法，不进 effect） */
  const prevAnchorRef = useRef(anchor);
  if (prevAnchorRef.current !== anchor) {
    prevAnchorRef.current = anchor;
    setView(anchor);
  }
  const glidingRef = useRef(0);
  const onScroll = () => {
    const sc = scrollRef.current;
    if (!sc)
      return;
    if (glidingRef.current) {
      window.clearTimeout(glidingRef.current);
      glidingRef.current = window.setTimeout(() => { glidingRef.current = 0; onScroll(); }, 120);
      return;
    }
    const line = sc.getBoundingClientRect().top + ((sc.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) + 8;
    const sections = sc.querySelectorAll<HTMLElement>("[data-day]");
    let cur = sections[0]?.dataset.day ?? anchor;
    for (const el of sections) {
      if (el.getBoundingClientRect().top > line)
        break;
      const group = el.parentElement?.dataset;
      if (group?.groupStart) {
        if (el.dataset.day === group.groupStart)
          cur = selectedGroupRef.current >= group.groupStart && selectedGroupRef.current <= group.groupEnd! ? selectedGroupRef.current : group.groupStart;
      } else {
        cur = el.dataset.day!;
      }
    }
    const nearTop = sc.scrollTop < 250 && start > firstDay;
    const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 250 && end < lastDay;
    if ((nearTop || nearBottom) && !restoreRef.current) {
      const marker = Array.from(sections).find(el => el.getBoundingClientRect().top >= line) ?? sections[sections.length - 1];
      if (marker) {
        restoreRef.current = { date: marker.dataset.day!, top: marker.getBoundingClientRect().top };
        setRange(r => nearTop
          ? { ...r, start: addDays(start, -14) < firstDay ? firstDay : addDays(start, -14) }
          : { ...r, end: addDays(end, 14) > lastDay ? lastDay : addDays(end, 14) });
      }
    }
    setView(cur);
  };
  /* 点日期条：目标日已在时间线里就滚过去，不重建列表；不在才换锁定日 */
  const pickDay = (d: string) => {
    selectedGroupRef.current = d;
    const sc = scrollRef.current;
    const el = sc?.querySelector<HTMLElement>(`[data-day="${d}"]`);
    if (sc && el) {
      setView(d);
      window.clearTimeout(glidingRef.current);
      glidingRef.current = window.setTimeout(() => { glidingRef.current = 0; onScroll(); }, 120);
      sc.scrollTo({ top: Math.max(0, dayTop(sc, el) - ((sc.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) - 8), behavior: "smooth" });
    } else {
      jumpRef.current = d;
      setView(d);
      setRange({ anchor: d, start: addDays(d, -21), end: addDays(d, 34) });
      if (anchor !== d)
        setAnchor(d);
    }
  };

  const days = useMemo(() => {
    const out: { date: string; rel: string; occ: Occurrence[]; vacation: string | null; adjustment?: ScheduleAdjustment }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const vacation = inVacation(snap.semester, d);
      const occ = occurrencesOn(snap, d, !!vacation && expandedHolidays.includes(vacation));
      const rel = d === today ? "今天" : d === addDays(today, 1) ? "明天" : d === addDays(today, 2) ? "后天" : WD[weekdayOf(d)];
      out.push({ date: d, rel, occ, vacation, adjustment: snap.semester.scheduleAdjustments?.find(a => a.date === d) });
    }
    return out;
  }, [snap, start, end, today, expandedHolidays]);
  const timeline = useMemo(() => {
    const groups: ({ kind: "day"; day: typeof days[number] } | { kind: "vacation" | "free"; name: string; dates: typeof days })[] = [];
    for (const day of days) {
      const previous = groups.at(-1);
      if (day.vacation && expandedHolidays.includes(day.vacation)) {
        if (previous?.kind === "vacation" && previous.name === day.vacation)
          previous.dates.push(day);
        else
          groups.push({ kind: "vacation", name: day.vacation, dates: [day] });
      } else if (!day.adjustment && day.occ.length === 0) {
        const kind = day.vacation ? "vacation" : "free";
        const name = day.vacation ?? "无课";
        if (previous && previous.kind === kind && previous.name === name && (kind === "vacation" || weekdayOf(day.date) !== 1))
          previous.dates.push(day);
        else
          groups.push({ kind, name, dates: [day] });
      } else {
        groups.push({ kind: "day", day });
      }
    }
    return groups;
  }, [days]);
  const holidayRanges = useMemo(() => holidaysBetween(start, end), [start, end]);

  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const el = sc?.querySelector<HTMLElement>(`[data-day="${anchor}"]`);
    if (sc && el)
      sc.scrollTop = Math.max(0, dayTop(sc, el) - ((sc.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0) - 8);
  }, [anchor]);

  const shown = days.find(day => day.date === view);
  const shownOcc = shown?.occ ?? occurrencesOn(snap, view);
  const shownWeek = weekOf(snap.semester, view);
  const vac = inVacation(snap.semester, view);
  const remain = view === today ? shownOcc.filter(o => o.end > now && o.status !== "cancelled").length : shownOcc.length;
  const inTerm = shownWeek >= 1 && shownWeek <= snap.semester.totalWeeks;
  const nothingAtAll = snap.courses.length === 0 && snap.entries.length === 0;
  /* 刚下课那一刻：时间线里那节课下面直接给出记录入口 */
  const ended = useMemo(() => justEndedClass(snap, today, now), [snap, today, now]);
  const [endHidden, setEndHidden] = useState<string[]>([]);
  const endKey = ended ? `${ended.date}-${ended.courseId}-${ended.start}` : "";
  const showEnd = ended && !endHidden.includes(endKey);
  const termEndDay = termEnd(snap.semester);
  const afterTerm = view > termEndDay;

  return (
    <>
      <div
        ref={(el) => { scrollRef.current = el; }}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto pb-52.5 scrollbar-none"
      >
        <StickyHead bleed={0} className="px-5">
          <div className="flex items-start justify-between">
            <h1 className="text-[26px] font-extrabold tracking-[-.02em]">
              {md(view)}
              {" "}
              <span className="font-bold text-(--c-ink5)">{WD[weekdayOf(view)]}</span>
            </h1>
            <SearchButton onClick={onSearch} />
          </div>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            {inTerm
              ? (
                  <span>
                    第
                    {" "}
                    {shownWeek}
                    {" "}
                    周
                  </span>
                )
              : <span>学期外</span>}
            {inTerm && (
              <>
                <span className="h-3 w-px bg-(--c-line)" />
                <span>{shownWeek % 2 === 1 ? "单周" : "双周"}</span>
              </>
            )}
            <span className="h-3 w-px bg-(--c-line)" />
            {shownOcc.length > 0
              ? (
                  <span>
                    {shownOcc.length}
                    {" "}
                    节课
                    {view === today && (
                      <span className="text-(--c-ink5)">
                        ，剩
                        {remain}
                        {" "}
                        节
                      </span>
                    )}
                  </span>
                )
              : (
                  <span className="text-(--c-ink5)">{nothingAtAll ? "暂无课表" : vac ?? (afterTerm ? "学期已结束" : weekdayOf(view) >= 6 ? "周末无课" : "无课")}</span>
                )}
          </div>
        </StickyHead>

        {nothingAtAll && (
          <div className="mt-6 px-5">
            <div className="rounded-2xl bg-(--c-surface) px-4 py-3 text-[13px] font-semibold text-(--c-ink3)">
              暂无课表
              <button className="ml-4 text-(--c-accent)" onClick={onImport}>导入课表</button>
              <button className="ml-4 text-(--c-accent)" onClick={onManual}>手动添加</button>
            </div>
          </div>
        )}
        {afterTerm && !nothingAtAll && view === anchor && <div className="mt-6 px-5"><button className="text-[13px] font-semibold text-(--c-accent)" onClick={onNewSemester}>开始新学期</button></div>}
        {holidayRanges.length === 0 && snap.semester.vacations.length === 0 && (
          <div className="px-5 pt-4"><button onClick={onAdjustment} className="text-[12px] font-semibold text-(--c-ink4)">调休安排</button></div>
        )}
        <div className="mt-6 px-5">
          {timeline.map((item) => {
            if (item.kind !== "day") {
              const first = item.dates[0];
              const last = item.dates[item.dates.length - 1];
              const full = item.kind === "vacation"
                ? snap.semester.vacations.find(v => v.name === item.name && v.start <= first.date && v.end >= last.date)
                ?? (snap.semester.holidays === false ? undefined : holidayRanges.find(h => h.name === item.name && h.start <= first.date && h.end >= last.date))
                : undefined;
              const rangeStart = full?.start ?? first.date;
              const rangeEnd = full?.end ?? last.date;
              return (
                <Fragment key={`${item.kind}-${first.date}`}>
                  {weekdayOf(first.date) === 1 && first.date >= snap.semester.startDate && first.date <= termEndDay && !(item.kind === "vacation" && expandedHolidays.includes(item.name)) && (
                    <div className="flex items-center gap-3 py-5 text-[11px] font-semibold text-(--c-ink5)">
                      <span className="h-px flex-1 bg-(--c-line)" />第 {weekOf(snap.semester, first.date)} 周<span className="h-px flex-1 bg-(--c-line)" />
                    </div>
                  )}
                  <div data-group-start={first.date} data-group-end={last.date} className={`relative mb-6 overflow-visible rounded-2xl px-5 py-5 ${item.kind === "vacation" ? "bg-(--c-amber-soft)" : "bg-(--c-surface)"}`}>
                    {item.kind === "free" && item.dates.map(day => <span key={day.date} data-day={day.date} className="pointer-events-none absolute top-0 left-0 h-0 w-0" />)}
                    {item.kind === "vacation" && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold tracking-wide text-(--c-amber)">假期安排</span>
                        <div className="flex items-center gap-3">
                          <span />
                          <button onClick={onAdjustment} className="rounded-full bg-(--c-surface) px-3 py-1.5 text-[12px] font-bold text-(--c-amber)">调休安排</button>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 text-[20px] font-extrabold tracking-[-.02em] text-(--c-ink)">{item.name}</div>
                    <div className="mt-1 text-[13px] font-semibold tabular-nums text-(--c-ink3)">
                      {md(rangeStart)}
                      {rangeStart !== rangeEnd ? `—${md(rangeEnd)}` : ""}
                      {" "}
                      ·
                      {diffDays(rangeEnd, rangeStart) + 1}
                      {" "}
                      天
                    </div>
                    <AnimatePresence initial={false}>
                      {item.kind === "vacation" && expandedHolidays.includes(item.name) && (
                        <motion.div initial={{ height: 0, opacity: 0, y: 24 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: 18 }} transition={{ height: { duration: 0.65, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.48 }, y: { duration: 0.58, ease: [0.25, 1, 0.5, 1] } }} className="overflow-hidden">
                          {item.kind === "vacation" && weekdayOf(first.date) === 1 && first.date >= snap.semester.startDate && first.date <= termEndDay && (
                            <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold text-(--c-amber)">
                              <span className="h-px flex-1 bg-(--c-line)" />第 {weekOf(snap.semester, first.date)} 周<span className="h-px flex-1 bg-(--c-line)" />
                            </div>
                          )}
                          {item.dates.filter(day => day.occ.length > 0).map(day => (
                            <Fragment key={day.date}>
                              {weekdayOf(day.date) === 1 && day.date !== first.date && day.date >= snap.semester.startDate && day.date <= termEndDay && (
                                <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold text-(--c-amber)">
                                  <span className="h-px flex-1 bg-(--c-line)" />第 {weekOf(snap.semester, day.date)} 周<span className="h-px flex-1 bg-(--c-line)" />
                                </div>
                              )}
                              <div data-day={day.date} className={`mt-5 pt-4 ${day.date !== first.date && weekdayOf(day.date) !== 1 ? "border-t border-(--c-amber)/20" : ""}`}>
                                <div className="flex items-baseline justify-between pb-4">
                                  <div className="flex items-baseline gap-2.5">
                                    <span className="text-[17px] leading-none font-extrabold tracking-[-.02em]">{md(day.date)}</span>
                                    <span className="text-[12.5px] font-semibold text-(--c-ink4)">{WD[weekdayOf(day.date)]}</span>
                                  </div>
                                  <span className="text-[12px] font-semibold tabular-nums text-(--c-ink5)">{day.occ.length ? `${day.occ.length} 节假期课程` : "假期 · 无课"}</span>
                                </div>
                                {day.occ.map(o => {
                                  const sticker = stickerOfOcc(o, snap.courses);
                                  return (
                                    <button key={o.key} {...pressProps(() => onPick(o), (r, el) => onMenu(o, r, el))} className="flex w-full py-1.5 text-left active:scale-[.985]">
                                      <div className="w-11 flex-none pt-3.5">
                                        <div className="text-[11px] font-bold text-(--c-ink2)">{o.startPeriod === o.endPeriod ? `${o.startPeriod}节` : `${o.startPeriod}–${o.endPeriod}节`}</div>
                                        <div className="mt-1 text-[11px] font-medium tabular-nums text-(--c-ink4)">{fmtMinutes(o.start)}</div>
                                        <div className="text-[11px] font-medium tabular-nums text-(--c-ink5)">{fmtMinutes(o.end)}</div>
                                      </div>
                                      <div className="-my-1.5 ml-3 w-0.5 flex-none self-stretch bg-(--c-line)" />
                                      <div className="min-w-0 flex-1 pl-4">
                                        <div className="relative rounded-2xl bg-(--c-surface) px-4 py-3.5">
                                          <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                              <div className={`text-[16px] leading-tight font-bold tracking-[-.01em] ${o.status === "cancelled" ? "line-through" : ""}`}>{o.name}</div>
                                              <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-(--c-ink3)">
                                                <span className="min-w-0 truncate">{[o.location, o.teacher].filter(Boolean).join("，") || "—"}</span>
                                                {o.conflict && <span className="flex-none rounded-[7px] bg-(--c-amber-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-amber)">冲突</span>}
                                                {o.status === "moved" && <span className="flex-none rounded-[7px] bg-(--c-accent-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-accent)">已调课</span>}
                                                {o.status === "cancelled" && <span className="flex-none rounded-[7px] bg-(--c-surface2) px-2 py-0.75 text-[10.5px] font-bold text-(--c-ink3)">停课</span>}
                                                {o.status === "leave" && <span className="flex-none rounded-[7px] bg-(--c-rose-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-rose)">请假</span>}
                                              </div>
                                            </div>
                                            {sticker && <Sticker id={sticker} size={24} tilt={-4} className="flex-none" />}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </Fragment>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {item.kind === "vacation" && (
                      <button data-holiday-toggle aria-label={expandedHolidays.includes(item.name) ? "收起假期课程" : "展开假期课程"} onClick={() => toggleHoliday(item.name, first.date)} className="absolute bottom-[-20px] left-1/2 z-1 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-b-lg bg-(--c-amber-soft) text-(--c-amber) transition-transform active:scale-95">
                        {expandedHolidays.includes(item.name) ? <UpLine width={15} height={15} /> : <DownLine width={15} height={15} />}
                      </button>
                    )}
                  </div>
                </Fragment>
              );
            }
            const day = item.day;
            const nextKey = day.date === today
              ? day.occ.find(x => x.start > now && x.status !== "cancelled")?.key
              : undefined;
            const inClass = day.date === today && day.occ.some(x => x.start <= now && now < x.end && x.status !== "cancelled");
            const adjustment = day.adjustment;
            return (
              <Fragment key={day.date}>
                {weekdayOf(day.date) === 1 && day.date >= snap.semester.startDate && day.date <= termEndDay && (
                  <div className="flex items-center gap-3 py-5 text-[11px] font-semibold text-(--c-ink5)">
                    <span className="h-px flex-1 bg-(--c-line)" />
                    第
                    {" "}
                    {weekOf(snap.semester, day.date)}
                    {" "}
                    周
                    <span className="h-px flex-1 bg-(--c-line)" />
                  </div>
                )}
                <div data-day={day.date} className="min-h-22">
                  <div className="flex items-baseline justify-between pb-4">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[17px] leading-none font-extrabold tracking-[-.02em]">{day.rel}</span>
                      <span className="text-[12.5px] font-semibold text-(--c-ink4)">
                        {md(day.date)}
                        {day.rel !== WD[weekdayOf(day.date)] ? ` ${WD[weekdayOf(day.date)]}` : ""}
                      </span>
                    </div>
                    {day.occ.length > 0 && (
                      <span className="text-[12px] font-semibold tabular-nums text-(--c-ink5)">
                        {day.occ.length}
                        {" "}
                        节课，
                        {fmtMinutes(day.occ[0].start)}
                        {" "}
                        开始
                      </span>
                    )}
                  </div>
                  {day.vacation && day.occ.length > 0 && (
                    <div className="mb-4 rounded-xl bg-(--c-amber-soft) px-3 py-2 text-[12px] font-bold text-(--c-amber)">
                      {day.vacation}
                      {" "}
                      · 假期课程
                    </div>
                  )}
                  {day.occ.length === 0 && (
                    <div className="pb-7 text-[13.5px] font-semibold text-(--c-ink4)">
                      {adjustment ? "无课" : inVacation(snap.semester, day.date) ?? (weekdayOf(day.date) >= 6 ? "周末 · 无课" : "无课")}
                    </div>
                  )}
                  {adjustment && (
                    <div className="pb-4 text-[12px] font-semibold text-(--c-accent)">
                      调休 · 补第
                      {weekOf(snap.semester, adjustment.teachingDate)}
                      {" "}
                      周
                      {WD[weekdayOf(adjustment.teachingDate)]}
                      课程
                    </div>
                  )}
                  {day.occ.map((o, oi) => {
                    const isLast = oi === day.occ.length - 1;
                    const isToday = day.date === today;
                    const past = (isToday && o.end <= now) || day.date < today;
                    const nowOn = isToday && o.start <= now && now < o.end;
                    const pct = ((now - o.start) / Math.max(1, o.end - o.start)) * 100;
                    const sticker = stickerOfOcc(o, snap.courses);
                    return (
                      <Fragment key={o.key}>
                        <button
                          {...pressProps(() => onPick(o), (r, el) => onMenu(o, r, el))}
                          className={`flex w-full py-1.5 text-left transition-transform duration-150 ${liftKey === o.key ? "" : "active:scale-[.985]"}`}
                        >
                          <div className={`w-11 flex-none pt-3.5 ${past ? "opacity-50" : ""}`}>
                            <div className="text-[11px] font-bold text-(--c-ink2)">{o.startPeriod === o.endPeriod ? `${o.startPeriod}节` : `${o.startPeriod}–${o.endPeriod}节`}</div>
                            <div className="mt-1 text-[11px] font-medium tabular-nums text-(--c-ink4)">{fmtMinutes(o.start)}</div>
                            <div className="text-[11px] font-medium tabular-nums text-(--c-ink5)">{fmtMinutes(o.end)}</div>
                          </div>
                          {/* 时间轴在一天里贯穿，最后一节下方留出与日期标题下方等高的空白 */}
                          <div className={`-my-1.5 ml-3 w-0.5 flex-none self-stretch ${isLast ? "pb-7" : ""}`}>
                            <div className="relative h-full bg-(--c-line)">
                              {past && <i className="absolute inset-0 bg-(--c-accent)" />}
                              {nowOn && (
                                <>
                                  <i className="absolute inset-x-0 top-0 bg-(--c-accent)" style={{ height: `${pct}%` }} />
                                  <i className="absolute left-1/2 h-2.25 w-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-(--c-accent) bg-(--c-surface)" style={{ top: `${pct}%` }} />
                                </>
                              )}
                            </div>
                          </div>
                          <div className={`min-w-0 flex-1 pl-4 ${isLast ? "pb-7" : ""} ${past || o.status === "cancelled" ? "opacity-50" : ""}`}>
                            {/* 每节课一张卡；右侧竖列放学科贴纸和状态标签，右边缘对齐，贴纸随卡片一起抬起 */}
                            <div data-lift className="relative rounded-2xl bg-(--c-surface) px-4 py-3.5">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className={`text-[16px] leading-tight font-bold tracking-[-.01em] ${o.status === "cancelled" ? "line-through" : ""}`}>{o.name}</div>
                                  <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-(--c-ink3)">
                                    <span className="min-w-0 truncate">{[o.location, o.teacher].filter(Boolean).join("，") || "—"}</span>
                                    {o.conflict && <span className="flex-none rounded-[7px] bg-(--c-amber-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-amber)">冲突</span>}
                                    {o.status === "moved" && <span className="flex-none rounded-[7px] bg-(--c-accent-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-accent)">已调课</span>}
                                    {o.status === "cancelled" && <span className="flex-none rounded-[7px] bg-(--c-surface2) px-2 py-0.75 text-[10.5px] font-bold text-(--c-ink3)">停课</span>}
                                    {o.status === "leave" && <span className="flex-none rounded-[7px] bg-(--c-rose-soft) px-2 py-0.75 text-[10.5px] font-bold text-(--c-rose)">请假</span>}
                                    {o.muted && o.status === "normal" && !past && <span className="flex-none rounded-[7px] bg-(--c-surface2) px-2 py-0.75 text-[10.5px] font-bold text-(--c-ink3)">静音</span>}
                                  </div>
                                </div>
                                {sticker && <Sticker id={sticker} size={24} tilt={-4} className="flex-none" />}
                              </div>
                              {nowOn && (
                                <div className="mt-1.5 text-[12px] font-bold tabular-nums text-(--c-accent)">
                                  上课中，现在
                                  {fmtMinutes(now)}
                                  ，还剩
                                  {fmtDuration(o.end - now)}
                                </div>
                              )}
                              {!nowOn && o.key === nextKey && (!inClass && o.start - now <= 60
                                ? (
                                    <div className="mt-1.5 text-[12px] font-bold tabular-nums text-(--c-accent)">
                                      还有
                                      {fmtDuration(o.start - now)}
                                      ，
                                      {fmtMinutes(o.start)}
                                      {" "}
                                      开始
                                    </div>
                                  )
                                : (
                                    <div className="mt-1.5 text-[12px] font-semibold tabular-nums text-(--c-ink3)">
                                      下一节，
                                      {fmtMinutes(o.start)}
                                      {" "}
                                      开始
                                    </div>
                                  )
                              )}
                            </div>
                          </div>
                        </button>
                        {showEnd && ended && day.date === ended.date && o.courseId === ended.courseId && o.start === ended.start && (
                          <ClassEndCard
                            moment={ended}
                            onCamera={() => onCapture("camera", ended.courseId)}
                            onText={() => onCapture("text", ended.courseId)}
                            onDismiss={() => setEndHidden(s => [...s, endKey])}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <BottomVeil height={210} />
      <BackPill show={!cal && view !== today} label="回到今天" bottom="calc(152px + max(24px, env(safe-area-inset-bottom)))" onClick={() => pickDay(today)} />
      <AnimatePresence initial={false}>
        {!cal && <DateStrip snap={snap} anchor={view} onPick={pickDay} onCalendar={() => setCal(true)} />}
      </AnimatePresence>
      {cal && <CalendarSheet snap={snap} mode="day" anchor={view} onPick={pickDay} onClose={() => setCal(false)} />}
    </>
  );
}
