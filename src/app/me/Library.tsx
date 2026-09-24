/** 数据页：导入历史、回收站、课程列表 */
import type { Course } from '../../domain/types'
import { store, useStore } from '../store'
import { EmptyBlock, SubPage, TextAction, WD } from '../ui'

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const state = useStore()
  const batches = [...state.batches].reverse()
  return (
    <SubPage title="导入历史" sub={`共 ${batches.length} 次`} onBack={onBack}>
      {batches.length === 0 && <EmptyBlock kind="none" title="无导入记录" />}
      <div className="space-y-2.5">
        {batches.map((b) => (
          <div key={b.id} className="rounded-[16px] bg-(--c-surface) px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13.5px] font-bold">{b.ruleName} <span className="font-medium text-(--c-ink5)">v{b.ruleVersion}</span></span>
              <span className="text-[11.5px] font-medium tabular-nums text-(--c-ink4)">{new Date(b.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] font-medium text-(--c-ink3)">
              新增 {b.added}，更新 {b.updated}{b.removed > 0 ? `，消失 ${b.removed}` : ''}{b.failed > 0 ? `，失败 ${b.failed}` : ''}，用时 {(b.durationMs / 1000).toFixed(1)} 秒
            </div>
            {b.diagnostics.filter((d) => d.level === 'error').slice(0, 3).map((d, i) => (
              <div key={i} className="mt-1.5 text-[11.5px] font-medium text-(--c-danger)">{d.message}</div>
            ))}
          </div>
        ))}
      </div>
    </SubPage>
  )
}

export function TrashPage({ onBack }: { onBack: () => void }) {
  const state = useStore()
  const removed = state.courses.filter((c) => c.removedByImport)
  return (
    <SubPage title="回收站" sub={removed.length > 0 ? `${removed.length} 门课` : undefined} onBack={onBack}>
      {removed.length === 0 && <EmptyBlock kind="free" title="无课程" />}
      <div className="space-y-2.5">
        {removed.map((c) => (
          <div key={c.id} className="flex items-center rounded-[16px] bg-(--c-surface) px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold">{c.name}</div>
              <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{c.teacher ?? '—'}，上次导入时消失</div>
            </div>
            <div className="ml-3 flex flex-none items-center gap-4">
              <TextAction onClick={() => store.restoreCourse(c.id)}>恢复</TextAction>
              <TextAction tone="danger" onClick={() => store.purgeCourse(c.id)}>删除</TextAction>
            </div>
          </div>
        ))}
      </div>
    </SubPage>
  )
}

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
