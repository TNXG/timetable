import React from 'react'
import { C, Phone, Nav, todayIndex, DayPicker, tint, TopBar } from '../shared'
import type { Ev } from './today-week'

/* ---------------- conflict & changes ---------------- */

export type CEv = Ev & { lane?: number; lanes?: number; conflict?: boolean }

export const conflictCols: CEv[][] = [
  [
    { name: '大学英语', loc: '外语楼105', color: C.eng, top: 0, h: 72 },
    { name: '高等数学', loc: '教三302', color: C.math, top: 84, h: 72 },
  ],
  [
    { name: '大学英语', loc: '外语楼105', color: C.eng, top: 0, h: 72 },
    { name: '数据结构', loc: '教一201', color: C.ds, top: 84, h: 72, lane: 0, lanes: 2, conflict: true },
    { name: '形势政策', loc: '教二404', color: C.pol, top: 100, h: 72, lane: 1, lanes: 2, conflict: true },
    { name: '大学物理', loc: '理科楼A', color: C.phy, top: 252, h: 72 },
    { name: '线代习题', loc: '教三110', color: C.la, top: 462, h: 72 },
  ],
  [
    { name: '数据结构', loc: '教一201', color: C.ds, top: 84, h: 72 },
    { name: '大学物理', loc: '理科楼A', color: C.phy, top: 252, h: 72 },
  ],
  [
    { name: '高等数学', loc: '教三302', color: C.math, top: 0, h: 72 },
    { name: '线性代数', loc: '教三110', color: C.la, top: 252, h: 72 },
  ],
  [
    { name: '大学物理', loc: '理科楼A', color: C.phy, top: 0, h: 72 },
    { name: '数据结构', loc: '机房B2', color: C.ds, top: 84, h: 72 },
  ],
  [],
]

export const conflictPair: [string, string, string, string, string][] = [
  ['数据结构', '10:00–11:40', '教学一楼 201，李慕华', C.ds, '规则导入'],
  ['形势与政策', '10:20–12:00', '教学二楼 404，刘岩', C.pol, '手动添加'],
]

export function ConflictScreen({ mode = 'view' }: { mode?: 'view' | 'pick' }) {
  const pick = mode === 'pick'
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">
            第 7 周
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.6"><path d="m6 9 6 6 6-6" /></svg>
          </div>
          <div className="text-[12.5px] font-semibold text-(--c-amber)">1 处时间冲突</div>
        </div>

        <div className="mt-3.5 px-2">
          <div className="rounded-[22px] bg-(--c-surface) p-2.5 pb-4">
            <DayPicker
              active={todayIndex}
              lead={<div className="-mr-[5px] flex w-8 flex-none items-center justify-center text-[10.5px] font-semibold text-(--c-ink4)">10月</div>}
            />
            <div className="relative mt-2">
              {[0, 84, 168, 252, 336, 420, 504].map((t) => (
                <div key={t} className="absolute right-0 left-8 h-px bg-(--c-line2)" style={{ top: t + 6 }} />
              ))}
              <div className="flex pt-1.5">
                <div className="relative w-8 flex-none">
                  {['8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((t) => (
                    <div key={t} className="h-[84px] pr-1.5 text-right text-[9.5px] font-semibold tabular-nums text-(--c-ink4b)">{t}</div>
                  ))}
                </div>
                <div className="relative flex h-[536px] flex-1 gap-[5px]">
                  {conflictCols.map((col, i) => (
                    <div key={i} className="relative flex-1">
                      {col.map((ev) => {
                        const lane = ev.lane ?? 0
                        const stacked = (ev.lanes ?? 1) > 1
                        return (
                          <div
                            key={ev.name + ev.top}
                            className="absolute"
                            style={{
                              top: ev.top,
                              height: ev.h,
                              left: stacked && lane > 0 ? 5 : 0,
                              right: stacked && lane > 0 ? -5 : 0,
                              zIndex: stacked ? (lane === 0 ? 6 : 5) : undefined,
                              opacity: pick && stacked && lane > 0 ? 0.4 : 1,
                            }}
                          >
                            <div
                              className="absolute inset-0 overflow-hidden rounded-[9px] px-1 py-1.5 text-[9.5px] leading-[1.35] font-bold"
                              style={{
                                background: tint(ev.color, stacked ? 14 : 10),
                                color: `color-mix(in srgb, ${ev.color} 85%, var(--c-ink-mix))`,
                                boxShadow: stacked ? `inset 0 0 0 1.5px ${lane === 0 ? '#E0AC6C' : 'rgba(224,172,108,.55)'}` : undefined,
                              }}
                            >
                              {lane === 0 && ev.name}
                              {stacked && lane === 0 && <div className="mt-0.5 text-[8.5px] leading-[1.3] font-semibold opacity-60">{ev.loc}</div>}
                              {!stacked && <div className="mt-0.5 text-[8.5px] leading-[1.3] font-semibold opacity-60">{ev.loc}</div>}
                            </div>
                            {stacked && lane === 0 && (
                              <span className="absolute top-[-5px] right-[-7px] z-10 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#E0AC6C] text-[8.5px] leading-none font-bold text-white ring-[2px] ring-white">2</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[7]">
        <div className="rounded-t-[26px] bg-(--c-surface) px-5 pt-5 pb-[104px] shadow-(--c-lift-shadow)">
          <div className="text-[17px] font-extrabold tracking-[-.02em] text-(--c-ink)">{pick ? '留哪一门？' : '周二 10:00 有两门课'}</div>
          {pick && <div className="mt-1.5 text-[12.5px] font-medium text-(--c-ink4)">没选的那门从课表里隐藏，不删除</div>}
          <div className={`${pick ? 'mt-4' : 'mt-3.5'} space-y-2`}>
            {conflictPair.map(([name, time, loc, color, from], i) => {
              const on = i === 0
              return (
                <div
                  key={name}
                  className="flex items-center rounded-[12px] px-3.5 py-3"
                  style={{
                    background: pick && !on ? 'var(--c-row-muted)' : tint(color, 7),
                    boxShadow: pick && on ? `inset 0 0 0 1.5px ${color}` : undefined,
                  }}
                >
                  {pick ? (
                    <span
                      className="mr-3 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border-[1.8px]"
                      style={{ borderColor: on ? color : 'var(--c-radio-border)', background: on ? color : 'transparent' }}
                    >
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>}
                    </span>
                  ) : (
                    <i className="mr-3 h-[38px] w-[3px] flex-none rounded-full" style={{ background: color }} />
                  )}
                  <div className={`min-w-0 flex-1 ${pick && !on ? 'opacity-55' : ''}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13.5px] font-bold text-(--c-ink)">{name}</span>
                      <span className="ml-2 flex-none text-[11.5px] font-semibold tabular-nums text-(--c-ink3)">{time}</span>
                    </div>
                    <div className="mt-[3px] truncate text-[11.5px] font-medium text-(--c-ink3)">{loc}　{from}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            {pick ? (
              <>
                <span className="text-[13px] font-medium text-(--c-ink4)">隐藏后随时能恢复</span>
                <div className="flex items-center gap-5">
                  <span className="text-[13px] font-bold text-(--c-ink3)">取消</span>
                  <span className="text-[13px] font-bold text-(--c-accent)">只留数据结构</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-[13px] font-semibold tabular-nums text-(--c-amber)">重叠 1 小时 20 分</span>
                <div className="flex items-center gap-5">
                  <span className="text-[13px] font-bold text-(--c-ink3)">都保留</span>
                  <span className="text-[13px] font-bold text-(--c-accent)">只留一门</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  )
}

export const diffRows: [string, string, string][] = [
  ['时间', '周四 5–6 节 14:00', '周五 3–4 节 10:00'],
  ['地点', '教学三楼 110', '教学三楼 208'],
]

export function ChangeScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="线性代数调课了" sub="11:02 用「正方教务 通用规则」重新导入时发现的变化" />

        <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
          {diffRows.map(([k, from, to], i) => {
            const same = from === to
            return (
              <div key={k} className={`px-4 py-3 ${i > 0 ? 'border-t border-(--c-surface2)' : ''}`}>
                <div className="text-[11.5px] font-semibold text-(--c-ink4)">{k}</div>
                {same ? (
                  <div className="mt-1.5 text-[14px] font-bold text-(--c-ink)">{to}</div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <span className="text-[14px] font-medium text-(--c-ink4b) line-through">{from}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4" className="flex-none"><path d="m9 5 7 7-7 7" /></svg>
                    <span className="text-[14px] font-bold text-(--c-accent)">{to}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">受影响的安排</div>
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center rounded-[12px] px-3.5 py-3" style={{ background: tint(C.la, 7) }}>
            <i className="mr-3 h-[38px] w-[3px] flex-none rounded-full" style={{ background: C.la }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-(--c-ink)">期中考试 覆盖 1–5 章</div>
              <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink3)">原本跟着这节课，时间要不要一起改</div>
            </div>
          </div>
          <div className="flex items-center rounded-[12px] px-3.5 py-3" style={{ background: 'rgba(223,169,104,.09)' }}>
            <i className="mr-3 h-[38px] w-[3px] flex-none rounded-full" style={{ background: '#DFA968' }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-(--c-ink)">新时间和大学物理重叠</div>
              <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink3)">周五 10:00 已有大学物理，理科楼 A203</div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">这门课以前的变更</div>
        <div className="mt-2.5 overflow-hidden rounded-[16px] bg-(--c-surface)">
          {([
            ['9月30日', '停课一次', '国庆假期，已从课表移除'],
            ['9月18日', '换教室', '教学三楼 214 → 110，当时已保留'],
          ] as [string, string, string][]).map(([d, what, why], i) => (
            <div key={d} className={`flex items-baseline px-4 py-2.5 ${i > 0 ? 'border-t border-(--c-surface2)' : ''}`}>
              <span className="w-[58px] flex-none text-[11.5px] font-semibold tabular-nums text-(--c-ink4b)">{d}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-(--c-ink)">{what}</div>
                <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink4)">{why}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-5 px-1">
          <span className="text-[13px] font-bold text-(--c-ink3)">撤销变更</span>
          <span className="text-[13px] font-bold text-(--c-accent)">知道了</span>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  )
}

export { FreeDayScreen, NoDataScreen, failedRows, PartialFailScreen } from './empty-screens'
