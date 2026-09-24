/** 统计：学期走到哪、每门课上到哪，请过假的课单独标出来 */
import type { Course, OverrideKind, SessionRule } from '../../domain/types'
import { dateOf, weekOf } from '../../domain/dates'
import { maskToWeeks } from '../../domain/weeks'
import { useStore } from '../store'
import { todayStr } from '../semester'
import { Chevron, SubPage } from '../ui'

const periodsOf = (r: SessionRule) => r.endPeriod - r.startPeriod + 1


/* 统计：学期走到哪、每门课上到哪，请过假的课单独标出来；可直接给导师或老师看 */
export function StatsPage({ onBack, onCourse, onChanges, onTodo }: { onBack: () => void; onCourse: (c: Course) => void; onChanges: () => void; onTodo: () => void }) {
  const state = useStore()
  const sem = state.semester
  const live = state.courses.filter((c) => !c.removedByImport)
  const today = todayStr()
  const ruleCourse = new Map(state.rules.map((r) => [r.id, r.courseId]))

  const rows = live.map((c) => {
    const rs = state.rules.filter((r) => r.courseId === c.id)
    const weeks = new Set<number>()
    let total = 0
    let done = 0
    for (const r of rs) {
      for (const w of maskToWeeks(r.weeksMask)) {
        weeks.add(w)
        total += periodsOf(r)
        if (sem && dateOf(sem, w, r.weekday) < today) done += periodsOf(r)
      }
    }
    const leave = state.overrides.filter((o) => o.kind === 'leave' && ruleCourse.get(o.ruleId) === c.id).length
    return { c, total, done, weekly: weeks.size ? Math.round(total / weeks.size) : 0, leave }
  })
  const totalPeriods = rows.reduce((a, r) => a + r.total, 0)
  const weekly = sem && sem.totalWeeks > 0 ? Math.round(totalPeriods / sem.totalWeeks) : 0
  const week = sem ? Math.min(Math.max(weekOf(sem, today), 0), sem.totalWeeks) : 0

  const byCategory = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = r.c.category?.trim() || ''
    byCategory.set(k, [...(byCategory.get(k) ?? []), r])
  }
  const cats = [...byCategory.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'zh-CN')))
  const donePeriods = rows.reduce((a, r) => a + r.done, 0)
  const facts = [
    live.length > 0 ? `${live.length} 门课` : '',
    weekly > 0 ? `每周 ${weekly} 节` : '',
    donePeriods > 0 ? `已上 ${donePeriods} 节` : '',
  ].filter(Boolean)

  const liveIds = new Set(live.map((c) => c.id))
  const ovs = state.overrides.filter((o) => liveIds.has(ruleCourse.get(o.ruleId) ?? ''))
  const nOv = (k: OverrideKind) => ovs.filter((o) => o.kind === k).length
  const homework = state.tasks.filter((t) => t.kind === 'homework')
  const exams = state.tasks.filter((t) => t.kind === 'exam')
  const firstDays = new Set(state.rules.filter((r) => liveIds.has(r.courseId) && r.startPeriod === 1).map((r) => r.weekday)).size
  type More = [string, string, (() => void) | null]
  const more = (
    [
      ['第一节有课', firstDays > 0 ? `每周 ${firstDays} 天` : '', null],
      ['作业', homework.length > 0 ? `${homework.filter((t) => t.done).length} / ${homework.length} 已完成` : '', onTodo],
      ['考试', exams.length > 0 ? `${exams.length} 场` : '', onTodo],
      ['请假', nOv('leave') > 0 ? `${nOv('leave')} 次` : '', onChanges],
      ['停课', nOv('cancelled') > 0 ? `${nOv('cancelled')} 次` : '', onChanges],
      ['调课', nOv('moved') > 0 ? `${nOv('moved')} 次` : '', onChanges],
    ] as More[]
  ).filter((m) => m[1])

  return (
    <SubPage title="统计" onBack={onBack}>
      {sem && (
        <div className="rounded-[18px] bg-(--c-surface) px-4 pt-4 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-extrabold tracking-[-.02em] text-(--c-ink)">第 {week} 周</span>
            <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">共 {sem.totalWeeks} 周</span>
          </div>
          <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-(--c-surface2)">
            <div className="h-full rounded-full bg-(--c-ink)" style={{ width: `${sem.totalWeeks > 0 ? Math.min(100, (week / sem.totalWeeks) * 100) : 0}%` }} />
          </div>
          {facts.length > 0 && (
            <div className="mt-3.5 flex gap-3 text-[12.5px] font-medium tabular-nums text-(--c-ink3)">
              {facts.map((f) => <span key={f}>{f}</span>)}
            </div>
          )}
        </div>
      )}

      {cats.map((cat) => (
        <div key={cat || '_'} className="mt-5">
          <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{cat || (cats.length > 1 ? '其他' : '课程')}</div>
          <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
            {(byCategory.get(cat) ?? []).map(({ c, total, done, weekly: w, leave }, i) => {
              const meta = [c.teacher ?? '', w > 0 ? `每周 ${w} 节` : ''].filter(Boolean)
              return (
                <button key={c.id} onClick={() => onCourse(c)} className={`block w-full py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
                  <div className="flex items-baseline">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-(--c-ink)">{c.name}</span>
                    {total > 0 && <span className="ml-3 flex-none text-[12.5px] font-semibold tabular-nums text-(--c-ink3)">{done} / {total} 节</span>}
                  </div>
                  {total > 0 && (
                    <div className="mt-2 h-[4px] overflow-hidden rounded-full bg-(--c-surface2)">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (done / total) * 100)}%`, background: c.color }} />
                    </div>
                  )}
                  {(meta.length > 0 || leave > 0) && (
                    <div className="mt-1.5 flex items-baseline text-[12px] font-medium tabular-nums text-(--c-ink4)">
                      <span className="flex min-w-0 flex-1 gap-2.5 truncate">{meta.map((m) => <span key={m}>{m}</span>)}</span>
                      {leave > 0 && <span className="ml-3 flex-none text-(--c-danger)">请假 {leave} 次</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {more.length > 0 && (
        <div className="mt-5">
          <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">本学期</div>
          <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
            {more.map(([k, v, go], i) => (
              <button key={k} onClick={go ?? undefined} disabled={!go} className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 disabled:active:opacity-100 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
                <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{v}</span>
                {go && <Chevron className="ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </SubPage>
  )
}
