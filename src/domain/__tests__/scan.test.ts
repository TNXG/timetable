import { describe, expect, it } from 'vitest'
import { builtinRuleFor, resolveScan, sniffKind } from '../importers/url'

describe('扫码导入', () => {
  it('二维码里直接是 JSON 课表', async () => {
    const json = '{"courses":[{"name":"高等数学","day":1,"startNode":1,"step":2,"weeks":"1-16"}]}'
    expect(await resolveScan(` ${json}\n`)).toEqual({ text: json, kind: 'json' })
    expect(await resolveScan('[{"name":"x"}]')).toMatchObject({ kind: 'json' })
  })

  it('二维码里是 .ics 文本', async () => {
    const ics = 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    expect(await resolveScan(ics)).toEqual({ text: ics, kind: 'ics' })
  })

  it('不是课表的内容返回 null', async () => {
    expect(await resolveScan('')).toBeNull()
    expect(await resolveScan('hello world')).toBeNull()
    expect(await resolveScan('WIFI:T:WPA;S:x;P:y;;')).toBeNull()
  })

  it('链接会走抓取，请求失败抛错', async () => {
    await expect(resolveScan('http://127.0.0.1:9/timetable.json')).rejects.toThrow()
  })

  it('嗅探结果对应内置规则', () => {
    expect(builtinRuleFor(sniffKind('{"courses":[]}'))).toBe('builtin-json')
    expect(builtinRuleFor(sniffKind('BEGIN:VCALENDAR'))).toBe('builtin-ics')
    expect(builtinRuleFor(sniffKind('<html><table></table></html>'))).toBe('builtin-html')
    expect(builtinRuleFor(sniffKind('课程,教师'))).toBe('builtin-csv')
    expect(builtinRuleFor('script')).toBe('builtin-csv')
  })
})
