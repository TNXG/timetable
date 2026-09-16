import type { DateRange, LocalDate } from './types'

/* 全国法定节假日（国务院办公厅历年《部分节假日安排的通知》）。
   放假区间内不排常规课；调休上班日仍按其原本的星期排课，不代上其它星期的课。 */

export interface Holiday extends DateRange {
  name: string
}

const HOLIDAYS: Holiday[] = [
  // 2025：国办发明电〔2024〕12 号
  { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
  { name: '春节', start: '2025-01-28', end: '2025-02-04' },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
  { name: '端午节', start: '2025-05-31', end: '2025-06-02' },
  { name: '国庆节、中秋节', start: '2025-10-01', end: '2025-10-08' },
  // 2026：2025-11-04 发布
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]

/** d 落在哪个法定节假日里；不在则 null */
export function statutoryHoliday(d: LocalDate): string | null {
  for (const h of HOLIDAYS) if (d >= h.start && d <= h.end) return h.name
  return null
}

/** 与 [start, end] 有交集的法定节假日 */
export function holidaysBetween(start: LocalDate, end: LocalDate): Holiday[] {
  return HOLIDAYS.filter((h) => h.end >= start && h.start <= end)
}
