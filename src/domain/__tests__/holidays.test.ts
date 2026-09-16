import { describe, expect, it } from 'vitest'
import type { Semester } from '../types'
import { inVacation } from '../dates'
import { holidaysBetween, statutoryHoliday } from '../holidays'
import { occurrencesOn, type Snapshot } from '../engine'
import { weeksToMask } from '../weeks'

const sem: Semester = {
  id: 's1',
  name: '2026–2027 学年 第 1 学期',
  startDate: '2026-08-31',
  totalWeeks: 20,
  timeGrid: [{ index: 1, start: 480, end: 520 }, { index: 2, start: 530, end: 570 }],
  vacations: [],
  examWeeks: [],
}
const course = { id: 'c1', semesterId: 's1', name: '思想道德与法治', color: '#000', identityKey: 'k', hidden: false, source: 'import' as const }
const tue = { id: 'r1', courseId: 'c1', weekday: 2 as const, startPeriod: 1, endPeriod: 2, weeksMask: weeksToMask([4, 5, 6, 7]) }
const snap = (s: Semester = sem): Snapshot => ({ semester: s, courses: [course], rules: [tue], overrides: [], entries: [] })

describe('法定节假日', () => {
  it('国庆 10.1–10.7 与中秋 9.25–9.27', () => {
    expect(statutoryHoliday('2026-10-01')).toBe('国庆节')
    expect(statutoryHoliday('2026-10-07')).toBe('国庆节')
    expect(statutoryHoliday('2026-10-08')).toBeNull()
    expect(statutoryHoliday('2026-09-26')).toBe('中秋节')
    expect(statutoryHoliday('2026-09-20')).toBeNull() // 调休上班日不是假期
    expect(statutoryHoliday('2025-10-08')).toBe('国庆节、中秋节')
  })

  it('学期内的节假日列表', () => {
    expect(holidaysBetween('2026-08-31', '2027-01-17').map((h) => h.name)).toEqual(['中秋节', '国庆节'])
    expect(holidaysBetween('2025-12-29', '2026-01-02').map((h) => h.name)).toEqual(['元旦'])
  })

  it('假期里第 6 周周二不展开常规课', () => {
    expect(inVacation(sem, '2026-10-06')).toBe('国庆节')
    expect(occurrencesOn(snap(), '2026-10-06')).toHaveLength(0) // 第 6 周周二，国庆假期
    expect(occurrencesOn(snap(), '2026-09-29')).toHaveLength(1) // 第 5 周周二
    expect(occurrencesOn(snap(), '2026-10-13')).toHaveLength(1) // 第 7 周周二
  })

  it('学期关闭节假日后照常排课；自定义假期优先', () => {
    expect(occurrencesOn(snap({ ...sem, holidays: false }), '2026-10-06')).toHaveLength(1)
    expect(inVacation({ ...sem, vacations: [{ name: '校庆', start: '2026-10-06', end: '2026-10-06' }] }, '2026-10-06')).toBe('校庆')
  })
})
