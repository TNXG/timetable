/** 手动添加：临时安排 / 自习，每周或仅本次，带节次选择与重叠提示 */
import { useMemo, useState } from 'react'
import type { UserEntry } from '../../domain/types'
import { fmtMinutes, weekdayOf } from '../../domain/dates'
import { occurrencesOn, type Snapshot } from '../../domain/engine'
import { uid } from '../../domain/store'
import { store } from '../store'
import { defaultSemester, mondayOf, todayStr } from '../semester'
import { Chips, DateInput, Field, Page, PrimaryButton, TextInput, TopBar, WD_SHORT } from '../ui'
import { PageBody, PageFooter, PeriodPicker } from './shared'

/* ---------------- 手动添加（内页） ---------------- */

export function ManualAddPage({ snap, onBack }: { snap: Snapshot | null; onBack: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState(0)
  const [weekly, setWeekly] = useState(true)
  const [weekday, setWeekday] = useState(weekdayOf(todayStr()))
  const [date, setDate] = useState(todayStr())
  const [sp, setSp] = useState(1)
  const [ep, setEp] = useState(2)
  const [loc, setLoc] = useState('')
  const sem = snap?.semester
  const grid = sem?.timeGrid
  const timeText = (() => {
    const s = grid?.find((t) => t.index === sp)
    const e = grid?.find((t) => t.index === ep)
    return s && e ? `${fmtMinutes(s.start)} – ${fmtMinutes(e.end)}` : ''
  })()

  /** 同一天已有的安排，用于提前提示重叠 */
  const clash = useMemo(() => {
    if (!snap) return []
    const d = weekly
      ? (() => {
          const base = new Date(`${todayStr()}T00:00:00`)
          const cur = base.getDay() === 0 ? 7 : base.getDay()
          base.setDate(base.getDate() + (weekday - cur))
          return base.toISOString().slice(0, 10)
        })()
      : date
    return occurrencesOn(snap, d).filter((o) => o.startPeriod <= ep && o.endPeriod >= sp && o.status !== 'cancelled')
  }, [snap, weekly, weekday, date, sp, ep])

  const save = () => {
    if (!store.state.semester) store.setSemester(defaultSemester(mondayOf(todayStr())))
    const en: UserEntry = {
      id: uid(),
      semesterId: store.state.semester?.id ?? '',
      name: name.trim(),
      kind: kind === 1 ? 'study' : 'temp',
      startPeriod: sp,
      endPeriod: ep,
      location: loc.trim() || undefined,
      createdAt: Date.now(),
      ...(weekly ? { weekday } : { date }),
    }
    store.addEntry(en)
    onBack()
  }

  return (
    <Page>
      <PageBody>
        <TopBar title="手动添加" onBack={onBack} />

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">类型</div>
        <div className="mt-2.5"><Chips items={['临时安排', '自习']} active={kind} onPick={setKind} /></div>

        <div className="mt-4 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Field k="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 数据结构复习" /></Field>
          <Field k="重复">
            <div className="flex gap-1.5">
              <button onClick={() => setWeekly(false)} className={`rounded-[9px] px-2.5 py-[5px] text-[12px] font-bold ${!weekly ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-bg) text-(--c-ink3)'}`}>仅本次</button>
              <button onClick={() => setWeekly(true)} className={`rounded-[9px] px-2.5 py-[5px] text-[12px] font-bold ${weekly ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-bg) text-(--c-ink3)'}`}>每周</button>
            </div>
          </Field>
          {weekly ? (
            <Field k="星期">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                  <button key={w} onClick={() => setWeekday(w)} className={`flex-1 rounded-[9px] py-[5px] text-[12px] font-bold ${weekday === w ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'text-(--c-ink3)'}`}>{WD_SHORT[w]}</button>
                ))}
              </div>
            </Field>
          ) : (
            <Field k="日期"><DateInput value={date} onChange={setDate} /></Field>
          )}
          <Field k="地点"><TextInput value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="可选" /></Field>
        </div>

        {grid && (
          <div className="mt-2.5">
            <PeriodPicker grid={grid} sp={sp} ep={ep} onPick={(a, b) => { setSp(a); setEp(b) }} />
          </div>
        )}

        {clash.length > 0 && (
          <div className="mt-3 rounded-[16px] bg-(--c-amber-soft) px-4 py-3.5">
            <div className="text-[12.5px] font-bold text-(--c-amber)">这个时间已有 {clash.length} 项安排</div>
            <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">
              {clash.map((o) => `${o.name} ${o.startPeriod}–${o.endPeriod} 节`).join('；')}
            </div>
          </div>
        )}

      </PageBody>

      <PageFooter>
        <PrimaryButton disabled={!name.trim() || ep < sp} onClick={save}>添加</PrimaryButton>
      </PageFooter>
    </Page>
  )
}
