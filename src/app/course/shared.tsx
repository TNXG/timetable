/** 课程内页共用的小件：字段行、节次选择、规则文案 */
import { useEffect, useRef } from 'react'
import { fmtMinutes, weekdayOf } from '../../domain/dates'
import { WD, md } from '../ui'

/** 格式化手机号：138 **** 1234 */
export function formatPhone(phone: string): string {
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`
}

/** 规则的钟点区间：14:30 – 16:00；节次表里查不到时回退到节次 */
export function ruleClock(grid: { index: number; start: number; end: number }[] | undefined, r: { startPeriod: number; endPeriod: number }): string {
  const s = grid?.find((t) => t.index === r.startPeriod)
  const e = grid?.find((t) => t.index === r.endPeriod)
  return s && e ? `${fmtMinutes(s.start)} – ${fmtMinutes(e.end)}` : rulePeriods(r)
}

export function rulePeriods(r: { startPeriod: number; endPeriod: number }): string {
  return r.startPeriod === r.endPeriod ? `第 ${r.startPeriod} 节` : `第 ${r.startPeriod}–${r.endPeriod} 节`
}

export function sortRules<T extends { weekday: number; startPeriod: number }>(rules: T[]): T[] {
  return [...rules].sort((a, b) => a.weekday - b.weekday || a.startPeriod - b.startPeriod)
}

/** 同一天前后相连、地点与周次相同的规则合并成一段：第 6–7 节 + 第 8–9 节 → 14:30 – 17:40 */
export function mergeRules<T extends { weekday: number; startPeriod: number; endPeriod: number; location?: string; weeksMask: bigint }>(rules: T[]) {
  const out: { weekday: number; startPeriod: number; endPeriod: number; location?: string; weeksMask: bigint }[] = []
  for (const r of sortRules(rules)) {
    const last = out[out.length - 1]
    if (last && last.weekday === r.weekday && last.endPeriod + 1 === r.startPeriod && last.location === r.location && last.weeksMask === r.weeksMask) {
      last.endPeriod = r.endPeriod
    } else {
      out.push({ weekday: r.weekday, startPeriod: r.startPeriod, endPeriod: r.endPeriod, location: r.location, weeksMask: r.weeksMask })
    }
  }
  return out
}

/** 具体某天的口语化说法：今天 / 明天 / 3 天后 周四 / 9月7日 周一 */
export function dayLabel(date: string, today: string): string {
  const diff = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  const wd = WD[weekdayOf(date)]
  if (diff > 2 && diff < 14) return `${diff} 天后 ${wd}`
  return `${md(date)} ${wd}`
}

export function PageFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">{children}</div>
  )
}

/** 节次选择：横向 1..n，显示所选区间的钟点 */
export function PeriodPicker({
  grid, sp, ep, onPick,
}: {
  grid: { index: number; start: number; end: number }[]
  sp: number
  ep: number
  onPick: (sp: number, ep: number) => void
}) {
  const s = grid.find((t) => t.index === sp)
  const e = grid.find((t) => t.index === ep)
  /* 和颜色选择器同一套：固定宽横向滚动 + 两端渐变；挂载时把所选区间滚到中间 */
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = row.current
    if (!el) return
    const a = el.querySelector<HTMLElement>(`[data-p="${sp}"]`)
    const b = el.querySelector<HTMLElement>(`[data-p="${ep}"]`)
    if (!a || !b) return
    el.scrollLeft = Math.max(0, (a.offsetLeft + b.offsetLeft + b.offsetWidth) / 2 - el.clientWidth / 2)
  }, [])
  const fade = 'linear-gradient(to right, transparent, #000 16px, #000 calc(100% - 16px), transparent)'
  return (
    <div className="rounded-[16px] bg-(--c-surface) py-3.5">
      <div className="flex items-baseline justify-between px-4">
        <span className="text-[12.5px] font-medium text-(--c-ink4)">节次</span>
        <span className="text-[13px] font-bold tabular-nums text-(--c-ink)">
          {sp === ep ? `第 ${sp} 节` : `第 ${sp}–${ep} 节`}
          {s && e && <span className="ml-2 font-semibold text-(--c-ink4)">{fmtMinutes(s.start)} – {fmtMinutes(e.end)}</span>}
        </span>
      </div>
      <div
        ref={row}
        className="mt-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        {grid.map((t) => {
          const on = t.index >= sp && t.index <= ep
          return (
            <button
              key={t.index}
              data-p={t.index}
              onClick={() => (t.index < sp ? onPick(t.index, ep) : t.index > ep ? onPick(sp, t.index) : onPick(t.index, t.index))}
              className={`h-[30px] w-[38px] flex-none rounded-[9px] text-[12px] font-bold tabular-nums transition-colors ${on ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-bg) text-(--c-ink4)'}`}
            >
              {t.index}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PageBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex-1 overflow-y-auto px-5 pb-[130px] [scrollbar-width:none] ${className}`}>
      {children}
    </div>
  )
}
