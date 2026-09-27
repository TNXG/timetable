import type { Snapshot } from "../../domain/engine";
import { motion } from "motion/react";
/** 底部日期条：整学期连续横向滚动（原生惯性），选中项居中；只在关掉日历重新出现时播出场动画 */
import { useEffect, useMemo, useRef } from "react";
import { addDays, weekdayOf } from "../../domain/dates";
import { occurrencesOn } from "../../domain/engine";
import { mondayOf, todayStr } from "../semester";
import { dockStyle, SPRING, WD } from "../ui";

/* ---------------- 日期条 + 月历 ---------------- */

/* 日期条：整学期连续横向滚动（原生惯性），选中项居中；只在关掉日历重新出现时播出场动画 */
export function DateStrip({ snap, anchor, onPick, onCalendar }: { snap: Snapshot; anchor: string; onPick: (d: string) => void; onCalendar: () => void }) {
  const today = todayStr();
  const sem = snap.semester;
  const days = useMemo(() => {
    const lo = [mondayOf(sem.startDate), mondayOf(addDays(today, -28)), mondayOf(anchor)].sort()[0];
    const hi = [addDays(sem.startDate, sem.totalWeeks * 7 + 6), addDays(today, 34), addDays(anchor, 6)].sort().pop()!;
    const out: string[] = [];
    for (let d = lo; d <= hi; d = addDays(d, 1)) out.push(d);
    return out;
  }, [sem, today, anchor]);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef(true);
  useEffect(() => {
    const sc = boxRef.current;
    const el = sc?.querySelector<HTMLElement>(`[data-d="${anchor}"]`);
    if (!sc || !el)
      return;
    const left = el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2;
    sc.scrollTo({ left, behavior: firstRef.current ? "auto" : "smooth" });
    firstRef.current = false;
  }, [anchor, days]);
  return (
    <motion.div
      initial={{ y: 26, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 26, opacity: 0 }}
      transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
      className="absolute inset-x-4 bottom-[calc(80px+max(24px,env(safe-area-inset-bottom)))] z-9 flex items-stretch rounded-3xl py-1.5 pr-1"
      style={dockStyle}
    >
      <div
        ref={boxRef}
        className="flex flex-1 items-stretch gap-1.25 overflow-x-auto px-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch", maskImage: "linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 10px), transparent)" }}
      >
        {days.map((d) => {
          const on = d === anchor;
          const past = d < today && !on;
          const n = occurrencesOn(snap, d).length;
          const monthStart = d.slice(8) === "01";
          return (
            <button key={d} data-d={d} onClick={() => onPick(d)} className="relative flex w-11.5 flex-none flex-col items-center py-1.25" style={{ scrollSnapAlign: "center" }}>
              {on && (
                <motion.i
                  layoutId="date-strip-indicator"
                  transition={SPRING}
                  className="absolute -inset-x-0.5 inset-y-0 rounded-[13px] bg-(--c-accent-soft)"
                />
              )}
              <span
                className={`relative z-10 text-[17px] leading-[1.2] font-bold tabular-nums ${on ? "text-(--c-accent)" : past ? "text-(--c-ink5)" : "text-(--c-ink)"}`}
              >
                {Number(d.slice(8))}
              </span>
              <span className={`relative z-10 mt-0.5 text-[10.5px] font-semibold ${on ? "text-(--c-accent)" : past ? "text-(--c-ink5)" : "text-(--c-ink4)"}`}>
                {d === today ? "今天" : monthStart ? `${Number(d.slice(5, 7))}月` : WD[weekdayOf(d)]}
              </span>
              {n > 0 && <span className={`absolute top-[3px] right-[2px] z-10 text-[9px] font-bold tabular-nums ${on ? "text-(--c-accent2)" : past ? "text-(--c-line)" : "text-(--c-ink5)"}`}>{n}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onCalendar} className="flex w-9 flex-none items-center justify-center">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--c-ink2)" }} strokeWidth="1.9">
          <rect x="3" y="4" width="18" height="17" rx="4" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </button>
    </motion.div>
  );
}
