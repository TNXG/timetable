import { AnimatePresence, motion } from "motion/react";
import React from "react";
import ArrowUpLine from "~icons/mingcute/arrow-up-line";
import BackLine from "~icons/mingcute/back-line";
import CameraLine from "~icons/mingcute/camera-line";
import { dockStyle, SHEET, tint } from "./constants";

export const CameraIcon = ({ size = 18, stroke = "var(--c-ink)" }: { size?: number; stroke?: string }) => <CameraLine width={size} height={size} className="" style={{ color: stroke }} />;

export const ArrowUpIcon = ({ stroke = "#fff" }: { stroke?: string }) => <ArrowUpLine width={16} height={16} style={{ color: stroke }} />;

/** 课程名放进胶囊时的字数上限，超出截掉加“…” */
export const CHIP_MAX = 8;
export function clipText(s: string, max = CHIP_MAX) {
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : s;
}

/** 胶囊标签：课程、截止、分类 */
export function Chip({ color, children, tone = "plain", onClick, shrink = false }: {
  color?: string;
  children: React.ReactNode;
  tone?: "plain" | "accent";
  onClick?: () => void;
  /** 放在一行里时允许被挤窄（文字省略），不把同行其他控件顶出去 */
  shrink?: boolean;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex h-7.5 max-w-40 min-w-0 ${shrink ? "shrink" : "flex-none"} items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold ${tone === "accent" ? "bg-(--c-accent-soft) text-(--c-accent)" : "bg-(--c-surface2) text-(--c-ink2)"} ${onClick ? "transition-transform duration-150 active:scale-[.96]" : ""}`}
    >
      {color && <span className="h-1.75 w-1.75 flex-none rounded-full" style={{ background: color }} />}
      <span className="min-w-0 truncate">{children}</span>
    </Tag>
  );
}

/** 快速记录胶囊：相机 + 一句话，压在底栏上面；点文字后这个胶囊本身长成输入卡（共享 layoutId） */
export const COMPOSE_RADIUS = 26;
export function composeLayoutId(courseId?: string) {
  return courseId ? `compose-${courseId}` : "compose";
}

export function QuickBar({ onCamera, onText, placeholder = "新待办", layoutId = composeLayoutId() }: {
  onCamera: () => void;
  onText: () => void;
  placeholder?: string;
  layoutId?: string;
}) {
  return (
    <div className="absolute inset-x-4 bottom-23 z-9">
      <motion.div layoutId={layoutId} transition={SHEET} className="flex items-center gap-2 p-1.5 pr-3.5" style={{ ...dockStyle, borderRadius: COMPOSE_RADIUS }}>
        <button
          onClick={onCamera}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-(--c-surface2) transition-transform duration-150 active:scale-[.92]"
        >
          <CameraIcon />
        </button>
        <button onClick={onText} className="flex-1 pl-1 text-left text-[15px] font-medium text-(--c-ink4)">{placeholder}</button>
      </motion.div>
    </div>
  );
}

/** 日期条下的全天状态带：学期已结束、假期 */
export function WeekBand({ tone, title, meta }: { tone: "gray" | "amber"; title: string; meta: string }) {
  const c = tone === "amber" ? "#C29155" : "#8A8E97";
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: tint(c, 12) }}>
      <i className="h-3.5 w-0.75 flex-none rounded-full" style={{ background: c }} />
      <span className="text-[11.5px] font-bold" style={{ color: `color-mix(in srgb, ${c} 80%, var(--c-ink-mix))` }}>{title}</span>
      <span className="ml-auto text-[10.5px] font-semibold tabular-nums" style={{ color: `color-mix(in srgb, ${c} 65%, var(--c-ink-mix))` }}>{meta}</span>
    </div>
  );
}

/** 停课的课：留在原时段的虚线幽灵块 */
export function GhostEvent({ name, color, top, h, note = "停课" }: {
  name: string;
  color: string;
  top: number;
  h: number;
  note?: string;
}) {
  return (
    <div
      className="absolute inset-x-0 overflow-hidden rounded-[9px] border-[1.5px] border-dashed px-1 py-1.5 text-[9.5px] leading-[1.35] font-bold"
      style={{ top, height: h, borderColor: tint(color, 45), color: `color-mix(in srgb, ${color} 70%, var(--c-ink-mix))` }}
    >
      <span className="opacity-70">{name}</span>
      <div className="mt-0.5 text-[8.5px] leading-[1.3] font-semibold opacity-60">{note}</div>
    </div>
  );
}

/** 底栏上方的悬浮胶囊动作 */
export function FloatPills({ actions }: { actions: [string, () => void][] }) {
  return (
    <div className="absolute inset-x-0 bottom-25 z-9 flex justify-center gap-2">
      {actions.map(([label, fn], i) => (
        <button
          key={label}
          onClick={fn}
          className={`flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-transform duration-150 active:scale-[.96] ${i === 0 ? "text-(--c-accent)" : "text-(--c-ink)"}`}
          style={dockStyle}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 离开了「现在」时浮出的回位胶囊；bottom 由页面按自己的底部控件高度给 */
export function BackPill({ show, label, bottom, onClick }: { show: boolean; label: string; bottom: string; onClick: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="back"
          initial={{ y: 14, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 14, opacity: 0, scale: 0.94 }}
          transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
          className="pointer-events-none absolute inset-x-0 z-9 flex justify-center"
          style={{ bottom }}
        >
          <button
            onClick={onClick}
            className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full pr-4 pl-3 text-[13px] font-bold text-(--c-accent) transition-transform duration-150 active:scale-[.96]"
            style={dockStyle}
          >
            <BackLine width={14} height={14} />
            {label}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
