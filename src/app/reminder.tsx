import { useEffect, useMemo, useState } from 'react'
import { Page, StickyHead, BackButton, TopBar, PrimaryButton, tint, WD, Tick } from './ui'
import { store, useStore } from './store'
import { addDays, fmtMinutes, weekOf, dateOf } from '../domain/dates'
import { todayStr } from './semester'
import { occurrencesOn, type Snapshot } from '../domain/engine'
import { CLASS_LEADS, EARLY_LEADS, TASK_LEADS, type Minutes, type Prefs } from '../domain/types'
import {
  calendarSupported, openCalendarSettings, openSystemCalendar,
  requestCalendarPermission, scheduleCalendarSync, useCalendarStatus,
} from './calendar'
import { nativeToast } from './widgets'

/* ---------------- 提醒（全部由手机日历发出） ---------------- */

type PrefKey = 'classLead' | 'earlyLead' | 'taskLeads' | 'examDays'

interface Option {
  label: string
  patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)
  match: (p: Prefs) => boolean
}

export const leadLabel = (m: Minutes) => (m % 1440 === 0 ? `${m / 1440} 天` : m % 60 === 0 ? `${m / 60} 小时` : `${m} 分钟`)

/** 作业提醒摘要：按提前量从大到小 */
export function taskLeadsText(leads: Minutes[]): string {
  if (leads.length === 0) return '不提醒'
  return `截止前 ${[...leads].sort((a, b) => b - a).map(leadLabel).join('、')}`
}

/** 「7 天、3 天、1 天及当天」 */
const examDaysLabel = (days: number[]) => {
  if (days.length === 0) return '不提醒'
  const ahead = [...days].filter((d) => d > 0).sort((a, b) => b - a).map((d) => `${d} 天`).join('、')
  const today = days.includes(0)
  return ahead ? (today ? `${ahead}及当天` : ahead) : '当天'
}

const OPTIONS: Record<PrefKey, { title: string; sub?: string; multi?: boolean; options: Option[] }> = {
  classLead: {
    title: '上课前提醒',
    options: CLASS_LEADS.map((n) => ({
      label: `${n} 分钟`,
      patch: { classLead: n },
      match: (p) => p.classLead === n,
    })),
  },
  earlyLead: {
    title: '首节课额外提醒',
    options: EARLY_LEADS.map((n) => ({
      label: n === 0 ? '不提醒' : `${n} 分钟`,
      patch: { earlyLead: n },
      match: (p) => p.earlyLead === n,
    })),
  },
  taskLeads: {
    title: '作业截止前',
    multi: true,
    options: TASK_LEADS.map((m) => ({
      label: leadLabel(m),
      patch: (p: Prefs) => ({ taskLeads: p.taskLeads.includes(m) ? p.taskLeads.filter((x) => x !== m) : [...p.taskLeads, m] }),
      match: (p: Prefs) => p.taskLeads.includes(m),
    })),
  },
  examDays: {
    title: '考试前',
    options: [
      { label: '7 天、3 天、1 天及当天', patch: { examDays: [7, 3, 1, 0] }, match: (p) => p.examDays.join() === '7,3,1,0' },
      { label: '3 天、1 天及当天', patch: { examDays: [3, 1, 0] }, match: (p) => p.examDays.join() === '3,1,0' },
      { label: '1 天及当天', patch: { examDays: [1, 0] }, match: (p) => p.examDays.join() === '1,0' },
      { label: '当天', patch: { examDays: [0] }, match: (p) => p.examDays.join() === '0' },
      { label: '不提醒', patch: { examDays: [] }, match: (p) => p.examDays.length === 0 },
    ],
  },
}

function valueOf(key: PrefKey, p: Prefs): string {
  if (key === 'taskLeads') return p.taskLeads.length === 0 ? '不提醒' : [...p.taskLeads].sort((a, b) => b - a).map(leadLabel).join('、')
  if (key === 'examDays') return examDaysLabel(p.examDays)
  const hit = OPTIONS[key].options.find((o) => o.match(p))
  return hit ? hit.label : '—'
}

const GROUPS: [string, PrefKey[]][] = [
  ['上课', ['classLead', 'earlyLead']],
  ['作业与考试', ['taskLeads', 'examDays']],
]

const rowCls = (i: number) => `flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`

const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.2" className="ml-2"><path d="m9 5 7 7-7 7" /></svg>
)

/** 顶部状态卡：已同步 / 未开启 / 权限被拒 */
function CalendarCard({ onOpen }: { onOpen: () => void }) {
  const cal = useCalendarStatus()
  if (!calendarSupported()) return null
  const granted = cal.permission === 'granted'
  const denied = cal.permission === 'denied'
  return (
    <button
      onClick={() => void (granted ? onOpen() : denied ? openCalendarSettings() : requestCalendarPermission())}
      className="mt-6 flex w-full items-center rounded-[18px] bg-(--c-surface) px-4 py-3.5 text-left transition-opacity active:opacity-60"
    >
      <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{granted ? '已同步至系统日历' : denied ? '日历权限已关闭' : '未同步至系统日历'}</span>
      <span className="text-[12.5px] font-bold text-(--c-accent)">{granted ? '打开日历' : denied ? '去设置' : '开启同步'}</span>
    </button>
  )
}

export function NotifPrefPage({ onBack, onPick }: { onBack: () => void; onPick: (k: PrefKey) => void }) {
  const state = useStore()
  const open = async () => {
    if (!(await openSystemCalendar())) nativeToast('没有找到日历应用')
  }
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-[130px] [scrollbar-width:none]">
        <TopBar title="提醒" onBack={onBack} />
        <CalendarCard onOpen={() => void open()} />
        <div className="mt-5">
          {GROUPS.map(([g, keys]) => (
            <div key={g} className="mt-5 first:mt-0">
              <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{g}</div>
              <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
                {keys.map((k, i) => (
                  <button key={k} onClick={() => onPick(k)} className={rowCls(i)}>
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{OPTIONS[k].title}</span>
                    <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{valueOf(k, state.prefs)}</span>
                    <Chevron />
                  </button>
                ))}
              </div>
            </div>
          ))}
         </div>
      </div>
    </Page>
  )
}

export function PrefPickPage({ pref, onBack }: { pref: PrefKey; onBack: () => void }) {
  const state = useStore()
  const { title, sub, multi, options } = OPTIONS[pref]
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-[130px] [scrollbar-width:none]">
        <TopBar title={title} sub={sub} onBack={onBack} />
        <div className="mt-6 rounded-[18px] bg-(--c-surface) px-4">
          {options.map((o, i) => {
            const on = o.match(state.prefs)
            return (
              <button
                key={o.label}
                onClick={() => {
                  store.setPrefs(typeof o.patch === 'function' ? o.patch(state.prefs) : o.patch)
                  scheduleCalendarSync()
                  if (!multi) onBack()
                }}
                className={rowCls(i)}
              >
                <span className={`flex-1 text-[14px] font-semibold ${on && !multi ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{o.label}</span>
                <Tick on={on} multi={multi} />
              </button>
            )
          })}
        </div>
      </div>
    </Page>
  )
}

/* ---------------- 首次：加进手机日历（全屏内页） ---------------- */

const KINDS: { color: string; label: string; lead: (p: Prefs) => string }[] = [
  { color: 'var(--c-accent)', label: '上课', lead: (p) => `提前 ${p.classLead} 分钟` },
  { color: 'var(--c-amber)', label: '作业', lead: (p) => (p.taskLeads.length > 0 ? `提前 ${[...p.taskLeads].sort((a, b) => b - a).map(leadLabel).join('、')}` : '不提醒') },
  { color: 'var(--c-rose)', label: '考试', lead: (p) => (p.examDays.length > 0 ? `提前 ${examDaysLabel(p.examDays)}` : '不提醒') },
]

export function CalendarIntroPage({ onDone }: { onDone: () => void }) {
  const state = useStore()
  const cal = useCalendarStatus()
  const [busy, setBusy] = useState(false)
  const denied = cal.permission === 'denied'

  useEffect(() => {
    if (cal.permission === 'granted' && !busy) onDone()
  }, [cal.permission])

  const go = async () => {
    if (denied) {
      await openCalendarSettings()
      return
    }
    setBusy(true)
    const s = await requestCalendarPermission()
    if (s === 'granted') {
      onDone()
      return
    }
    setBusy(false)
  }

  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <TopBar title="同步至系统日历" />
        <div className="mt-6 rounded-[18px] bg-(--c-surface) px-4">
          {KINDS.map((k, i) => (
            <div key={k.label} className={`flex items-center py-3.5 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
              <i className="mr-3 h-[9px] w-[9px] flex-none rounded-full" style={{ background: k.color }} />
              <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k.label}</span>
              <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{k.lead(state.prefs)}</span>
            </div>
          ))}
        </div>
        {denied && <div className="mt-3 px-1 text-[12px] leading-[1.5] font-medium text-(--c-rose)">日历权限已关闭。</div>}
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton busy={busy} onClick={() => void go()}>{denied ? '去系统设置允许' : '开启同步'}</PrimaryButton>
      </div>
    </Page>
  )
}


export type { PrefKey }
