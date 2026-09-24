/** 数据页：课程列表 */
import type { Course } from '../../domain/types'
import { useStore } from '../store'
import { EmptyBlock, SubPage, WD } from '../ui'

export function CoursesPage({ onBack, onDetail, onManual }: { onBack: () => void; onDetail: (c: Course) => void; onManual: () => void }) {
  const state = useStore()
  const courses = state.courses.filter((c) => !c.removedByImport)
  return (
    <SubPage title="课程" sub={`${courses.length} 门`} onBack={onBack}>
      {courses.length === 0 ? (
        <EmptyBlock kind="none" title="无课程" actions={[['手动添加', onManual]]} />
      ) : (
        <div className="overflow-hidden rounded-[16px] bg-(--c-surface)">
          {courses.map((c, i) => {
            const slots = state.rules.filter((r) => r.courseId === c.id)
            return (
              <button key={c.id} onClick={() => onDetail(c)} className={`flex w-full items-center px-4 py-3.5 text-left transition-colors active:bg-(--c-bg) ${i > 0 ? 'border-t border-(--c-surface2)' : ''}`}>
                <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full" style={{ background: c.color }} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[14px] font-bold ${c.hidden ? 'text-(--c-ink5) line-through' : ''}`}>{c.name}</div>
                  <div className="mt-0.5 truncate text-[12px] font-medium text-(--c-ink4)">
                    {slots.length > 0 ? slots.map((s) => `${WD[s.weekday]} ${s.startPeriod}–${s.endPeriod}`).join('，') : '—'}
                  </div>
                </div>
                {c.teacher && <span className="ml-2 flex-none text-[11.5px] font-medium text-(--c-ink5)">{c.teacher}</span>}
              </button>
            )
          })}
        </div>
      )}
    </SubPage>
  )
}
