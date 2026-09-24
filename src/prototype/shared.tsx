import React from 'react'
import { stickerOf } from '../domain/stickers'
import { Sticker } from '../app/Sticker'

export const C = {
  math: '#6D78D6',
  eng: '#22A06B',
  ds: '#E8871A',
  phy: '#2E90FA',
  la: '#8B5CF6',
  pol: '#DE5B78',
}

/* ---------------- shared ---------------- */

export function Phone({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div data-phone className={`relative flex w-[375px] flex-col overflow-hidden rounded-[40px] bg-(--c-bg) ${tall ? 'min-h-[812px] pb-8' : 'h-[812px]'}`}>
      {children}
    </div>
  )
}

export function Nav({ active }: { active: number }) {
  const items: [React.ReactNode, string][] = [
    [<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" key="h" />, '今天'],
    [<g key="c"><rect x="3" y="4" width="18" height="17" rx="4" /><path d="M3 9h18M8 2v4M16 2v4" /></g>, '课表'],
    [<g key="t"><path d="M9 11.5 11 14l4-5" /><rect x="3.5" y="4" width="17" height="16" rx="4" /></g>, '待办'],
    [<g key="s"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></g>, '我的'],
  ]
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[8] flex justify-center px-4">
      <div
        className="flex w-[92%] items-center justify-between rounded-full p-[5px]"
        style={{
          background: 'var(--c-dock)',
          border: '1px solid var(--c-dock-line)',
          boxShadow: 'var(--c-dock-shadow)',
        }}
      >
        {items.map(([ic, label], i) => {
          const on = i === active
          return (
            <div key={label} className="relative flex flex-1 flex-col items-center gap-[2px] px-1 pt-[6px] pb-[5px]">
              {on && <i className="absolute inset-x-[1px] inset-y-0 rounded-full bg-(--c-accent-soft)" />}
              <svg viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--c-accent)' : 'var(--c-ink)'} strokeWidth="2.2" className="relative z-10 h-[19px] w-[19px]">{ic}</svg>
              <span className={`relative z-10 text-[9.5px] font-bold ${on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type Course = {
  jie: string
  start: string
  end: string
  name: string
  loc: string
  teacher: string
  color: string
  state: 'past' | 'now' | 'next' | 'later'
  extra?: string
}

export type Day = {
  key: string
  rel: string
  date: string
  w: string
  d: string
  n: number
  today?: boolean
  courses: Course[]
}

export const days: Day[] = [
  {
    key: 'mon', rel: '', date: '10月13日', w: '周一', d: '13', n: 4, courses: [],
  },
  {
    key: 'today', rel: '今天', date: '10月14日', w: '周二', d: '14', n: 4, today: true,
    courses: [
      { jie: '1–2节', start: '08:00', end: '09:40', name: '大学英语（三）', loc: '外语楼 105', teacher: '陈晓', color: C.eng, state: 'past' },
      { jie: '3–4节', start: '10:00', end: '11:40', name: '高等数学（下）', loc: '教学三楼 302', teacher: '王立群', color: C.math, state: 'now', extra: '还剩 38 分钟' },
      { jie: '5–6节', start: '14:00', end: '15:40', name: '数据结构', loc: '教学一楼 201', teacher: '李慕华', color: C.ds, state: 'next' },
      { jie: '7–8节', start: '16:00', end: '17:40', name: '体育（羽毛球）', loc: '东区体育馆', teacher: '记得带球拍', color: C.phy, state: 'later' },
    ],
  },
  {
    key: 'tomorrow', rel: '明天', date: '10月15日', w: '周三', d: '15', n: 2,
    courses: [
      { jie: '3–4节', start: '10:00', end: '11:40', name: '数据结构', loc: '教学一楼 201', teacher: '李慕华', color: C.ds, state: 'later' },
      { jie: '5–6节', start: '14:00', end: '15:40', name: '大学物理', loc: '理科楼 A203', teacher: '周敏', color: C.phy, state: 'later', extra: '带实验报告' },
    ],
  },
  {
    key: 'after', rel: '后天', date: '10月16日', w: '周四', d: '16', n: 3,
    courses: [
      { jie: '1–2节', start: '08:00', end: '09:40', name: '高等数学（下）', loc: '教学三楼 302', teacher: '王立群', color: C.math, state: 'later' },
      { jie: '5–6节', start: '14:00', end: '15:40', name: '线性代数', loc: '教学三楼 110', teacher: '赵一鸣', color: C.la, state: 'later' },
      { jie: '7–8节', start: '16:00', end: '17:40', name: '形势与政策', loc: '教学二楼 404', teacher: '刘岩', color: C.pol, state: 'later' },
    ],
  },
  {
    key: 'fri', rel: '', date: '10月17日', w: '周五', d: '17', n: 2,
    courses: [
      { jie: '1–2节', start: '08:00', end: '09:40', name: '大学物理', loc: '理科楼 A203', teacher: '周敏', color: C.phy, state: 'later' },
      { jie: '3–4节', start: '10:00', end: '11:40', name: '数据结构（上机）', loc: '机房 B2', teacher: '李慕华', color: C.ds, state: 'later' },
    ],
  },
  { key: 'sat', rel: '', date: '10月18日', w: '周六', d: '18', n: 0, courses: [] },
]

export const todayIndex = days.findIndex((d) => d.today)
export const nowLabel = '11:02'
export const todayDate = 14

export function DayPicker({ active, lead, trail, className = '', style }: { active: number; lead?: React.ReactNode; trail?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`flex items-stretch gap-[5px] ${className}`}>
      {lead}
      {days.map((d, i) => {
        const on = i === active
        const past = i < todayIndex && !on
        return (
          <div key={d.d} className="relative flex flex-1 flex-col items-center py-[5px]">
            {on && <i className="absolute inset-x-[-1px] inset-y-0 rounded-[13px] bg-(--c-accent-soft)" />}
            <span className={`relative z-10 text-[17px] leading-[1.2] font-bold tabular-nums ${on ? 'text-(--c-accent)' : past ? 'text-(--c-ink5b)' : 'text-(--c-ink)'}`}>{d.d}</span>
            <span className={`relative z-10 mt-0.5 text-[10.5px] font-semibold ${on ? 'text-(--c-accent)' : past ? 'text-(--c-ink5b)' : 'text-(--c-ink4)'}`}>{i === todayIndex ? '今天' : d.w}</span>
            {d.n > 0 && <span className={`absolute top-1 right-1.5 z-10 text-[9px] font-bold tabular-nums ${on ? 'text-(--c-accent2)' : past ? 'text-(--c-ink5b)' : 'text-(--c-ink5)'}`}>{d.n}</span>}
          </div>
        )
      })}
      {trail}
    </div>
  )
}

export const dockStyle = {
  background: 'var(--c-dock)',
  border: '1px solid var(--c-dock-line)',
  boxShadow: 'var(--c-dock-shadow)',
}

export function DateStrip({ active }: { active: number }) {
  return (
    <DayPicker
      active={active}
      style={dockStyle}
      className="absolute inset-x-4 bottom-[104px] z-[9] rounded-[1.5rem] px-2 py-1.5"
      trail={
        <div className="flex w-10 flex-none items-center justify-center">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink2)" strokeWidth="1.9"><rect x="3" y="4" width="18" height="17" rx="4" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
        </div>
      }
    />
  )
}


/* 每节课一张卡；学科贴纸压在卡片右上角，卡片不描边，正在上的课只用主题色文字 */
export function CourseRow({ c, last }: { c: Course; last?: boolean }) {
  const past = c.state === 'past'
  const now = c.state === 'now'
  const sticker = stickerOf(c.name)
  return (
    <div className="flex py-1.5">
      <div className={`w-11 flex-none pt-3.5 text-left ${past ? 'opacity-50' : ''}`}>
        <div className="text-[11px] font-bold text-(--c-ink2)">{c.jie}</div>
        <div className="mt-1 text-[11px] font-medium tabular-nums text-(--c-ink4)">{c.start}</div>
        <div className="text-[11px] font-medium tabular-nums text-(--c-ink5)">{c.end}</div>
      </div>
      <div className={`-my-1.5 ml-3 w-[2px] flex-none self-stretch ${last ? 'pb-7' : ''}`}>
        <div className="relative h-full bg-(--c-line)">
          {past && <i className="absolute inset-0 bg-(--c-accent)" />}
          {now && (
            <>
              <i className="absolute inset-x-0 top-0 h-[55%] bg-(--c-accent)" />
              <i className="absolute top-[55%] left-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-(--c-accent) bg-(--c-surface)" />
            </>
          )}
        </div>
      </div>
      <div className={`min-w-0 flex-1 pl-4 ${last ? 'pb-7' : ''} ${past ? 'opacity-50' : ''}`}>
        <div className="relative rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[16px] leading-[1.25] font-bold tracking-[-.01em] text-(--c-ink)">{c.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-(--c-ink3)">
                <span className="min-w-0 truncate">{c.loc}，{c.teacher}</span>
              </div>
            </div>
            {sticker && <Sticker id={sticker} size={24} tilt={-4} className="flex-none" />}
          </div>
          {now && <div className="mt-1.5 text-[12px] font-bold tabular-nums text-(--c-accent)">上课中，现在 11:02，还剩 38 分钟</div>}
          {c.state === 'next' && <div className="mt-1.5 text-[12px] font-semibold text-(--c-ink3)">下一节，午休后 14:00 开始</div>}
          {c.state === 'later' && c.extra && <div className="mt-1.5 text-[12px] font-semibold text-(--c-ink3)">{c.extra}</div>}
        </div>
      </div>
    </div>
  )
}

export function DayDivider({ day }: { day: Day }) {
  return (
    <div className="flex">
      <div className="flex flex-1 items-baseline justify-between pt-1 pb-7">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[17px] leading-none font-extrabold tracking-[-.02em] text-(--c-ink)">{day.rel || day.w}</span>
          <span className="text-[12.5px] font-semibold text-(--c-ink4)">{day.date}{day.rel ? ` ${day.w}` : ''}</span>
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-(--c-ink4)">{day.n} 节课，{day.courses[0].start} 开始</span>
      </div>
    </div>
  )
}

export function tint(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, var(--c-tint-base))`
}


export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] bg-(--c-surface) p-5 ${className}`}>{children}</div>
}

export function TopBar({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <div className="flex items-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
        </div>
      </div>
      <h1 className="mt-4 text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">{title}</h1>
      {sub && <div className="mt-1.5 text-[13px] leading-[1.5] font-medium text-(--c-ink4)">{sub}</div>}
    </>
  )
}

export const CameraIcon = ({ size = 18, stroke = 'var(--c-ink)' }: { size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M4 9a2.5 2.5 0 0 1 2.5-2.5H8l1.1-1.7c.3-.5.8-.8 1.4-.8h3c.6 0 1.1.3 1.4.8L16 6.5h1.5A2.5 2.5 0 0 1 20 9v7.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.6" r="3.1" />
  </svg>
)


export function Board({ className = '', zoom = 1, tilt, top = 0 }: { className?: string; zoom?: number; tilt?: boolean; top?: number }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: 'linear-gradient(160deg,#33524A 0%,#243E36 55%,#1E352E 100%)' }}>
      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(60% 45% at 30% 40%, rgba(255,255,255,.10), transparent 70%), radial-gradient(40% 40% at 80% 90%, rgba(255,255,255,.08), transparent 70%)' }} />
      <div
        className="absolute left-0 top-0 h-[300px] w-[420px] origin-top-left px-9 py-7 text-white/85"
        style={{ zoom, top, transform: tilt ? 'perspective(600px) rotateY(-4deg) rotateX(2deg) scale(1.04)' : undefined }}
      >
        <div className="text-[13px] font-medium tracking-[.06em] text-white/50">§8.3 第二型曲面积分</div>
        <div className="mt-5 inline-block border-b-2 border-white/70 pb-0.5 text-[24px] font-bold tracking-[.12em]">作业</div>
        <div className="mt-4 -rotate-[.6deg] text-[22px] font-semibold tracking-[.03em]">习题册 P41 – P45</div>
        <div className="mt-2 rotate-[.4deg] text-[20px] font-medium tracking-[.03em]">第 3、5、7 题</div>
        <div className="mt-5 -rotate-[.5deg] text-[18px] font-medium tracking-[.04em] text-white/70">下周一 课前交 ！</div>
      </div>
    </div>
  )
}


export function SubHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19 8 12l7-7" /></svg>
      </div>
      <h1 className="mt-4 text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">{title}</h1>
      {sub && <div className="mt-1.5 text-[13px] leading-[1.5] font-medium text-(--c-ink4)">{sub}</div>}
    </div>
  )
}



export type { EmptyKind } from "./empty-block";
export { EmptyArt, EmptyBlock } from "./empty-block";
