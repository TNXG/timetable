import React from 'react'
import { todayDate } from '../shared'

/* ---------------- 07 / 08 calendar sheets ---------------- */

export const monthRows: (number | null)[][] = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, 31, null, null],
]

export const byWeekday = [4, 5, 2, 3, 2, 0, 0]
export const countOf = (d: number) => byWeekday[(d + 1) % 7]

export const rowWeeks = [5, 6, 7, 8, 9]

export function CalendarSheet({ mode }: { mode: 'day' | 'week' }) {
  return (
    <>
      <div className="absolute inset-0 z-[19] bg-[#1B1C20]/25" />
      <div className="absolute inset-x-0 bottom-0 z-[20] rounded-t-[26px] bg-(--c-surface) px-4 pt-6 pb-9">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[19px] font-extrabold tracking-[-.02em] text-(--c-ink)">10月</span>
            <span className="text-[12px] font-semibold text-(--c-ink4)">秋季学期 第 5–9 周</span>
          </div>
          <div className="flex items-center gap-4">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.4"><path d="m9 5 7 7-7 7" /></svg>
            <span className="text-[12.5px] font-bold text-(--c-accent)">{mode === 'day' ? '今天' : '本周'}</span>
          </div>
        </div>

        <div className="mt-5 flex gap-[5px]">
          <div className="w-7 flex-none" />
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <div key={w} className="flex-1 text-center text-[10.5px] font-semibold text-(--c-ink4)">{w}</div>
          ))}
        </div>

        <div className="mt-2 space-y-[3px]">
          {monthRows.map((row, ri) => {
            const rowOn = mode === 'week' && rowWeeks[ri] === 7
            return (
              <div key={ri} className={`flex gap-[5px] rounded-[12px] ${rowOn ? 'bg-(--c-accent-soft)' : ''}`}>
                <div className="flex w-7 flex-none items-center justify-center">
                  <span className={`text-[10.5px] font-bold tabular-nums ${rowOn ? 'text-(--c-accent)' : 'text-(--c-ink5)'}`}>{rowWeeks[ri]}</span>
                </div>
                {row.map((d, ci) => {
                  if (d === null) return <div key={ci} className="flex-1" />
                  const n = countOf(d)
                  const on = mode === 'day' ? d === todayDate : rowOn
                  const cell = mode === 'day' && on
                  return (
                    <div key={ci} className="relative flex flex-1 flex-col items-center py-[9px]">
                      {cell && <i className="absolute inset-x-[-1px] inset-y-0 rounded-[13px] bg-(--c-accent-soft)" />}
                      <span className={`relative z-10 text-[15px] leading-[1.2] font-bold tabular-nums ${on ? 'text-(--c-accent)' : n ? 'text-(--c-ink)' : 'text-(--c-ink5)'}`}>{d}</span>
                      <span className={`relative z-10 mt-1 h-[3px] w-[3px] rounded-full ${n ? (on ? 'bg-(--c-accent)' : 'bg-(--c-ink5b)') : 'bg-transparent'}`} />
                      {n > 0 && <span className={`absolute top-1 right-1.5 z-10 text-[9px] font-bold tabular-nums ${on ? 'text-(--c-accent2)' : 'text-(--c-ink5)'}`}>{n}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between pt-1">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[14px] font-bold text-(--c-ink)">{mode === 'day' ? '10月14日 周二' : '第 7 周'}</span>
            <span className="text-[12px] font-semibold tabular-nums text-(--c-ink4)">{mode === 'day' ? '4 节课，08:00 – 17:40' : '10.13 – 10.19，单周，18 节课'}</span>
          </div>
          <span className="text-[12.5px] font-bold text-(--c-accent)">收起</span>
        </div>
      </div>
    </>
  )
}
