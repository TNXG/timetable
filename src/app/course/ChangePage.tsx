/** 变更记录：导入改动与单节调整，可撤销 */
import type { OverrideKind } from '../../domain/types'
import { fromDate } from '../../domain/dates'
import { store, useStore } from '../store'
import { EmptyBlock, Page, TextAction, TopBar, WD, md } from '../ui'
import { PageBody } from './shared'

/* ---------------- 变更记录（内页） ---------------- */

const FIELD_LABEL: Record<string, string> = {
  name: '名称', teacher: '老师', credit: '学分', color: '颜色',
  location: '地点', weekday: '星期', startPeriod: '起始节次', endPeriod: '结束节次',
}

/** 单节状态：undefined 表示正常上课 */

const OV_WHAT: Record<string, string> = {
  moved: '调课', cancelled: '停课', leave: '请假', done: '已上', muted: '静音',
}
/** 与首页课程行同一套 Badge 配色 */
const BADGE: Record<string, string> = {
  moved: 'bg-(--c-accent-soft) text-(--c-accent)',
  leave: 'bg-(--c-rose-soft) text-(--c-rose)',
  edit: 'bg-(--c-amber-soft) text-(--c-amber)',
}
function Badge({ kind, children }: { kind: string; children: React.ReactNode }) {
  return (
    <span className={`flex-none rounded-[7px] px-2 py-[3px] text-[10.5px] font-bold ${BADGE[kind] ?? 'bg-(--c-surface2) text-(--c-ink3)'}`}>{children}</span>
  )
}

export function ChangePage({ courseId, onBack }: { courseId?: string; onBack: () => void }) {
  const state = useStore()
  const courseOfTarget = (target: string) =>
    state.courses.find((x) => x.id === target) ??
    state.courses.find((x) => x.id === state.rules.find((r) => r.id === target)?.courseId)
  const fmtVal = (field: string, v?: string) => (field === 'weekday' && v ? WD[Number(v)] : v || '空')
  const periods = (a?: number, b?: number) => (a == null || b == null ? '' : a === b ? `${a} 节` : `${a}–${b} 节`)

  type Row = { key: string; at: number; date: string; course: string; kind: string; what: string; why: string; undo?: () => void }
  const rows: Row[] = []
  for (const c of state.changes) {
    const co = courseOfTarget(c.target)
    if (courseId && co?.id !== courseId) continue
    const label = FIELD_LABEL[c.field] ?? c.field
    rows.push({
      key: c.id, at: c.at, date: md(fromDate(new Date(c.at))), course: co?.name ?? '课程', kind: 'edit',
      what: c.field === 'location' ? '换教室' : `改${label}`,
      why: `${fmtVal(c.field, c.from)} → ${fmtVal(c.field, c.to)}，${c.actor === 'import' ? '导入' : '手动'}`,
    })
  }
  for (const o of state.overrides) {
    const rule = state.rules.find((r) => r.id === o.ruleId)
    const co = rule && state.courses.find((x) => x.id === rule.courseId)
    if (courseId && co?.id !== courseId) continue
    const base = periods(rule?.startPeriod, rule?.endPeriod)
    const why =
      o.kind === 'moved'
        ? [`${md(o.date)} ${base} → ${md(o.newDate ?? o.date)} ${periods(o.newStartPeriod ?? rule?.startPeriod, o.newEndPeriod ?? rule?.endPeriod)}`, o.newLocation && `改到 ${o.newLocation}`, o.newTeacher && `老师 ${o.newTeacher}`, o.note]
        : [base, o.note]
    rows.push({
      key: o.id, at: o.createdAt, date: md(o.date), course: co?.name ?? '课程', kind: o.kind,
      what: OV_WHAT[o.kind] ?? o.kind, why: why.filter(Boolean).join('，'),
      undo: () => store.removeOverride(o.ruleId, o.date),
    })
  }
  rows.sort((a, b) => b.at - a.at)
  const courseName = courseId ? state.courses.find((c) => c.id === courseId)?.name : undefined

  return (
    <Page>
      <PageBody>
        <TopBar title="变更记录" sub={rows.length > 0 ? [courseName, `共 ${rows.length} 条`].filter(Boolean).join('，') : undefined} onBack={onBack} />
        {rows.length === 0 ? (
          <div className="mt-14"><EmptyBlock kind="free" title="还没有变更" /></div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
            {rows.map((r, i) => (
              <div key={r.key} className={`flex items-baseline px-4 py-2.5 ${i > 0 ? 'border-t border-(--c-surface2)' : ''}`}>
                <span className="w-[58px] flex-none text-[11.5px] font-semibold tabular-nums text-(--c-ink5)">{r.date}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-(--c-ink)">{courseId ? r.why || r.what : r.course}</span>
                    <Badge kind={r.kind}>{r.what}</Badge>
                  </div>
                  {!courseId && r.why && <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink4)">{r.why}</div>}
                </div>
                {r.undo && <TextAction tone="mute" onClick={r.undo}>撤销</TextAction>}
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
