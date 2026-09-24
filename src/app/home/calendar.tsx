/** 日历面板：整学期连续月份，只能上下滚动；从底部滑入滑出 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Semester } from '../../domain/types'
import { addDays, weekOf, weekdayOf } from '../../domain/dates'
import { occurrencesOn, type Snapshot } from '../../domain/engine'
import { Sheet, TextAction, WD_SHORT } from '../ui'
import { todayStr } from '../semester'

/** 一个月的网格：只在月份 / 课程数 / 选中 / 模式变化时重渲染，滚动不碰它 */
const MonthGrid = memo(function MonthGrid({ month, sem, counts, anchor, today, mode, onPick }: {
  month: string
  sem: Semester
  counts: Map<string, number>
  anchor: string
  today: string
  mode: 'day' | 'week'
  onPick: (d: string) => void
}) {
  const rows = useMemo(() => {
    const lead = weekdayOf(`${month}-01`) - 1
    const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const cells: (string | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    const out: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [month])
  const rowWeek = (row: (string | null)[]) => {
    const d = row.find(Boolean)
    return d ? weekOf(sem, d) : 0
  }
  const anchorWeek = weekOf(sem, anchor)
  return (
    <div className="space-y-[3px]">
      {rows.map((row, ri) => {
        const wk = rowWeek(row)
        const rowOn = mode === 'week' && wk === anchorWeek
        return (
          <div key={ri} className={`flex gap-[5px] rounded-[12px] ${rowOn ? 'bg-(--c-accent-soft)' : ''}`}>
            <div className="flex w-7 flex-none items-center justify-center">
              <span className={`text-[10.5px] font-bold tabular-nums ${rowOn ? 'text-(--c-accent)' : 'text-(--c-ink5)'}`}>{wk >= 1 && wk <= sem.totalWeeks ? wk : ''}</span>
            </div>
            {row.map((d, ci) => {
              if (!d) return <div key={ci} className="flex-1" />
              const n = counts.get(d) ?? 0
              const isToday = d === today
              const sel = d === anchor
              return (
                <button key={d} onClick={() => onPick(d)} className="relative flex flex-1 flex-col items-center py-[9px]">
                  {sel && <i className="absolute inset-x-[-4px] inset-y-0 rounded-[13px] bg-(--c-accent-soft)" />}
                  <span
                    className={`relative z-10 flex h-[22px] w-[22px] items-center justify-center text-[15px] leading-none font-bold tabular-nums ${
                      isToday || sel ? 'text-(--c-accent)' : n ? 'text-(--c-ink)' : 'text-(--c-ink5)'
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className={`relative z-10 mt-1 h-[3px] w-[3px] rounded-full ${n ? (isToday || sel ? 'bg-(--c-accent)' : 'bg-(--c-ink5)') : 'bg-transparent'}`} />
                  {n > 0 && <span className={`absolute top-[3px] right-[2px] z-10 text-[9px] font-bold tabular-nums ${isToday || sel ? 'text-(--c-accent2)' : 'text-(--c-ink5)'}`}>{n}</span>}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})

/** 月标题：吸顶后下沿出现羽化；只有这一小块跟着滚动位置重渲染 */
function MonthHead({ month, sem, stuck }: { month: string; sem: Semester; stuck: boolean }) {
  const first = weekOf(sem, `${month}-01`)
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const last = weekOf(sem, `${month}-${String(lastDay).padStart(2, '0')}`)
  return (
    <div className={`sticky top-0 z-[20] flex items-baseline gap-2.5 bg-(--c-surface) px-1 py-2 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-[linear-gradient(180deg,var(--c-surface),transparent)] after:transition-opacity after:duration-200 after:content-[''] ${stuck ? 'after:opacity-100' : 'after:opacity-0'}`}>
      <span className="text-[19px] font-extrabold tracking-[-.02em]">{Number(month.slice(5, 7))}月</span>
      <span className="text-[12px] font-semibold text-(--c-ink4)">
        {sem.name}
        {last >= 1 ? ` 第 ${Math.max(1, first)}–${Math.min(sem.totalWeeks, Math.max(1, last))} 周` : ''}
      </span>
    </div>
  )
}

export function CalendarSheet({ snap, mode, anchor, onPick, onClose }: { snap: Snapshot; mode: 'day' | 'week'; anchor: string; onPick: (d: string) => void; onClose: () => void }) {
  const today = todayStr()
  const sem = snap.semester
  const scrollRef = useRef<HTMLDivElement>(null)
  const marks = useRef<Record<string, HTMLDivElement>>({})
  const dismiss = useRef<(() => void) | null>(null)
  /** 选日期后先播完抽屉退出动画，再由 onExitComplete 卸载 */
  const pick = useCallback((d: string) => { onPick(d); dismiss.current?.() }, [onPick])

  /** 学期覆盖到的月份，连续排列，直接上下滚动 */
  const months = useMemo(() => {
    const out: string[] = []
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const end = new Date(`${addDays(sem.startDate, sem.totalWeeks * 7 - 1)}T00:00:00`)
    const cur = new Date(`${sem.startDate}T00:00:00`)
    cur.setDate(1)
    while (cur <= end) {
      out.push(key(cur))
      cur.setMonth(cur.getMonth() + 1)
    }
    for (const m of [anchor.slice(0, 7), today.slice(0, 7)]) if (!out.includes(m)) out.push(m)
    return out.sort()
  }, [sem, anchor, today])

  /** 每天的课程数：整个范围算一次，格子里只查表 */
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    const lo = `${months[0]}-01`
    const hiM = months[months.length - 1]
    const hi = `${hiM}-${String(new Date(Number(hiM.slice(0, 4)), Number(hiM.slice(5, 7)), 0).getDate()).padStart(2, '0')}`
    for (let d = lo; d <= hi; d = addDays(d, 1)) {
      const n = occurrencesOn(snap, d).length
      if (n) m.set(d, n)
    }
    return m
  }, [snap, months])

  const scrollTo = (month: string) => {
    const node = marks.current[month]
    const box = scrollRef.current?.parentElement
    if (node && box) box.scrollTop = node.offsetTop - box.offsetTop
  }

  /** 哪个月标题正吸在顶上 */
  const [stuckMonth, setStuckMonth] = useState<string | null>(null)
  useEffect(() => {
    scrollTo(anchor.slice(0, 7))
    const box = scrollRef.current?.parentElement
    if (!box) return
    const onScroll = () => {
      const top = box.scrollTop
      let cur: string | null = null
      for (const m of months) {
        const node = marks.current[m]
        if (node && top > node.offsetTop - box.offsetTop + 1) cur = m
      }
      setStuckMonth(cur)
    }
    onScroll()
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-4"
      header={
        <div className="flex gap-[5px] px-4 pt-1 pb-2">
          <div className="w-7 flex-none" />
          {[1, 2, 3, 4, 5, 6, 7].map((w) => (
            <div key={w} className="flex-1 text-center text-[10.5px] font-semibold text-(--c-ink4)">{WD_SHORT[w]}</div>
          ))}
        </div>
      }
      footer={
        <div className="flex justify-end px-5 pt-3">
          <TextAction onClick={() => { scrollTo(today.slice(0, 7)); pick(today) }}>{mode === 'day' ? '今天' : '本周'}</TextAction>
        </div>
      }
    >
      <div ref={scrollRef} className="max-h-full">
        {months.map((month) => (
          <div
            key={month}
            ref={(el) => {
              if (el) marks.current[month] = el
            }}
            className="pb-4"
          >
            <MonthHead month={month} sem={sem} stuck={stuckMonth === month} />
            <MonthGrid month={month} sem={sem} counts={counts} anchor={anchor} today={today} mode={mode} onPick={pick} />
          </div>
        ))}
      </div>
    </Sheet>
  )
}
