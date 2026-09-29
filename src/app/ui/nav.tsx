import { motion } from "motion/react";
import React from "react";
import CalendarLine from "~icons/mingcute/calendar-line";
import Home2Line from "~icons/mingcute/home-2-line";
import LeftLine from "~icons/mingcute/left-line";
import Settings3Line from "~icons/mingcute/settings-3-line";
import TaskLine from "~icons/mingcute/task-line";
import { useImeShrink } from "../ime";
import { dockStyle } from "./constants";

export const NAV_ITEMS: [React.ReactNode, string][] = [
  [<Home2Line key="home" />, "今天"],
  [<CalendarLine key="calendar" />, "课表"],
  [<TaskLine key="task" />, "待办"],
  [<Settings3Line key="settings" />, "我的"],
];

export function Nav({ active, onTab, hidden }: { active: number; onTab: (i: number) => void; hidden?: boolean }) {
  const shrink = useImeShrink();
  return (
    <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 z-8" style={{ y: shrink }}>
      <motion.div
        animate={{ y: hidden ? 130 : 0, opacity: hidden ? 0 : 1 }}
        transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
        className="pointer-events-none absolute inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] flex justify-center px-4"
      >
        <div className="pointer-events-auto flex w-[92%] items-center justify-between rounded-full p-1.25" style={dockStyle}>
          {NAV_ITEMS.map(([ic, label], i) => {
            const on = i === active;
            return (
              <button
                key={label}
                onClick={() => onTab(i)}
                className="relative flex flex-1 flex-col items-center gap-0.5 px-1 pt-1.5 pb-1.25 transition-transform duration-150 active:scale-[.94]"
              >
                {on && (
                  <motion.i
                    layoutId="nav-indicator"
                    className="absolute inset-x-px inset-y-0 rounded-full bg-(--c-accent-soft)"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className={`relative z-10 h-4.75 w-4.75 transition-colors duration-200 [&>svg]:h-full [&>svg]:w-full ${on ? "text-(--c-accent)" : "text-(--c-ink)"}`}>{ic}</span>
                <span className={`relative z-10 text-[9.5px] font-bold transition-colors duration-200 ${on ? "text-(--c-accent)" : "text-(--c-ink)"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] bg-(--c-surface) p-5 ${className}`}>{children}</div>;
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
      <LeftLine width={14} height={14} className="text-(--c-ink)" />
    </button>
  );
}
