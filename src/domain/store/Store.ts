import type { ChangeEntry, Course, ImportBatch, Override, Prefs, Semester, SessionRule, Task, TaskPhoto, UserEntry } from '../types'
import type { Snapshot } from '../engine'
import type { ImportDiff, NormalizedCourse } from '../importer'
import { diffImport, matchImport, pairRules } from '../importer'
import type { RuleManifest } from '../rules'
import { emptyState, type SemesterArchive, type State } from './state'
import type { Persistence } from './persist'

let seq = 0
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

export class Store {
  state: State
  private listeners = new Set<() => void>()
  private saveQueued = false

  constructor(private persistence: Persistence) {
    this.state = persistence.load() ?? emptyState()
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** 内存优先更新 + 微任务合批持久化（借鉴 lexicon SyncEngine） */
  private commit() {
    for (const fn of this.listeners) fn()
    if (this.saveQueued) return
    this.saveQueued = true
    queueMicrotask(() => {
      this.saveQueued = false
      this.persistence.save(this.state)
    })
  }

  snapshot(): Snapshot | null {
    const s = this.state
    if (!s.semester) return null
    return { semester: s.semester, courses: s.courses, rules: s.rules, overrides: s.overrides, entries: s.entries }
  }

  /** 整份数据清空，回到刚安装的状态 */
  reset() {
    this.state = emptyState()
    this.commit()
  }

  setSemester(sem: Semester) {
    this.state = { ...this.state, semester: sem }
    this.commit()
  }

  /** 开始新学期：当前学期连课程一起封存进往期，课表清空；作息、待办、规则与偏好保留 */
  startSemester(next: Semester) {
    const cur = this.snapshot()
    const archives = cur && (cur.courses.length > 0 || cur.entries.length > 0)
      ? [...this.state.archives.filter((a) => a.semester.id !== cur.semester.id), { ...cur, archivedAt: Date.now() }]
      : this.state.archives
    this.state = {
      ...this.state,
      semester: next,
      archives,
      courses: [], rules: [], overrides: [], entries: [], changes: [], userEditedCourseIds: [],
    }
    this.commit()
  }

  removeArchive(semesterId: string) {
    this.state = { ...this.state, archives: this.state.archives.filter((a) => a.semester.id !== semesterId) }
    this.commit()
  }

  addOverride(ov: Override) {
    this.state = { ...this.state, overrides: [...this.state.overrides.filter((o) => !(o.ruleId === ov.ruleId && o.date === ov.date)), ov] }
    this.commit()
  }

  removeOverride(ruleId: string, date: string) {
    this.state = { ...this.state, overrides: this.state.overrides.filter((o) => !(o.ruleId === ruleId && o.date === date)) }
    this.commit()
  }

  addEntry(en: UserEntry) {
    this.state = { ...this.state, entries: [...this.state.entries, en] }
    this.commit()
  }

  removeEntry(id: string) {
    this.state = { ...this.state, entries: this.state.entries.filter((e) => e.id !== id) }
    this.commit()
  }

  /** 改常规安排（每周生效），记一条变更 */
  editSessionRule(ruleId: string, patch: Partial<Pick<SessionRule, 'weekday' | 'startPeriod' | 'endPeriod' | 'location' | 'teacher'>>) {
    const before = this.state.rules.find((r) => r.id === ruleId)
    if (!before) return
    const changes: ChangeEntry[] = Object.entries(patch)
      .filter(([k, v]) => before[k as keyof SessionRule] !== v)
      .map(([k, v]) => ({
        id: uid(), at: Date.now(), actor: 'user', target: ruleId, field: k,
        from: String(before[k as keyof SessionRule] ?? ''), to: String(v ?? ''),
      }))
    this.state = {
      ...this.state,
      rules: this.state.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      changes: [...this.state.changes, ...changes],
      userEditedCourseIds: [...new Set([...this.state.userEditedCourseIds, before.courseId])],
    }
    this.commit()
  }

  setPrefs(patch: Partial<Prefs>) {
    this.state = { ...this.state, prefs: { ...this.state.prefs, ...patch } }
    this.commit()
  }

  addTask(t: Task) {
    this.state = { ...this.state, tasks: [...this.state.tasks, t] }
    this.commit()
  }

  editTask(id: string, patch: Partial<Task>) {
    this.state = { ...this.state, tasks: this.state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
    this.commit()
  }

  removeTask(id: string) {
    this.state = { ...this.state, tasks: this.state.tasks.filter((t) => t.id !== id) }
    this.commit()
  }

  addPhotos(taskId: string, photos: TaskPhoto[]) {
    this.editTask(taskId, {
      photos: [...(this.state.tasks.find((t) => t.id === taskId)?.photos ?? []), ...photos],
    })
  }

  removePhoto(taskId: string, photoId: string) {
    const t = this.state.tasks.find((x) => x.id === taskId)
    if (!t) return
    this.editTask(taskId, { photos: (t.photos ?? []).filter((p) => p.id !== photoId) })
  }

  setCourseHidden(courseId: string, hidden: boolean) {
    this.state = {
      ...this.state,
      courses: this.state.courses.map((c) => (c.id === courseId ? { ...c, hidden } : c)),
    }
    this.commit()
  }

  setCourseSticker(courseId: string, sticker: string | undefined) {
    this.state = {
      ...this.state,
      courses: this.state.courses.map((c) => {
        if (c.id !== courseId) return c
        const { sticker: _, ...rest } = c
        return sticker === undefined ? rest : { ...rest, sticker }
      }),
    }
    this.commit()
  }

  editCourse(courseId: string, patch: Partial<Pick<Course, 'name' | 'teacher' | 'teacherPhone' | 'color' | 'credit' | 'category'>>) {
    const before = this.state.courses.find((c) => c.id === courseId)
    if (!before) return
    const changes: ChangeEntry[] = Object.entries(patch)
      .filter(([k, v]) => before[k as keyof Course] !== v)
      .map(([k, v]) => ({
        id: uid(), at: Date.now(), actor: 'user', target: courseId, field: k,
        from: String(before[k as keyof Course] ?? ''), to: String(v ?? ''),
      }))
    this.state = {
      ...this.state,
      courses: this.state.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)),
      changes: [...this.state.changes, ...changes],
      userEditedCourseIds: [...new Set([...this.state.userEditedCourseIds, courseId])],
    }
    this.commit()
  }

  saveRule(rule: RuleManifest) {
    const exists = this.state.savedRules.some((r) => r.id === rule.id)
    this.state = {
      ...this.state,
      savedRules: exists
        ? this.state.savedRules.map((r) => (r.id === rule.id ? rule : r))
        : [...this.state.savedRules, rule],
    }
    this.commit()
  }

  removeRule(id: string) {
    if (id.startsWith('builtin-')) return
    this.state = { ...this.state, savedRules: this.state.savedRules.filter((r) => r.id !== id) }
    this.commit()
  }

  restoreCourse(courseId: string) {
    this.state = {
      ...this.state,
      courses: this.state.courses.map((c) => (c.id === courseId ? { ...c, removedByImport: false, hidden: false } : c)),
    }
    this.commit()
  }

  purgeCourse(courseId: string) {
    this.state = {
      ...this.state,
      courses: this.state.courses.filter((c) => c.id !== courseId),
      rules: this.state.rules.filter((r) => r.courseId !== courseId),
      overrides: this.state.overrides.filter((o) => this.state.rules.find((r) => r.id === o.ruleId)?.courseId !== courseId),
    }
    this.commit()
  }

  previewImport(incoming: NormalizedCourse[]): ImportDiff {
    return diffImport(this.state.courses, incoming, new Set(this.state.userEditedCourseIds), this.state.rules)
  }

  /** 事务式导入：全部计算完成后一次性替换状态。三方合并：
      - 用户改过的课保留用户字段，只更新排课规则
      - 规则尽量沿用旧 id（同星期同节次优先），挂在上面的 Override 和变更记录继续有效；
        没有接班规则的 Override 随课次一起去掉
      - 本次消失的标 removedByImport，不物理删除，规则和 Override 保留
      - UserEntry 永不触碰 */
  applyImport(incoming: NormalizedCourse[], batch: Omit<ImportBatch, 'added' | 'updated' | 'removed'>): ImportDiff {
    const diff = this.previewImport(incoming)
    const edited = new Set(this.state.userEditedCourseIds)
    const matched = matchImport(this.state.courses, incoming)
    const kept = new Set(matched.values())
    const importIds = new Set(this.state.courses.filter((c) => c.source === 'import').map((c) => c.id))

    const courses: Course[] = this.state.courses.filter((c) => c.source !== 'import')
    const rules: SessionRule[] = this.state.rules.filter((r) => !importIds.has(r.courseId))
    const liveRuleIds = new Set(rules.map((r) => r.id))
    let updated = 0

    for (const nc of incoming) {
      const ex = matched.get(nc)
      let course: Course
      let oldRules: SessionRule[] = []
      if (ex) {
        course = edited.has(ex.id)
          ? { ...ex, teacherPhone: ex.teacherPhone ?? nc.course.teacherPhone, removedByImport: false } // 保留用户值
          : { ...ex, ...nc.course, id: ex.id, semesterId: ex.semesterId, removedByImport: false }
        oldRules = this.state.rules.filter((r) => r.courseId === ex.id)
        updated++
      } else {
        course = { ...nc.course, id: uid(), semesterId: this.state.semester?.id ?? '' }
      }
      courses.push(course)
      const pairs = pairRules(oldRules, nc.rules)
      for (const r of nc.rules) {
        const id = pairs.get(r)?.id ?? uid()
        rules.push({ ...r, id, courseId: course.id })
        liveRuleIds.add(id)
      }
    }
    // 消失的：课、规则、Override 原样保留以便恢复
    for (const c of this.state.courses) {
      if (c.source !== 'import' || kept.has(c)) continue
      courses.push({ ...c, removedByImport: true, hidden: true })
      for (const r of this.state.rules) {
        if (r.courseId !== c.id) continue
        rules.push(r)
        liveRuleIds.add(r.id)
      }
    }
    const overrides = this.state.overrides.filter((o) => liveRuleIds.has(o.ruleId))

    const fullBatch: ImportBatch = {
      ...batch, added: diff.added.length, updated, removed: diff.removed.length,
    }
    this.state = { ...this.state, courses, rules, overrides, batches: [...this.state.batches, fullBatch] }
    this.commit()
    return diff
  }

  /** 回滚到某次导入前：删除该批次引入的课程与规则的最简实现——
      依赖批次时间戳之后 source=import 的内容整体重放。P0 先支持回滚最近一次。 */
  rollbackLastImport(prev: State) {
    this.state = prev
    this.commit()
  }

  cloneState(): State {
    return JSON.parse(JSON.stringify(this.state, (_, v) => (typeof v === 'bigint' ? v.toString() : v)), (k, v) =>
      k === 'weeksMask' ? BigInt(v) : v) as State
  }
}
