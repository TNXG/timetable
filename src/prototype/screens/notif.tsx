import React from 'react'
import { Phone } from '../shared'

/* ---------------- 09 notifications ---------------- */

export type Notif = {
  tone: 'now' | 'plain' | 'warn' | 'change'
  time: string
  title: string
  body: string
  meta?: string
  acts?: string[]
}

export const notifs: Notif[] = [
  {
    tone: 'now', time: '09:45',
    title: '高等数学',
    body: '10:00 – 11:40',
    meta: '教学三楼 302',
  },
  {
    tone: 'warn', time: '09:00',
    title: '期中考试（线性代数）',
    body: '10月17日 周五 09:00 – 11:00',
    meta: '教学一楼 101',
  },
  {
    tone: 'plain', time: '07:30',
    title: '大学英语',
    body: '08:00 – 09:40',
    meta: '外语楼 105',
  },
  {
    tone: 'warn', time: '昨天 23:00',
    title: '习题册 P41–P45（高等数学）',
    body: '今天 23:00',
  },
]

export function NotifCard({ n }: { n: Notif }) {
  return (
    <div
      className="rounded-[20px] px-3.5 py-3"
      style={{
        background: 'rgba(255,255,255,.30)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      <div className="flex items-center">
        <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-(--c-accent)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"><rect x="3" y="4" width="18" height="17" rx="4" /><path d="M3 9h18" /></svg>
        </span>
        <span className="ml-1.5 flex-1 text-[11.5px] font-semibold tracking-[-.01em] text-white/75">日历</span>
        <span className="text-[11.5px] font-medium tabular-nums text-white/60">{n.time}</span>
      </div>
      <div className="mt-1.5 text-[14px] leading-[1.32] font-semibold tracking-[-.01em] text-white">{n.title}</div>
      <div className="mt-0.5 text-[13px] leading-[1.35] font-normal text-white/80">{n.body}</div>
      {n.meta && <div className="mt-0.5 text-[13px] leading-[1.35] font-normal tabular-nums text-white/80">{n.meta}</div>}
    </div>
  )
}

export function LockScreen() {
  return (
    <Phone>
      <img src="/wall.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" />
      <div className="absolute inset-0 bg-[#0E1116]/45 backdrop-blur-[2px]" />
      <div className="relative flex-1 px-3.5 pt-12">
        <div className="text-center text-white">
          <div className="text-[15px] font-semibold tracking-[-.01em] opacity-85">10月14日 周二</div>
          <div className="mt-0.5 text-[74px] leading-[1.02] font-semibold tracking-[-.03em] tabular-nums">09:45</div>
        </div>
        <div className="mt-8 space-y-2.5">
          {notifs.map((n) => <NotifCard key={n.title} n={n} />)}
        </div>
      </div>
    </Phone>
  )
}

export const notifPrefs: [string, [string, string][]][] = [
  ['上课', [
    ['上课前提醒', '15 分钟'],
    ['首节课额外提醒', '30 分钟'],
  ]],
  ['作业与考试', [
    ['作业截止前', '1 天、2 小时'],
    ['考试前', '7 天、3 天、1 天及当天'],
  ]],
]

export function NotifPrefScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19 8 12l7-7" /></svg>
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">提醒</h1>
        </div>
        <div className="mt-6 px-5">
          <div className="flex items-center rounded-[18px] bg-(--c-surface) px-4 py-3.5">
            <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">已同步至系统日历</span>
            <span className="text-[12.5px] font-bold text-(--c-accent)">打开日历</span>
          </div>
        </div>
        <div className="mt-5 px-5">
          {notifPrefs.map(([g, rows]) => (
            <div key={g} className="mt-5 first:mt-0">
              <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink4)">{g}</div>
              <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
                {rows.map(([k, v], i) => (
                  <div key={k} className={`flex items-center py-3.5 ${i ? 'border-t border-(--c-line2)' : ''}`}>
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                    <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{v}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.2" className="ml-2"><path d="m9 5 7 7-7 7" /></svg>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  )
}
