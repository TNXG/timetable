import type { Snapshot } from "../../domain/engine";
import type { Semester } from "../../domain/types";
/** 日历面板：整学期连续月份，只能上下滚动；从底部滑入滑出 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, weekdayOf, weekOf } from "../../domain/dates";
import { occurrencesOn } from "../../domain/engine";
import { todayStr } from "../semester";
import { Sheet, TextAction, WD_SHORT } from "../ui";

/** 一个月的网格：只在月份 / 课程数 / 选中 / 模式变化时重渲染，滚动不碰它 */
const MonthGrid = memo(({ month, sem, counts, anchor, today, mode, onPick }: {
  month: string;
  sem: Semester;
  counts: Map<string, number>;
  anchor: string;
  today: string;
  mode: "day" | "week";
  onPick: (d: string) => void;
}) => {
  const rows = useMemo(() => {
    const lead = weekdayOf(`${month}-01`) - 1;
    const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    /* 每个格子自带 key：日期格用日期本身，补位格用「月 + 位置」，渲染时不再取下标 */
    const cells: { key: string; date: string | null }[] = [
      ...Array.from({ length: lead }, (_, i) => ({ key: `${month}-lead-${i}`, date: null })),
      ...Array.from({ length: total }, (_, i) => {
        const d = `${month}-${String(i + 1).padStart(2, "0")}`;
        return { key: d, date: d };
      }),
    ];
    while (cells.length % 7 !== 0) cells.push({ key: `${month}-tail-${cells.length}`, date: null });
    const out: { key: string; cells: { key: string; date: string | null }[] }[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const row = cells.slice(i, i + 7);
      out.push({ key: row.find(c => c.date)?.key ?? `${month}-row-${i / 7}`, cells: row });
    }
    return out;
  }, [month]);
  const rowWeek = (row: { date: string | null }[]) => {
    const d = row.find(c => c.date)?.date;
    return d ? weekOf(sem, d) : 0;
  };
  const anchorWeek = weekOf(sem, anchor);
  return (
    <div className="space-y-0.75">
      {rows.map(({ key: rowKey, cells }) => {
        const wk = rowWeek(cells);
        const rowOn = mode === "week" && wk === anchorWeek;
        return (
          <div key={rowKey} className={`flex gap-1.25 rounded-[12px] ${rowOn ? "bg-(--c-accent-soft)" : ""}`}>
            <div className="flex w-7 flex-none items-center justify-center">
              <span className={`text-[10.5px] font-bold tabular-nums ${rowOn ? "text-(--c-accent)" : "text-(--c-ink5)"}`}>{wk >= 1 && wk <= sem.totalWeeks ? wk : ""}</span>
            </div>
            {cells.map(({ key: cellKey, date: d }) => {
              if (!d)
                return <div key={cellKey} className="flex-1" />;
              const n = counts.get(d) ?? 0;
              const isToday = d === today;
              const sel = d === anchor;
              return (
                <button key={cellKey} onClick={() => onPick(d)} className="relative flex flex-1 flex-col items-center py-2.25">
                  {sel && <i className="absolute -inset-x-1 inset-y-0 rounded-[13px] bg-(--c-accent-soft)" />}
                  <span
                    className={`relative z-10 flex h-[22px] w-[22px] items-center justify-center text-[15px] leading-none font-bold tabular-nums ${
                      isToday || sel ? "text-(--c-accent)" : n ? "text-(--c-ink)" : "text-(--c-ink5)"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className={`relative z-10 mt-1 h-[3px] w-[3px] rounded-full ${n ? (isToday || sel ? "bg-(--c-accent)" : "bg-(--c-ink5)") : "bg-transparent"}`} />
                  {n > 0 && <span className={`absolute top-[3px] right-[2px] z-10 text-[9px] font-bold tabular-nums ${isToday || sel ? "text-(--c-accent2)" : "text-(--c-ink5)"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

/** 月标题：吸顶后下沿出现羽化；只有这一小块跟着滚动位置重渲染 */
function MonthHead({ month, sem, stuck }: { month: string; sem: Semester; stuck: boolean }) {
  const first = weekOf(sem, `${month}-01`);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const last = weekOf(sem, `${month}-${String(lastDay).padStart(2, "0")}`);
  return (
    <div className={`sticky top-0 z-[20] flex items-baseline gap-2.5 bg-(--c-surface) px-1 py-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-[linear-gradient(180deg,var(--c-surface),transparent)] after:transition-opacity after:duration-200 after:content-[''] ${stuck ? "after:opacity-100" : "after:opacity-0"}`}>
      <span className="text-[19px] font-extrabold tracking-[-.02em]">
        {Number(month.slice(5, 7))}
        月
      </span>
      <span className="text-[12px] font-semibold text-(--c-ink4)">
        {sem.name}
        {last >= 1 ? ` 第 ${Math.max(1, first)}–${Math.min(sem.totalWeeks, Math.max(1, last))} 周` : ""}
      </span>
    </div>
  );
}

export function CalendarSheet({ snap, mode, anchor, onPick, onClose }: { snap: Snapshot; mode: "day" | "week"; anchor: string; onPick: (d: string) => void; onClose: () => void }) {
  const today = todayStr();
  const sem = snap.semester;
  const scrollRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<Record<string, HTMLDivElement>>({});
  const dismissRef = useRef<(() => void) | null>(null);
  /** 选日期后先播完抽屉退出动画，再由 onExitComplete 卸载 */
  const pick = useCallback((d: string) => { onPick(d); dismissRef.current?.(); }, [onPick]);

  /** 学期覆盖到的月份，连续排列，直接上下滚动 */
  const months = useMemo(() => {
    const out: string[] = [];
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const end = new Date(`${addDays(sem.startDate, sem.totalWeeks * 7 - 1)}T00:00:00`);
    let cur = new Date(`${sem.startDate}T00:00:00`);
    cur.setDate(1);
    while (cur <= end) {
      out.push(key(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    for (const m of [anchor.slice(0, 7), today.slice(0, 7)]) {
      if (!out.includes(m))
        out.push(m);
    }
    return out.sort();
  }, [sem, anchor, today]);

  /** 每天的课程数：整个范围算一次，格子里只查表 */
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    const lo = `${months[0]}-01`;
    const hiM = months[months.length - 1];
    const hi = `${hiM}-${String(new Date(Number(hiM.slice(0, 4)), Number(hiM.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
    for (let d = lo; d <= hi; d = addDays(d, 1)) {
      const n = occurrencesOn(snap, d).length;
      if (n)
        m.set(d, n);
    }
    return m;
  }, [snap, months]);

  const scrollTo = (month: string) => {
    const node = marksRef.current[month];
    const box = scrollRef.current?.parentElement;
    if (node && box)
      box.scrollTop = node.offsetTop - box.offsetTop;
  };

  /** 哪个月标题正吸在顶上 */
  const [stuckMonth, setStuckMonth] = useState<string | null>(null);
  useEffect(() => {
    scrollTo(anchor.slice(0, 7));
    const box = scrollRef.current?.parentElement;
    if (!box)
      return;
    const onScroll = () => {
      const top = box.scrollTop;
      let cur: string | null = null;
      for (const m of months) {
        const node = marksRef.current[m];
        if (node && top > node.offsetTop - box.offsetTop + 1)
          cur = m;
      }
      setStuckMonth(cur);
    };
    /* 首帧先按初始状态渲染，下一帧再量一次：避免挂载后同帧改状态 */
    const raf = requestAnimationFrame(onScroll);
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      box.removeEventListener("scroll", onScroll);
    };
  }, [anchor, months]);

  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismissRef}
      className="px-4"
      header={(
        <div className="flex gap-1.25 px-4 pt-1 pb-2">
          <div className="w-7 flex-none" />
          {[1, 2, 3, 4, 5, 6, 7].map(w => (
            <div key={w} className="flex-1 text-center text-[10.5px] font-semibold text-(--c-ink4)">{WD_SHORT[w]}</div>
          ))}
        </div>
      )}
      footer={(
        <div className="flex justify-end px-5 pt-3">
          <TextAction onClick={() => { scrollTo(today.slice(0, 7)); pick(today); }}>{mode === "day" ? "今天" : "本周"}</TextAction>
        </div>
      )}
    >
      <div ref={scrollRef} className="max-h-full">
        {months.map(month => (
          <div
            key={month}
            ref={(el) => {
              if (el)
                marksRef.current[month] = el;
            }}
            className="pb-4"
          >
            <MonthHead month={month} sem={sem} stuck={stuckMonth === month} />
            <MonthGrid month={month} sem={sem} counts={counts} anchor={anchor} today={today} mode={mode} onPick={pick} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
