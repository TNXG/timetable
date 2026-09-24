import React, { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { weekdayOf } from '../../domain/dates'
import { haptic } from '../widgets'
import { FADE, SHEET, WD, WD_SHORT } from './constants'
import { Sheet } from './sheet'
import { SheetClose, SheetHead, PrimaryButton } from './actions'
import { Wheel } from './wheel'

/* ---------------- 月历 / 时刻滚轮 / 日期与时刻选择卡 ---------------- */

/** 同一区域内互斥的两层内容：只挂载当前层（不存在的层不可能接到触摸），进入时 200ms 淡入 */
export function SwapLayer({ id, className = '', children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE} className={`absolute inset-0 ${className}`}>
      {children}
    </motion.div>
  )
}

export const CAL_ROW = 42
/** 月历区域固定高度：月份行 + 星期行 + 六行日期；切成年月日滚轮时也用这个高度，不跳 */
export const CAL_H = 40 + 26 + CAL_ROW * 6
export const SWAP = { duration: 0.2 } as const

const pad2 = (n: number) => String(n).padStart(2, '0')
export const ymOf = (d: string) => d.slice(0, 7)
export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()
export const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`
export const addDaysStr = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00`)
  x.setDate(x.getDate() + n)
  return ymd(x.getFullYear(), x.getMonth() + 1, x.getDate())
}
export const todayYmd = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()) }
const shiftMonth = (ym: string, n: number) => {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  return `${y + Math.floor(m / 12)}-${pad2(((m % 12) + 12) % 12 + 1)}`
}
/** 六行七列，周一起；不足处用上月末与下月初补齐 */
function calendarCells(ym: string): string[] {
  const first = `${ym}-01`
  const lead = weekdayOf(first) - 1
  return Array.from({ length: 42 }, (_, i) => addDaysStr(first, i - lead))
}

const CalArrow = ({ dir }: { dir: -1 | 1 }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir < 0 ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
  </svg>
)

/**
 * 月历：上面「‹ 2026年9月 ▾ ›」，点月份标题切成年/月/日滚轮；选中日主题色圆，今天主题色字。
 * 高度固定 CAL_H，月份切换左右滑一点并淡入。
 */
export function Calendar({ value, onChange, today = todayYmd() }: { value: string; onChange: (d: string) => void; today?: string }) {
  const d = value || today
  const [view, setView] = useState<'cal' | 'ym'>('cal')
  const [month, setMonth] = useState(ymOf(d))
  const [dir, setDir] = useState(1)
  const goMonth = (n: number) => { setDir(n); setMonth((x) => shiftMonth(x, n)) }
  const pick = (x: string) => {
    if (x !== d) haptic('selection')
    onChange(x)
    if (ymOf(x) !== month) { setDir(x > month ? 1 : -1); setMonth(ymOf(x)) }
  }

  const y0 = Number(today.slice(0, 4))
  const years = useMemo(() => Array.from({ length: 4 }, (_, i) => `${y0 - 1 + i}年`), [y0])
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${i + 1}月`), [])
  const dy = Number(d.slice(0, 4))
  const dm = Number(d.slice(5, 7))
  const dd = Number(d.slice(8))
  const mdays = useMemo(() => Array.from({ length: daysInMonth(dy, dm) }, (_, i) => `${i + 1}日`), [dy, dm])
  const setYmd = (y: number, mo: number, day: number) => pick(ymd(y, mo, Math.min(day, daysInMonth(y, mo))))
  const cells = useMemo(() => calendarCells(month), [month])
  /* 选中日的主题色圆按行列定位、在格子间滑动；不用 layoutId，卡片推入时不会被量到半路的位置 */
  const selIdx = ymOf(d) === month ? cells.indexOf(d) : -1

  const cal = view === 'cal'
  return (
    <div className="relative" style={{ height: CAL_H }}>
      {cal ? (
      <SwapLayer id="cal">
        <div className="flex h-10 items-center justify-between">
          <button onClick={() => goMonth(-1)} className="flex h-10 w-10 items-center justify-center transition-opacity active:opacity-50"><CalArrow dir={-1} /></button>
          <button onClick={() => setView('ym')} className="flex items-center gap-1 text-[15px] font-bold text-(--c-ink) transition-opacity active:opacity-50">
            {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--c-ink3)"><path d="M6 9h12l-6 7z" /></svg>
          </button>
          <button onClick={() => goMonth(1)} className="flex h-10 w-10 items-center justify-center transition-opacity active:opacity-50"><CalArrow dir={1} /></button>
        </div>
        <div className="grid h-[26px] grid-cols-7 items-center">
          {WD_SHORT.slice(1).map((w) => <span key={w} className="text-center text-[12px] font-semibold text-(--c-ink4)">{w}</span>)}
        </div>
        <div className="relative" style={{ height: CAL_ROW * 6 }}>
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={month}
              custom={dir}
              variants={{
                enter: (n: number) => ({ opacity: 0, transform: `translateX(${n * 18}px)` }),
                show: { opacity: 1, transform: 'translateX(0px)' },
                exit: (n: number) => ({ opacity: 0, transform: `translateX(${-n * 18}px)` }),
              }}
              initial="enter"
              animate="show"
              exit="exit"
              transition={SHEET}
              className="absolute inset-0 grid grid-cols-7"
            >
              {selIdx >= 0 && (
                <motion.span
                  initial={false}
                  animate={{ left: `${((selIdx % 7) + 0.5) * (100 / 7)}%`, top: (Math.floor(selIdx / 7) + 0.5) * CAL_ROW }}
                  transition={SHEET}
                  className="pointer-events-none absolute -mt-[17px] -ml-[17px] h-[34px] w-[34px] rounded-full bg-(--c-accent)"
                />
              )}
              {cells.map((c) => {
                const inMonth = ymOf(c) === month
                const sel = c === d && inMonth
                const isToday = c === today
                return (
                  <button key={c} onClick={() => pick(c)} className="relative flex items-center justify-center" style={{ height: CAL_ROW }}>
                    <span className={`relative text-[15px] tabular-nums ${sel ? 'font-bold text-white' : isToday ? 'font-bold text-(--c-accent)' : inMonth ? 'font-medium text-(--c-ink)' : 'font-medium text-(--c-ink5)'}`}>
                      {Number(c.slice(8))}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </SwapLayer>
      ) : (
      <SwapLayer id="ym" className="flex flex-col">
        <button onClick={() => setView('cal')} className="flex h-10 flex-none items-center justify-center gap-1 text-[15px] font-bold text-(--c-accent) transition-opacity active:opacity-50">
          {dy}年{dm}月
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--c-accent)"><path d="M6 15h12l-6-7z" /></svg>
        </button>
        <div className="flex flex-1 items-center gap-2">
          <Wheel items={years} index={Math.max(0, Math.min(years.length - 1, dy - (y0 - 1)))} onChange={(i) => setYmd(y0 - 1 + i, dm, dd)} className="flex-1" />
          <Wheel items={months} index={dm - 1} onChange={(i) => setYmd(dy, i + 1, dd)} className="flex-1" />
          <Wheel items={mdays} index={Math.min(dd, mdays.length) - 1} onChange={(i) => setYmd(dy, dm, i + 1)} className="flex-1" />
        </div>
      </SwapLayer>
      )}
    </div>
  )
}

/** 时:分两列滚轮；minutes 为从 0:00 起的分钟数 */
export function TimeWheels({ minutes, onChange, step = 5, className = '' }: { minutes: number; onChange: (m: number) => void; step?: number; className?: string }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), [])
  const mins = useMemo(() => Array.from({ length: 60 / step }, (_, i) => pad2(i * step)), [step])
  const hi = Math.floor(minutes / 60)
  const mi = Math.round((minutes % 60) / step) % (60 / step)
  return (
    <div className={`flex items-center gap-2 px-10 ${className}`}>
      <Wheel items={hours} index={hi} onChange={(i) => onChange(i * 60 + mi * step)} className="flex-1" />
      <span className="text-[18px] font-bold text-(--c-ink3)">:</span>
      <Wheel items={mins} index={mi} onChange={(i) => onChange(hi * 60 + i * step)} className="flex-1" />
    </div>
  )
}

export function DateSheet({ value, title = '日期', onPick, onClose }: { value: string; title?: string; onPick: (d: string) => void; onClose: () => void }) {
  const dismiss = useRef<(() => void) | null>(null)
  const [d, setD] = useState(value || todayYmd())
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-5 pb-1"
      header={<SheetHead title={title} sub={`${Number(d.slice(0, 4))}年${Number(d.slice(5, 7))}月${Number(d.slice(8))}日 ${WD[weekdayOf(d)]}`} trail={<SheetClose onClick={() => dismiss.current?.()} />} />}
      footer={<div className="px-5 pt-2"><PrimaryButton onClick={() => { onPick(d); dismiss.current?.() }}>确定</PrimaryButton></div>}
    >
      <Calendar value={d} onChange={(x) => { setD(x); onPick(x) }} />
    </Sheet>
  )
}

/** value / onPick 用 "HH:MM" */
export function TimeSheet({ value, title = '时间', step = 1, onPick, onClose }: { value: string; title?: string; step?: number; onPick: (v: string) => void; onClose: () => void }) {
  const dismiss = useRef<(() => void) | null>(null)
  const parse = (v: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v); return m ? Number(m[1]) * 60 + Number(m[2]) : 8 * 60 }
  const [m, setM] = useState(parse(value))
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-5 pb-1"
      header={<SheetHead title={title} sub={`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`} trail={<SheetClose onClick={() => dismiss.current?.()} />} />}
      footer={<div className="px-5 pt-2"><PrimaryButton onClick={() => { onPick(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`); dismiss.current?.() }}>确定</PrimaryButton></div>}
    >
      <TimeWheels minutes={m} onChange={setM} step={step} className="py-3" />
    </Sheet>
  )
}
