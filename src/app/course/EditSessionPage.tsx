/** 编辑单节：仅本次（调课/请假/停课/静音）或每周（改规则） */
import { useState } from 'react'
import type { OverrideKind } from '../../domain/types'
import type { Snapshot } from '../../domain/engine'
import { uid } from '../../domain/store'
import { store, useStore } from '../store'
import { Chips, DateInput, Field, Page, PrimaryButton, TextInput, TopBar, WD, WD_SHORT, md } from '../ui'
import { PageBody, PageFooter, PeriodPicker } from './shared'

const STATUS: [OverrideKind | undefined, string][] = [
  [undefined, '正常'],
  ['leave', '请假'],
  ['cancelled', '停课'],
  ['muted', '静音'],
]


/* ---------------- 编辑单节（内页） ---------------- */

export function EditSessionPage({
  occ, snap, onBack,
}: {
  occ: { ruleId?: string; courseId?: string; name: string; date: string; startPeriod: number; endPeriod: number; location?: string; teacher?: string; start: number; end: number }
  snap: Snapshot
  onBack: () => void
}) {
  const state = useStore()
  const rule = state.rules.find((r) => r.id === occ.ruleId)
  const ov = state.overrides.find((o) => o.ruleId === occ.ruleId && o.date === occ.date)
  const [scope, setScope] = useState(0) // 0 仅本次 1 每周
  const [date, setDate] = useState(ov?.newDate ?? occ.date)
  const [weekday, setWeekday] = useState<number>(rule?.weekday ?? 1)
  const [sp, setSp] = useState(ov?.newStartPeriod ?? occ.startPeriod)
  const [ep, setEp] = useState(ov?.newEndPeriod ?? occ.endPeriod)
  const [loc, setLoc] = useState(ov?.newLocation ?? occ.location ?? '')
  const teacher0 = rule?.teacher ?? occ.teacher ?? ''
  const [teacher, setTeacher] = useState(ov?.newTeacher ?? teacher0)
  const [note, setNote] = useState(ov?.note ?? '')
  const [status, setStatus] = useState<number>(() => {
    const i = STATUS.findIndex(([k]) => k === ov?.kind)
    return i > 0 ? i : 0
  })
  const sem = snap.semester

  const changed =
    date !== occ.date ||
    sp !== occ.startPeriod ||
    ep !== occ.endPeriod ||
    loc.trim() !== (occ.location ?? '') ||
    teacher.trim() !== teacher0
  const dirty =
    scope === 1
      ? weekday !== rule?.weekday || sp !== occ.startPeriod || ep !== occ.endPeriod || loc.trim() !== (occ.location ?? '') || teacher.trim() !== teacher0
      : changed || note.trim() !== (ov?.note ?? '') || STATUS[status][0] !== (ov?.kind === 'moved' ? undefined : ov?.kind)

  const save = () => {
    if (!occ.ruleId) return
    if (scope === 1) {
      store.editSessionRule(occ.ruleId, { weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7, startPeriod: sp, endPeriod: ep, location: loc.trim() || undefined, ...(teacher.trim() !== teacher0 ? { teacher: teacher.trim() || undefined } : {}) })
      onBack()
      return
    }
    const kind = STATUS[status][0]
    if (!kind) {
      if (changed) {
        store.addOverride({
          id: uid(), ruleId: occ.ruleId, date: occ.date, kind: 'moved',
          newDate: date, newStartPeriod: sp, newEndPeriod: ep,
          newLocation: loc.trim() || undefined, newTeacher: teacher.trim() !== teacher0 ? teacher.trim() : undefined, note: note.trim() || undefined,
          createdAt: Date.now(),
        })
      } else if (ov) {
        store.removeOverride(occ.ruleId, occ.date)
      }
    } else {
      store.addOverride({
        id: uid(), ruleId: occ.ruleId, date: occ.date, kind,
        note: note.trim() || undefined, createdAt: Date.now(),
      })
    }
    onBack()
  }

  return (
    <Page>
      <PageBody>
        <TopBar title="编辑课程" sub={`${occ.name}，${md(occ.date)} ${WD[new Date(`${occ.date}T00:00:00`).getDay() === 0 ? 7 : new Date(`${occ.date}T00:00:00`).getDay()]} ${occ.startPeriod}–${occ.endPeriod} 节`} onBack={onBack} />

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">生效范围</div>
        <div className="mt-2.5"><Chips items={['仅本次', '每周']} active={scope} onPick={setScope} /></div>

        {scope === 0 && (
          <>
            <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">状态</div>
            <div className="mt-2.5"><Chips items={STATUS.map(([, l]) => l)} active={status} onPick={setStatus} /></div>
          </>
        )}

        <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">时间与地点</div>
        <div className="mt-2.5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          {scope === 0 ? (
            <Field k="日期"><DateInput value={date} onChange={setDate} /></Field>
          ) : (
            <Field k="星期">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                  <button key={w} onClick={() => setWeekday(w)} className={`flex-1 rounded-[9px] py-[5px] text-[12px] font-bold ${weekday === w ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'text-(--c-ink3)'}`}>{WD_SHORT[w]}</button>
                ))}
              </div>
            </Field>
          )}
          <Field k="地点"><TextInput value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="可选" /></Field>
          <Field k="老师"><TextInput value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="可选" /></Field>
          <Field k="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" /></Field>
        </div>

        <div className="mt-2.5">
          <PeriodPicker grid={sem.timeGrid} sp={sp} ep={ep} onPick={(a, b) => { setSp(a); setEp(b) }} />
        </div>

        {ov && (
          <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
            <button
              onClick={() => { store.removeOverride(occ.ruleId!, occ.date); onBack() }}
              className="w-full px-4 py-3.5 text-left text-[13.5px] font-bold text-(--c-rose) transition-colors active:bg-(--c-bg)"
            >
              撤销本节改动
            </button>
          </div>
        )}
      </PageBody>

      <PageFooter>
        <PrimaryButton disabled={ep < sp || !dirty} onClick={save}>保存</PrimaryButton>
      </PageFooter>
    </Page>
  )
}
