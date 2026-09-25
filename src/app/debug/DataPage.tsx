/** 调试 · 数据：本机 State 规模与持久化落地情况 */
import { STATE_VERSION } from '../../domain/store'
import { persistenceKind, useStore } from '../store'
import { Group, KV } from './kit'
import { Page, TopBar } from '../ui'

/** 体积：小于 1 KB 报字节，再往上 KB / MB 一位小数 */
function bytesText(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/* 只读展示：数量与体积对不上（比如导入后课程没落库）时，这里能立刻看出来 */
export function DataPage({ onBack }: { onBack: () => void }) {
  const s = useStore()
  const keys: [string, number][] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push([k, (localStorage.getItem(k) ?? '').length])
    }
  } catch {
    /* 私密模式等拿不到：留空 */
  }
  const bytes = (() => {
    try {
      return JSON.stringify(s).length
    } catch {
      return 0
    }
  })()
  const tasks = {
    total: s.tasks.length,
    homework: s.tasks.filter((t) => t.kind === 'homework').length,
    exam: s.tasks.filter((t) => t.kind === 'exam').length,
    photos: s.tasks.reduce((n, t) => n + (t.photos?.length ?? 0), 0),
  }
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="数据" sub="本机数据与持久化" onBack={onBack} />
        <Group title="课表">
          <KV k="学期" v={s.semester?.name || '未设置'} sub={s.semester ? `${s.semester.startDate} 起 · ${s.semester.totalWeeks} 周` : ''} />
          <KV k="课程与规则" v={`${s.courses.length} / ${s.rules.length}`} sub="课程 / 每周安排" />
          <KV k="调整与条目" v={`${s.overrides.length} / ${s.entries.length}`} sub="单次调整 / 手动条目" />
          <KV k="导入与变更" v={`${s.batches.length} / ${s.changes.length}`} sub="导入批次 / 变更记录" />
          <KV k="规则库与存档" v={`${s.savedRules.length} / ${s.archives.length}`} sub="导入规则 / 往期学期" />
        </Group>
        <Group title="作业">
          <KV k="合计" v={`${tasks.total} 项`} sub={`作业 ${tasks.homework} · 考试 ${tasks.exam}`} />
          <KV k="照片" v={`${tasks.photos} 张`} />
        </Group>
        <Group title="持久化">
          <KV k="后端" v={persistenceKind || '未初始化'} sub={persistenceKind === 'sqlite' ? 'timetable.db · app_state' : 'localStorage · tt.state'} />
          <KV k="结构版本" v={String(STATE_VERSION)} sub={`内存里 ${s.version ?? 1}`} />
          <KV k="快照体积" v={bytesText(bytes)} sub={`localStorage ${keys.length} 项`} />
        </Group>
        <Group title="localStorage">
          {keys.length === 0 ? <KV k="条目" v="空" /> : null}
          {keys.sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <KV key={k} k={k} v={bytesText(n)} />
          ))}
        </Group>
      </div>
    </Page>
  )
}
