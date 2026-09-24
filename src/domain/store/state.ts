import type { ChangeEntry, Course, ImportBatch, Override, Prefs, Semester, SessionRule, Task, UserEntry, WidgetStyle } from '../types'
import { WIDGET_STYLES, defaultPrefs } from '../types'
import type { Snapshot } from '../engine'
import { BUILTIN_RULES, type RuleManifest } from '../rules'

/* 本地权威存储。真相全部在内存 State，持久化通过 Persistence 适配器：
   Web 用 localStorage，Capacitor 换 SQLite 适配器，接口不变。 */

/** 往期学期：整份快照原样封存，只用于查看与导出 */
export interface SemesterArchive extends Snapshot {
  archivedAt: number
}

/** 持久化结构版本，`hydrate` 按它做一次性迁移 */
export const STATE_VERSION = 2

export interface State {
  version?: number
  semester: Semester | null
  archives: SemesterArchive[]
  courses: Course[]
  rules: SessionRule[]
  overrides: Override[]
  entries: UserEntry[]
  batches: ImportBatch[]
  changes: ChangeEntry[]
  userEditedCourseIds: string[]
  savedRules: RuleManifest[]
  tasks: Task[]
  prefs: Prefs
}

export function emptyState(): State {
  return {
    version: STATE_VERSION,
    semester: null, archives: [], courses: [], rules: [], overrides: [], entries: [],
    batches: [], changes: [], userEditedCourseIds: [], savedRules: [...BUILTIN_RULES], tasks: [],
    prefs: defaultPrefs(),
  }
}

/** 只保留当前 Prefs 有的字段；旧版本的本地通知偏好（静音时段、每日摘要等）在这里丢掉 */
function hydratePrefs(raw: unknown): Prefs {
  const d = defaultPrefs()
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const nums = (v: unknown, fallback: number[]) => (Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : fallback)
  return {
    classLead: typeof p.classLead === 'number' && p.classLead > 0 ? p.classLead : d.classLead,
    earlyLead: typeof p.earlyLead === 'number' ? p.earlyLead : d.earlyLead,
    taskLeads: nums(p.taskLeads, d.taskLeads),
    examDays: nums(p.examDays, d.examDays),
    widgetStyle: (WIDGET_STYLES as readonly string[]).includes(p.widgetStyle as string) ? (p.widgetStyle as WidgetStyle) : d.widgetStyle,
    name: typeof p.name === 'string' ? p.name : d.name,
    avatar: typeof p.avatar === 'string' ? p.avatar : d.avatar,
    wall: typeof p.wall === 'string' ? p.wall : d.wall,
  }
}

/** 从持久化读回的原始对象补齐类型：周次位掩码转 bigint，新字段补默认值 */
export function hydrate(s: State): State {
  for (const r of s.rules) r.weeksMask = BigInt(r.weeksMask as unknown as string)
  if (!s.archives) s.archives = []
  for (const a of s.archives) for (const r of a.rules) r.weeksMask = BigInt(r.weeksMask as unknown as string)
  if (!s.savedRules || s.savedRules.length === 0) s.savedRules = [...BUILTIN_RULES]
  if (!s.tasks) s.tasks = []
  for (const t of s.tasks) if (!t.photos) t.photos = []
  s.prefs = hydratePrefs(s.prefs)
  if ((s.version ?? 1) < 2) {
    // v1 身份键带 星期|起始节，去掉后才能和新导入对上
    const strip = (c: Course) => { c.identityKey = c.identityKey.replace(/\|\d+\|\d+$/, '') }
    s.courses.forEach(strip)
    for (const a of s.archives) a.courses.forEach(strip)
  }
  const dropOrphans = (snap: Pick<Snapshot, 'rules' | 'overrides'>) => {
    const ruleIds = new Set(snap.rules.map((r) => r.id))
    snap.overrides = snap.overrides.filter((o) => ruleIds.has(o.ruleId))
  }
  dropOrphans(s)
  s.archives.forEach(dropOrphans)
  s.version = STATE_VERSION
  return s
}

