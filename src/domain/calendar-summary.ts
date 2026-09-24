import type { DesiredEvent } from './calendar-plan'
/** 汇总给设置页看；稳定哈希用于「事件没变就不动它」 */
export interface CalendarSummary {
  courses: number
  tasks: number
  exams: number
}

/** 汇总给设置页看：几门课（按课名）、几项作业、几场考试 */
export function summarize(events: DesiredEvent[]): CalendarSummary {
  let tasks = 0, exams = 0
  const courses = new Set<string>()
  for (const e of events) {
    if (e.kind === 'exam') exams++
    else if (e.kind === 'task') tasks++
    else if (e.kind === 'course') courses.add(e.event.title.replace(/（(调课|停课|请假)）$/, ''))
  }
  return { courses: courses.size, tasks, exams }
}

/** 稳定哈希：事件内容 + 提醒，任何一处变了都不同 */
export function eventHash(e: DesiredEvent): string {
  const s = JSON.stringify([e.event, e.reminders])
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619)
    h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13)
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
}
