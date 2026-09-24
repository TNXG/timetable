import { describe, expect, it } from 'vitest'
import { parseJcs, parseZfKbList, zcdToWeeks, zfTimeGrid } from '../edu/zhengfang'

/* 字段形态取自 2026-09 实测响应：jcs/jcor 带「节」，zcd 有「(单)(双)」和「第N周」两种写法 */
const zfRow = (over: Partial<{ kcmc: string; xm: string; cdmc: string; xqj: string; jcs: string; zcd: string }>) => ({
  kcmc: '课', xm: '师', cdmc: '教室', xqj: '1', jcs: '3-4', zcd: '5-16周', ...over,
})

describe('正方课表 JSON 解析', () => {
  it('「第16周」这类带「第」的周次段也能解析（实测丢课 bug）', () => {
    const out = parseZfKbList({
      kbList: [
        zfRow({ kcmc: '高等数学A1', zcd: '5-13周(单),14-16周' }),
        zfRow({ kcmc: '思想道德与法治', zcd: '第16周' }),
      ],
    })
    expect(out.courses.map((c) => c.weeks)).toEqual(['5,7,9,11,13,14,15,16', '16'])
    expect(out.diagnostics.filter((d) => d.level !== 'info')).toEqual([])
  })

  it('非排课行给出诊断而不是崩掉', () => {
    const out = parseZfKbList({ kbList: [zfRow({ xqj: 'x' }), zfRow({ jcs: 'xx' }), {}] })
    expect(out.courses).toEqual([])
    expect(out.diagnostics.map((d) => d.code)).toEqual(['BAD_WEEKDAY', 'BAD_PERIOD', 'EMPTY_NAME'])
  })

  it('节次串：区间 / 压缩四连 / 单值', () => {
    expect(parseJcs('3-4')).toEqual([3, 4])
    expect(parseJcs('0304')).toEqual([3, 4])
    expect(parseJcs('5')).toEqual([5, 5])
    expect(parseJcs('第3节')).toBeNull()
  })

  it('zcdToWeeks：单双周只作用于本段', () => {
    expect(zcdToWeeks('1-3周(双),5周')).toEqual({ weeks: '2,5' })
  })

  it('zfTimeGrid：日课表行 → 作息表（qssj 含整段、jssj 兜尾都认）', () => {
    const grid = zfTimeGrid([
      { jcmc: '1', qssj: '10:00 - 10:45', jssj: '' },
      { jcmc: '2', qssj: '10:55', jssj: '11:40' },
      { jcmc: '3', qssj: '12:00', jssj: '是' },
    ])
    expect(grid).toEqual([
      { index: 1, start: 600, end: 645 },
      { index: 2, start: 655, end: 700 },
    ])
    expect(zfTimeGrid([])).toBeUndefined()
    expect(zfTimeGrid(null)).toBeUndefined()
  })
})
