/** 课程冲突：同一时段多门课，可只留一门（其余本次停课） */
import { useState } from 'react'
import type { Occurrence } from '../../domain/types'
import { fmtDuration, fmtMinutes } from '../../domain/dates'
import { occurrencesOn, type Snapshot } from '../../domain/engine'
import { uid } from '../../domain/store'
import { store, useStore } from '../store'
import { Page, TextAction, TopBar, WD, md } from '../ui'
import { PageBody } from './shared'

/* ---------------- 课程冲突（内页） ---------------- */

export function ConflictPage({
  occ, snap, onBack, onCourse,
}: {
  occ: Occurrence
  snap: Snapshot
  onBack: () => void
  onCourse: (courseId: string) => void
}) {
  const state = useStore()
  const [pick, setPick] = useState(false)
  const sameDay = occurrencesOn(snap, occ.date).filter((o) => o.status !== 'cancelled')
  const others = sameDay.filter((o) => o.key !== occ.key && o.startPeriod <= occ.endPeriod && o.endPeriod >= occ.startPeriod)
  const group = [occ, ...others]
  const overlapStart = Math.max(...group.map((o) => o.start))
  const overlapEnd = Math.min(...group.map((o) => o.end))
  const overlapPeriods = `${Math.max(...group.map((o) => o.startPeriod))}–${Math.min(...group.map((o) => o.endPeriod))}`

  const keepOnly = (keepKey: string) => {
    for (const o of group) {
      if (o.key === keepKey) continue
      if (o.ruleId) store.addOverride({ id: uid(), ruleId: o.ruleId, date: o.date, kind: 'cancelled', note: '冲突时只留一门', createdAt: Date.now() })
    }
    onBack()
  }

  return (
    <Page>
      <PageBody>
        <TopBar title="课程冲突" sub={`${md(occ.date)} ${WD[occ.weekday]}，第 ${overlapPeriods} 节重叠`} onBack={onBack} />

        <div className="mt-5 rounded-[16px] bg-(--c-amber-soft) px-4 py-3.5">
          <div className="text-[12.5px] font-bold text-(--c-amber)">{group.length} 门课占用同一时段</div>
          <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">
            重叠 {fmtMinutes(overlapStart)} – {fmtMinutes(overlapEnd)}，共 {fmtDuration(overlapEnd - overlapStart)}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {group.map((o) => {
            const course = state.courses.find((c) => c.id === o.courseId)
            return (
              <div key={o.key} className="overflow-hidden rounded-[16px] bg-(--c-surface)">
                <div className="flex items-start px-4 pt-4">
                  <i className="mt-1 mr-3 h-[30px] w-[3px] flex-none rounded-full" style={{ background: o.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-extrabold tracking-[-.01em]">{o.name}</div>
                    <div className="mt-1 text-[12.5px] font-medium text-(--c-ink3)">
                      {fmtMinutes(o.start)} – {fmtMinutes(o.end)}，第 {o.startPeriod}–{o.endPeriod} 节
                      {o.location ? `，${o.location}` : ''}
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-(--c-ink5)">
                      {[o.teacher, o.source === 'import' ? '规则导入' : '手动添加'].filter(Boolean).join('，')}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-5 px-4 pb-3.5">
                  {course && <TextAction tone="mute" onClick={() => onCourse(course.id)}>课程详情</TextAction>}
                  {pick && <TextAction onClick={() => keepOnly(o.key)}>只留这门</TextAction>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between px-1">
          <span className="text-[12px] font-medium text-(--c-ink5)">{pick ? '其余几门仅本次停课' : '两门都保留时，课表里并列显示'}</span>
          {pick ? (
            <TextAction tone="mute" onClick={() => setPick(false)}>返回</TextAction>
          ) : (
            <TextAction onClick={() => setPick(true)}>只留一门</TextAction>
          )}
        </div>
      </PageBody>
    </Page>
  )
}
