import type { Diagnostic, TimeSlot } from '../types'
import type { RuleCourse, RuleOutput } from '../importer'
import { parsePeriodRange } from '../weeks'

const PHONE_RE = /(?:\+?86[- ]?)?1[3-9]\d(?:[ \-]?\d){8}/

/** 从任意文本里取出第一个大陆手机号，去 86 前缀与分隔符 */
export function extractPhone(s: unknown): string | undefined {
  if (typeof s === 'number') s = String(s)
  if (typeof s !== 'string') return undefined
  const m = s.match(PHONE_RE)
  return m ? m[0].replace(/[\s\-]/g, '').replace(/^\+?86/, '') : undefined
}


function parseHm(s: unknown): number | null {
  const m = typeof s === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(s.trim()) : null
  return m ? +m[1] * 60 + +m[2] : null
}

function parseTimeSlots(raw: unknown): TimeSlot[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const slots: TimeSlot[] = []
  for (const x of raw) {
    const o = x as Record<string, unknown>
    const index = typeof o.node === 'number' ? o.node : typeof o.index === 'number' ? o.index : NaN
    const start = parseHm(o.startTime)
    const end = parseHm(o.endTime)
    if (!(index >= 1) || start == null || end == null || end <= start) return undefined
    slots.push({ index, start, end })
  }
  slots.sort((a, b) => a.index - b.index)
  return slots.length > 0 && slots.every((s, i) => s.index === i + 1) ? slots : undefined
}


/* ---------- 声明式 DSL（JSON 课表 / CSV / WakeUp 风格） ---------- */

export interface CsvMapping {
  name: number
  teacher?: number
  teacherPhone?: number
  location?: number
  weekday: number
  periods: number
  weeks: number
  skipRows?: number
  delimiter?: string
}

/** 没指定分隔符时看第一行：逗号 / Tab / 分号里哪个最多 */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  let best = ','
  let n = -1
  for (const d of [',', '\t', ';']) {
    const c = first.split(d).length - 1
    if (c > n) {
      best = d
      n = c
    }
  }
  return best
}

/** RFC 4180：双引号包裹的字段里可含分隔符、换行，"" 表示一个引号；每行一条记录 */
export function parseCsvRows(text: string, delim: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    cells.push(cell)
    if (cells.some((c) => c.trim())) rows.push({ cells: cells.map((c) => c.trim()), line: rowLine })
    cells = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === delim) {
      cells.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
      line++
      rowLine = line
    } else cell += ch
  }
  endRow()
  return rows
}

export function parseCsv(text: string, map: CsvMapping): RuleOutput {
  const diags: Diagnostic[] = []
  const courses: RuleCourse[] = []
  const src = text.replace(/^\uFEFF/, '')
  const delim = map.delimiter ?? detectDelimiter(src)
  const rows = parseCsvRows(src, delim).slice(map.skipRows ?? 0)
  rows.forEach(({ cells, line: row }) => {
    const name = cells[map.name]
    if (!name) {
      diags.push({ level: 'error', code: 'MISSING_NAME', message: `第 ${row} 行缺少课程名`, at: { row } })
      return
    }
    const weekday = parseWeekday(cells[map.weekday])
    if (!weekday) {
      diags.push({ level: 'error', code: 'UNPARSED_WEEKDAY', message: `第 ${row} 行星期无法解析：${cells[map.weekday] ?? ''}`, at: { row, snippet: cells[map.weekday] } })
      return
    }
    const pr = parsePeriodRange(cells[map.periods] ?? '')
    if (!pr) {
      diags.push({ level: 'error', code: 'UNPARSED_PERIOD', message: `第 ${row} 行节次无法解析：${cells[map.periods] ?? ''}`, at: { row, snippet: cells[map.periods] } })
      return
    }
    courses.push({
      name,
      teacher: map.teacher != null ? cells[map.teacher]?.trim() || undefined : undefined,
      teacherPhone: map.teacherPhone != null ? cells[map.teacherPhone]?.trim() || undefined : undefined,
      location: map.location != null ? cells[map.location]?.trim() || undefined : undefined,
      weekday,
      startPeriod: pr.start,
      endPeriod: pr.end,
      weeks: cells[map.weeks] ?? '',
    })
  })
  return { courses, diagnostics: diags }
}

export function parseWeekday(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()
  const n = parseInt(s, 10)
  if (n >= 1 && n <= 7) return n
  const m: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
  for (const [k, v] of Object.entries(m)) if (s.includes(k)) return v
  return null
}

/* 通用 JSON 课表（tableName/courses/timeSlots 形态） */
export function parseJsonTable(text: string): RuleOutput {
  const diags: Diagnostic[] = []
  let obj: unknown
  try {
    obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  } catch {
    return { courses: [], diagnostics: [{ level: 'error', code: 'INVALID_JSON', message: 'JSON 无法解析' }] }
  }
  const root = obj as { courses?: unknown[] }
  if (!Array.isArray(root.courses)) {
    return { courses: [], diagnostics: [{ level: 'error', code: 'MISSING_COURSES', message: '缺少 courses 数组' }] }
  }
  const courses: RuleCourse[] = []
  root.courses.forEach((c, i) => {
    const o = c as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : ''
    const day = typeof o.day === 'number' ? o.day : parseWeekday(String(o.day ?? ''))
    const startNode = typeof o.startNode === 'number' ? o.startNode : NaN
    const step = typeof o.step === 'number' ? o.step : 1
    const weeks = Array.isArray(o.weeks) ? (o.weeks as number[]).join(',') : String(o.weeks ?? '')
    if (!name || !day || isNaN(startNode)) {
      diags.push({ level: 'error', code: 'MISSING_FIELDS', message: `第 ${i + 1} 条课程缺少必需字段`, at: { row: i + 1 } })
      return
    }
    const teacherRaw = typeof o.teacher === 'string' ? o.teacher : undefined
    const teacherPhone = extractPhone(o.teacherPhone ?? o.phone ?? o.tel ?? o.mobile) ?? extractPhone(teacherRaw)
    const teacher = teacherRaw && teacherPhone ? teacherRaw.replace(PHONE_RE, '').replace(/[\s,，;；:：()（）]+$/, '').trim() || undefined : teacherRaw
    courses.push({
      name,
      teacher,
      teacherPhone,
      location: typeof o.location === 'string' ? o.location : undefined,
      weekday: day,
      startPeriod: startNode,
      endPeriod: startNode + step - 1,
      weeks,
    })
  })
  const meta = obj as { timeSlots?: unknown; startDate?: unknown; totalWeeks?: unknown; semester?: unknown }
  const startDate = typeof meta.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.startDate) ? meta.startDate : undefined
  const totalWeeks = typeof meta.totalWeeks === 'number' && meta.totalWeeks >= 1 && meta.totalWeeks <= 60 ? Math.floor(meta.totalWeeks) : undefined
  const semName = typeof meta.semester === 'string' && meta.semester.trim() ? meta.semester.trim() : undefined
  return {
    courses,
    diagnostics: diags,
    timeGrid: parseTimeSlots(meta.timeSlots),
    ...(startDate ? { semester: { startDate, ...(totalWeeks ? { totalWeeks } : {}), ...(semName ? { name: semName } : {}) } } : {}),
  }
}

