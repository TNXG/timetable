import React from 'react'
import { C, Phone, Nav, dockStyle, tint } from '../shared'

/* ---------------- week range: out of term / vacation / exam ---------------- */

export function WeekShell({
  week,
  right,
  month,
  rightTone = 'gray',
  strip,
  children,
  footer,
  band,
}: {
  week: string
  right: string
  month: string
  rightTone?: 'gray' | 'amber' | 'indigo'
  strip: [string, string][]
  children: React.ReactNode
  footer?: React.ReactNode
  band?: React.ReactNode
}) {
  const tone = rightTone === 'amber' ? '#C29155' : rightTone === 'indigo' ? '#4F5BD5' : '#8A8E97'
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">
            {week}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.6"><path d="m6 9 6 6 6-6" /></svg>
          </div>
          <div className="text-[12.5px] font-semibold" style={{ color: tone }}>{right}</div>
        </div>

        <div className="mt-3.5 px-2">
          <div className="rounded-[22px] bg-(--c-surface) p-2.5 pb-4">
            <div className="flex items-stretch gap-[5px]">
              <div className="-mr-[5px] flex w-8 flex-none items-center justify-center text-[10.5px] font-semibold text-(--c-ink5)">{month}</div>
              {strip.map(([d, w]) => (
                <div key={d + w} className="relative flex flex-1 flex-col items-center py-[5px]">
                  <span className="text-[17px] leading-[1.2] font-bold tabular-nums text-(--c-ink5b)">{d}</span>
                  <span className="mt-0.5 text-[10.5px] font-semibold text-(--c-ink5b)">{w}</span>
                </div>
              ))}
            </div>

            {band && <div className="mt-1.5 ml-8">{band}</div>}
            <div className="relative mt-2">
              {[0, 84, 168, 252, 336, 420, 504].map((t) => (
                <div key={t} className="absolute right-0 left-8 h-px bg-(--c-line2)" style={{ top: t + 6 }} />
              ))}
              <div className="flex pt-1.5">
                <div className="w-8 flex-none">
                  {['8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((t) => (
                    <div key={t} className="h-[84px] pr-1.5 text-right text-[9.5px] font-semibold tabular-nums text-(--c-ink5b)">{t}</div>
                  ))}
                </div>
                <div className="relative h-[536px] flex-1">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {footer}
      <Nav active={1} />
    </Phone>
  )
}

export function WeekBand({ tone, title, meta }: { tone: 'gray' | 'amber'; title: string; meta: string }) {
  const c = tone === 'amber' ? '#C29155' : '#8A8E97'
  return (
    <div className="flex items-center gap-2 rounded-[8px] px-2.5 py-[6px]" style={{ background: tint(c, 12) }}>
      <i className="h-[14px] w-[3px] flex-none rounded-full" style={{ background: c }} />
      <span className="text-[11.5px] font-bold" style={{ color: `color-mix(in srgb, ${c} 85%, var(--c-ink-mix))` }}>{title}</span>
      <span className="ml-auto text-[10.5px] font-semibold" style={{ color: c }}>{meta}</span>
    </div>
  )
}

export function GhostEvent({ name, color, top, h }: { name: string; color: string; top: number; h: number }) {
  return (
    <div
      className="absolute inset-x-0 overflow-hidden rounded-[9px] border-[1.5px] border-dashed px-1 py-1.5 text-[9.5px] leading-[1.35] font-bold"
      style={{ top, height: h, borderColor: tint(color, 45), color: `color-mix(in srgb, ${color} 70%, var(--c-ink-mix))` }}
    >
      <span className="opacity-70">{name}</span>
      <div className="mt-0.5 text-[8.5px] leading-[1.3] font-semibold opacity-60">停课</div>
    </div>
  )
}

export function FloatPills({ actions }: { actions: string[] }) {
  return (
    <div className="absolute inset-x-0 bottom-[100px] z-[9] flex justify-center gap-2">
      {actions.map((a, i) => (
        <span
          key={a}
          className={`flex h-[36px] items-center rounded-full px-4 text-[13px] font-bold ${i === 0 ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}
          style={dockStyle}
        >
          {a}
        </span>
      ))}
    </div>
  )
}

export function OutOfTermScreen() {
  return (
    <WeekShell
      week="第 21 周"
      right="学期外"
      month="1月"
      strip={[['19', '周一'], ['20', '周二'], ['21', '周三'], ['22', '周四'], ['23', '周五'], ['24', '周六']]}
      band={<WeekBand tone="gray" title="学期已结束" meta="秋季学期 20 周，止于 1月18日" />}
      footer={<FloatPills actions={['回到本周', '准备下学期']} />}
    >
      <span />
    </WeekShell>
  )
}

export function VacationScreen() {
  return (
    <WeekShell
      week="第 5 周"
      right="国庆假期"
      month="10月"
      rightTone="amber"
      strip={[['1', '周三'], ['2', '周四'], ['3', '周五'], ['4', '周六'], ['5', '周日'], ['6', '周一']]}
      band={<WeekBand tone="amber" title="国庆假期" meta="10月1日–10月7日，停课 2 节" />}
      footer={<FloatPills actions={['前往 10月8日']} />}
    >
      <div className="flex h-full gap-[5px]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="relative flex-1">
            {i === 1 && <GhostEvent name="高等数学（下）" color={C.math} top={0} h={70} />}
            {i === 2 && <GhostEvent name="数据结构" color={C.ds} top={252} h={70} />}
          </div>
        ))}
      </div>
    </WeekShell>
  )
}

export const exams: [string, string, string, string, string, string][] = [
  ['高等数学（下）', '1月6日 周二', '09:00–11:00', '教学三楼 302', '座位 24', '3 天后'],
  ['数据结构', '1月8日 周四', '14:30–16:30', '教学一楼 201', '座位 07', ''],
  ['大学物理', '1月9日 周五', '09:00–11:00', '理科楼 A203', '座位 31', ''],
]
export const examColors = [C.math, C.ds, C.phy]

export function ExamWeekScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">
            第 19 周
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.6"><path d="m6 9 6 6 6-6" /></svg>
          </div>
          <div className="text-[12.5px] font-semibold text-(--c-accent)">考试周</div>
        </div>
        <div className="mt-2 px-5 text-[12.5px] font-medium text-(--c-ink3)">本周 3 场考试</div>

        <div className="mt-4 px-5">
          <div className="space-y-2.5">
            {exams.map(([name, day, time, loc, seat, cd], i) => {
              const color = examColors[i]
              return (
                <div key={name} className="rounded-[16px] bg-(--c-surface) px-4 py-3.5">
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 items-center">
                      <i className="mr-3 h-[16px] w-[3px] flex-none rounded-full" style={{ background: color }} />
                      <span className="truncate text-[15px] font-bold tracking-[-.01em] text-(--c-ink)">{name}</span>
                    </div>
                    {cd ? (
                      <span className="ml-2 flex-none rounded-[7px] bg-(--c-accent-soft) px-2 py-[3px] text-[10.5px] font-bold text-(--c-accent)">{cd}</span>
                    ) : (
                      <span className="ml-2 flex-none text-[11.5px] font-semibold tabular-nums text-(--c-ink4b)">{day.slice(0, 4)}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 pl-[15px]">
                    <span className="text-[13px] font-bold tabular-nums text-(--c-ink)">{day} {time}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 pl-[15px] text-[12px] font-medium text-(--c-ink3)">
                    <span>{loc}</span>
                    <span className="h-3 w-px bg-(--c-line)" />
                    <span className="tabular-nums">{seat}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
            <div className="text-[13px] font-bold text-(--c-ink)">还有 2 门没有考试安排</div>
            <div className="mt-1 text-[12px] leading-[1.5] font-medium text-(--c-ink3)">大学英语（三）、形势与政策。</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-(--c-ink4)">考试安排为手动添加</span>
              <span className="text-[13px] font-bold text-(--c-accent)">添加考试</span>
            </div>
          </div>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  )
}
