import React from 'react'
import { Phone, SubHead } from '../shared'

/* ---------------- 作息时间：总节数 + 标准时长，每节只填开始，下课自动算；单节下课可单独改 ---------------- */

/* [开始分钟, 单独改过的下课分钟?] */
export const scheduleStarts: [number, number?][] = [
  [480], [535], [600], [655],
  [840], [895], [960], [1015],
  [1140], [1195], [1250, 1285],
  [1300],
]
export const SCHED_DUR = 45
export const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const gapText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} 小时${m % 60 ? ` ${m % 60} 分` : ''}` : `${m} 分`)

export function Stepper({ value, unit }: { value: number; unit?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-(--c-surface2)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </span>
      <span className="min-w-[56px] text-center text-[15px] font-bold tabular-nums text-(--c-ink)">
        {value}{unit && <span className="ml-0.5 text-[12px] font-semibold text-(--c-ink4)">{unit}</span>}
      </span>
      <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-(--c-surface2)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </span>
    </div>
  )
}

export function ScheduleScreen({ overlay }: { overlay?: React.ReactNode }) {
  const rows = scheduleStarts.map(([s, e], i) => ({ i: i + 1, s, e: e ?? s + SCHED_DUR, custom: e != null }))
  const last = rows[rows.length - 1]
  return (
    <Phone tall>
      <div className="relative flex-1 pt-12">
        <SubHead title="作息时间" sub={`${rows.length} 节 · 每节 ${SCHED_DUR} 分钟 · ${hm(rows[0].s)} – ${hm(last.e)}`} />
        <div className="mt-6 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4">
            <div className="flex items-center py-3">
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">总节数</span>
              <Stepper value={rows.length} unit="节" />
            </div>
            <div className="flex items-center border-t border-(--c-line2) py-3">
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">标准时长</span>
              <Stepper value={SCHED_DUR} unit="分" />
            </div>
          </div>

          <div className="mt-5 flex items-baseline px-0.5">
            <span className="flex-1 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">节次</span>
            <span className="text-[12px] font-bold tracking-[-.01em] text-(--c-accent)">按间隔排布</span>
          </div>
          <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
            {/* 序号 | 开始 | 箭头 | 下课 | 时长：两个胶囊平分余宽，右侧时长列改过的用主题色 */}
            <div className="flex items-center pt-3 pb-1 text-[11px] font-semibold text-(--c-ink5)">
              <span className="w-[26px] flex-none" />
              <span className="flex-1 text-center">开始</span>
              <span className="mx-2 w-[16px] flex-none" />
              <span className="flex-1 text-center">下课</span>
              <span className="ml-3 w-[46px] flex-none text-right">时长</span>
            </div>
            {rows.map((r, i) => {
              const prev = rows[i - 1]
              const gap = prev ? r.s - prev.e : 0
              const big = gap >= 60
              return (
                <React.Fragment key={r.i}>
                  {prev && (
                    <div className={`flex items-center ${big ? 'h-[30px]' : 'h-[18px]'}`}>
                      <span className="w-[26px] flex-none" />
                      <span className={`flex-1 border-t border-dashed ${big ? 'border-(--c-line)' : 'border-(--c-line2)'}`} />
                      <span className={`px-2 text-[11px] font-semibold tabular-nums ${big ? 'text-(--c-ink4)' : 'text-(--c-ink5)'}`}>{big ? (r.s < 15 * 60 ? '午休' : r.s < 20 * 60 ? '晚饭' : '休息') + ' ' : ''}{gapText(gap)}</span>
                      <span className={`flex-1 border-t border-dashed ${big ? 'border-(--c-line)' : 'border-(--c-line2)'}`} />
                    </div>
                  )}
                  <div className="flex items-center py-1.5">
                    <span className="w-[26px] flex-none text-[12.5px] font-bold tabular-nums text-(--c-ink4)">{r.i}</span>
                    <span className="flex-1 rounded-[10px] bg-(--c-surface2) py-1.5 text-center text-[15px] font-bold tabular-nums text-(--c-ink)">{hm(r.s)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-2 flex-none"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
                    <span className={`flex-1 rounded-[10px] py-1.5 text-center text-[15px] tabular-nums ${r.custom ? 'font-bold text-(--c-ink)' : 'font-medium text-(--c-ink4)'}`} style={r.custom ? { boxShadow: 'inset 0 0 0 1.5px var(--c-accent)' } : undefined}>{hm(r.e)}</span>
                    <span className={`ml-3 w-[46px] flex-none text-right text-[12px] font-semibold tabular-nums ${r.custom ? 'text-(--c-accent)' : 'text-(--c-ink5)'}`}>{r.e - r.s} 分</span>
                  </div>
                </React.Fragment>
              )
            })}
            <div className="h-2" />
          </div>
        </div>
        <div className="sticky bottom-0 mt-6 px-5 pb-6 pt-3" style={{ background: 'var(--c-fade)' }}>
          <div className="rounded-[18px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">保存</div>
        </div>
        {overlay}
      </div>
    </Phone>
  )
}

/* 引导第 2 步：三个数生成整天作息，午休/晚饭自动跳；细调去「我的 · 作息时间」 */
export function OnboardScheduleScreen() {
  const n = 14
  const dur = 45
  const gap = 10
  /* 午休/晚饭截止先按紧的排，最后一节拖过 23:00 再放宽（与 domain/schedule.generateGrid 同步） */
  let rows: [number, number][] = []
  for (const [noon, dusk] of [[12 * 60, 18 * 60], [12 * 60 + 30, 18 * 60 + 30], [Infinity, Infinity]]) {
    rows = []
    let s = 480
    for (let i = 0; i < n; i++) {
      const e = s + dur
      rows.push([s, e])
      s = e + gap
      if (s < 14 * 60 && s + dur > noon) s = 14 * 60
      else if (s >= 14 * 60 && s < 19 * 60 && s + dur > dusk) s = 19 * 60
    }
    if (rows[n - 1][1] <= 23 * 60) break
  }
  return (
    <Phone>
      <div className="flex flex-1 flex-col pt-12">
        <SubHead title="作息时间" sub={`${n} 节 · ${hm(rows[0][0])} – ${hm(rows[n - 1][1])}`} />
        <div className="mt-6 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4">
            <div className="flex items-center py-3">
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">每天节数</span>
              <Stepper value={n} unit="节" />
            </div>
            <div className="flex items-center border-t border-(--c-line2) py-3">
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">每节时长</span>
              <Stepper value={dur} unit="分" />
            </div>
            <div className="flex items-center border-t border-(--c-line2) py-3">
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">第 1 节开始</span>
              <span className="rounded-[10px] bg-(--c-surface2) px-3 py-1.5 text-[15px] font-bold tabular-nums text-(--c-ink)">08:00</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 rounded-[18px] bg-(--c-surface) px-4 py-2">
            {rows.map(([a, b], i) => (
              <div key={i} className={`flex items-center py-[7px] ${i >= 2 ? 'border-t border-(--c-line2)' : ''}`}>
                <span className="w-[24px] text-[12px] font-bold tabular-nums text-(--c-ink5)">{i + 1}</span>
                <span className="text-[13px] font-semibold tabular-nums text-(--c-ink)">{hm(a)}</span>
                <span className="mx-1.5 text-[12px] text-(--c-ink5)">–</span>
                <span className="text-[13px] font-medium tabular-nums text-(--c-ink4)">{hm(b)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto" />
      </div>
      <div className="px-5 pb-6">
        <div className="rounded-[18px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">继续</div>
      </div>
    </Phone>
  )
}

/* 改某节开始：时:分滚轮 + 「后续节次同步平移」 */
export function ScheduleTimeSheet() {
  const hours = ['12', '13', '14', '15', '16']
  const mins = ['50', '55', '00', '05', '10']
  return (
    <div className="absolute inset-0 z-[20]" style={{ background: 'var(--c-scrim)' }}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-(--c-surface) px-5 pt-5 pb-9 shadow-(--c-lift-shadow)">
        <div className="flex items-baseline justify-between">
          <div className="text-[17px] font-extrabold tracking-[-.02em] text-(--c-ink)">第 5 节 开始</div>
          <div className="text-[13px] font-semibold tabular-nums text-(--c-ink4)">14:00 – 14:45</div>
        </div>
        <div className="relative mt-3 flex items-center gap-2 px-10 py-3" style={{ height: 200 + 24 }}>
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-[40px] -translate-y-1/2 rounded-[10px] bg-(--c-surface2)" />
          {[hours, mins].map((col, ci) => (
            <React.Fragment key={ci}>
              {ci === 1 && <span className="text-[18px] font-bold text-(--c-ink3)">:</span>}
              <div className="relative flex flex-1 flex-col">
                {col.map((t, i) => (
                  <span key={t} className={`flex h-[40px] items-center justify-center text-[16px] tabular-nums ${i === 2 ? 'font-bold text-(--c-ink)' : 'font-medium text-(--c-ink4)'}`} style={{ opacity: i === 2 ? 1 : i === 1 || i === 3 ? 0.7 : 0.3 }}>{t}</span>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-1 flex items-center rounded-[14px] bg-(--c-row-muted) px-3.5 py-3">
          <span className="flex-1 text-[13.5px] font-semibold text-(--c-ink)">后续节次同步平移</span>
          <span className="relative h-[26px] w-[44px] rounded-full bg-(--c-accent)"><i className="absolute top-[3px] right-[3px] h-[20px] w-[20px] rounded-full bg-white" /></span>
        </div>
        <div className="mt-4 rounded-[16px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">确定</div>
      </div>
    </div>
  )
}

/* ---------------- 首次：加进手机日历 ---------------- */

export const calendarIntroRows: [string, string, string][] = [
  ['var(--c-accent)', '上课', '提前 15 分钟'],
  ['var(--c-amber)', '作业', '提前 1 天、2 小时'],
  ['var(--c-rose)', '考试', '提前 7 天、3 天、1 天及当天'],
]

export function CalendarIntroScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">同步至系统日历</h1>
        </div>
        <div className="mt-6 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4">
            {calendarIntroRows.map(([c, k, v], i) => (
              <div key={k} className={`flex items-center py-3.5 ${i ? 'border-t border-(--c-line2)' : ''}`}>
                <i className="mr-3 h-[9px] w-[9px] flex-none rounded-full" style={{ background: c }} />
                <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto" />
      </div>
      <div className="px-5 pb-6">
        <button className="w-full rounded-[18px] bg-(--c-accent) py-[15px] text-[15px] font-bold text-white">开启同步</button>
      </div>
    </Phone>
  )
}

export { WCard, WHead, WRow, WidgetScreen, WidgetScreen2 } from './widget-screens'
