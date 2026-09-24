import type { Course, Diagnostic, SessionRule, Semester, TimeSlot } from './types'
export { extractPhone, detectDelimiter, parseCsvRows, parseCsv, parseWeekday, parseJsonTable } from "./importers/dsl";
export type { CsvMapping } from "./importers/dsl";
import { identityKey, identityName } from './engine'
import { parseWeekExpr } from './weeks'
import { COURSE_COLORS } from './palette'

/* ---------- 规则输出契约 ---------- */

export interface RuleCourse {
  name: string
  teacher?: string
  teacherPhone?: string
  location?: string
  weekday: number
  startPeriod: number
  endPeriod: number
  weeks: string // 周次表达式，引擎负责解析
  color?: string // 来源自带颜色（课程表自己导出的文件）
  raw?: Record<string, string>
}

export interface RuleOutput {
  courses: RuleCourse[]
  diagnostics: Diagnostic[]
  timeGrid?: TimeSlot[] // 课表自带节次表时覆盖学期设置
  /** 来源自带学期信息（开学日、周数）时覆盖学期设置 */
  semester?: Partial<Pick<Semester, 'name' | 'startDate' | 'totalWeeks'>>
}

/* ---------- 规范化：RuleOutput → Course/SessionRule ---------- */

export interface NormalizedCourse {
  course: Omit<Course, 'id' | 'semesterId'>
  rules: Omit<SessionRule, 'id' | 'courseId'>[]
}

export function normalize(out: RuleOutput, sem: Semester): { courses: NormalizedCourse[]; diagnostics: Diagnostic[] } {
  const diags = [...out.diagnostics]
  const byKey = new Map<string, NormalizedCourse>()
  let colorIdx = 0
  const colorByName = new Map<string, string>()
  for (const rc of out.courses) {
    const wk = parseWeekExpr(rc.weeks)
    if (wk.error) {
      diags.push({ level: 'error', code: 'UNPARSED_WEEKS', message: `「${rc.name}」周次无法解析：${rc.weeks}`, at: { snippet: rc.weeks } })
      continue
    }
    if (rc.endPeriod > sem.timeGrid.length) {
      diags.push({ level: 'error', code: 'PERIOD_OUT_OF_GRID', message: `「${rc.name}」节次 ${rc.startPeriod}-${rc.endPeriod} 超出节次表（共 ${sem.timeGrid.length} 节）` })
      continue
    }
    if (!colorByName.has(rc.name)) colorByName.set(rc.name, rc.color ?? COURSE_COLORS[colorIdx++ % COURSE_COLORS.length])
    const key = identityKey(rc.name, rc.teacher)
    let nc = byKey.get(key)
    if (!nc) {
      nc = {
        course: {
          name: rc.name,
          teacher: rc.teacher,
          teacherPhone: rc.teacherPhone,
          color: colorByName.get(rc.name)!,
          identityKey: key,
          hidden: false,
          source: 'import',
        },
        rules: [],
      }
      byKey.set(key, nc)
    } else if (nc.course.teacherPhone == null && rc.teacherPhone) {
      nc.course.teacherPhone = rc.teacherPhone
    }
    nc.rules.push({
      weekday: rc.weekday as SessionRule['weekday'],
      startPeriod: rc.startPeriod,
      endPeriod: rc.endPeriod,
      weeksMask: wk.mask,
      location: rc.location,
      teacher: rc.teacher,
      teacherPhone: rc.teacherPhone,
    })
  }
  return { courses: [...byKey.values()], diagnostics: diags }
}

/* ---------- 跨导入匹配 ---------- */

/** 本次导入的课 → 库里已有的同一门课。先按身份键，再按课名兜底（两边都只有一门同名课时） */
export function matchImport(existing: Course[], incoming: NormalizedCourse[]): Map<NormalizedCourse, Course> {
  const matched = new Map<NormalizedCourse, Course>()
  const free = new Map(existing.filter((c) => c.source === 'import').map((c) => [c.identityKey, c]))
  const rest: NormalizedCourse[] = []
  for (const nc of incoming) {
    const ex = free.get(nc.course.identityKey)
    if (ex) {
      matched.set(nc, ex)
      free.delete(nc.course.identityKey)
    } else rest.push(nc)
  }
  const count = (keys: Iterable<string>) => {
    const m = new Map<string, number>()
    for (const k of keys) m.set(identityName(k), (m.get(identityName(k)) ?? 0) + 1)
    return m
  }
  const inNames = count(rest.map((nc) => nc.course.identityKey))
  const exNames = count(free.keys())
  for (const nc of rest) {
    const name = identityName(nc.course.identityKey)
    if (inNames.get(name) !== 1 || exNames.get(name) !== 1) continue
    const ex = [...free.values()].find((c) => identityName(c.identityKey) === name)!
    matched.set(nc, ex)
    free.delete(ex.identityKey)
  }
  return matched
}

export const ruleSignature = (r: Pick<SessionRule, 'weekday' | 'startPeriod' | 'endPeriod' | 'weeksMask' | 'location'>) =>
  `${r.weekday}:${r.startPeriod}-${r.endPeriod}:${r.weeksMask}:${r.location ?? ''}`

/** 给本次导入的每条规则找旧规则接班（沿用 id，Override / 变更记录不失联）：
    先同星期同节次，再同星期同起始节，最后同星期里起始节最近的；一条旧规则只接一次 */
export function pairRules<T extends Pick<SessionRule, 'weekday' | 'startPeriod' | 'endPeriod'>>(
  oldRules: SessionRule[], newRules: T[],
): Map<T, SessionRule> {
  const out = new Map<T, SessionRule>()
  const free = new Set(oldRules)
  const passes: ((a: T, b: SessionRule) => boolean)[] = [
    (a, b) => a.weekday === b.weekday && a.startPeriod === b.startPeriod && a.endPeriod === b.endPeriod,
    (a, b) => a.weekday === b.weekday && a.startPeriod === b.startPeriod,
    (a, b) => a.weekday === b.weekday,
  ]
  for (const ok of passes) {
    for (const nr of newRules) {
      if (out.has(nr)) continue
      let best: SessionRule | undefined
      for (const or of free) {
        if (!ok(nr, or)) continue
        if (!best || Math.abs(or.startPeriod - nr.startPeriod) < Math.abs(best.startPeriod - nr.startPeriod)) best = or
      }
      if (best) {
        out.set(nr, best)
        free.delete(best)
      }
    }
  }
  return out
}

/* ---------- 简化 diff：只列会变的 ---------- */

export interface ImportDiff {
  added: NormalizedCourse[]
  removed: Course[] // 本次导入里消失的（标 removedByImport，不物理删）
  changed: Course[] // 还在，但排课或教师有变（含上次消失这次又出现的）
  protectedKept: Course[] // 用户改过、本次保留用户值的
  unchanged: number
}

export function diffImport(existing: Course[], incoming: NormalizedCourse[], userEditedIds: Set<string>, rules: SessionRule[] = []): ImportDiff {
  const matched = matchImport(existing, incoming)
  const kept = new Set(matched.values())
  const added = incoming.filter((c) => !matched.has(c))
  const removed = existing.filter((c) => c.source === 'import' && !kept.has(c))
  const changed: Course[] = []
  const protectedKept: Course[] = []
  for (const [nc, ex] of matched) {
    const edited = userEditedIds.has(ex.id)
    if (edited) protectedKept.push(ex)
    const before = rules.filter((r) => r.courseId === ex.id).map(ruleSignature).sort().join('|')
    const after = nc.rules.map(ruleSignature).sort().join('|')
    if (ex.removedByImport || before !== after || (!edited && (ex.teacher ?? '') !== (nc.course.teacher ?? ''))) changed.push(ex)
  }
  const touched = new Set([...changed, ...protectedKept]).size
  return { added, removed, changed, protectedKept, unchanged: Math.max(0, matched.size - touched) }
}
