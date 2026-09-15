import { parseHtml } from '../importers/html'
import type { PageCapture, ProbeResult } from './scripts'
import { SYSTEM_LABEL, hostOf, type EduSystemId } from './systems'

/*
 * 页面调试包：用户在内置浏览器里看到的那一页原样导出成一个 .html，
 * 头部注释带页面元信息、系统猜测、探测与解析结果，子框架的 HTML 以 text/plain 脚本块附在末尾。
 * 不做脱敏：页面本身就是用户自己登录后看到的内容，由用户决定发给谁。
 */

export interface DebugPackageInput {
  capture: PageCapture
  system: EduSystemId | null
  probe: ProbeResult | null
  version: string
  now?: Date
}

export const DEBUG_MIME = 'text/html'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function stamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`
}

/** 注释与 text/plain 脚本块里不能出现的收尾序列 */
function safeComment(s: string): string {
  return s.replace(/--/g, '- -')
}

function safeScriptBody(s: string): string {
  return s.replace(/<\/(script)/gi, '<\\/$1')
}

export function debugFileName(url: string, now = new Date()): string {
  const host = hostOf(url).toLowerCase().replace(/[^a-z0-9.-]/g, '_') || 'page'
  return `timetable-debug-${host}-${stamp(now)}.html`
}

export function buildDebugPackage(input: DebugPackageInput): { text: string; name: string } {
  const { capture, system, probe, version } = input
  const now = input.now ?? new Date()
  let parse: { courses: number; diagnostics: { level: string; code: string; message: string }[] }
  try {
    const out = parseHtml(capture.html, { mode: 'grid' })
    parse = { courses: out.courses.length, diagnostics: out.diagnostics.map((d) => ({ level: d.level, code: d.code, message: d.message })) }
  } catch (e) {
    parse = { courses: 0, diagnostics: [{ level: 'error', code: 'PARSE_THROW', message: e instanceof Error ? e.message : String(e) }] }
  }

  const meta = {
    generator: 'timetable-debug',
    version: version || '',
    exportedAt: now.toISOString(),
    page: {
      url: capture.url,
      title: capture.title,
      charset: capture.charset,
      contentType: capture.contentType,
      readyState: capture.readyState,
      userAgent: capture.userAgent,
      htmlLength: capture.html.length,
      frames: capture.frames.length,
    },
    systemGuess: system ? { id: system, label: SYSTEM_LABEL[system] } : null,
    probe,
    parse,
  }

  const parts: string[] = [
    `<!--\n嘎嘎课程表 页面调试包\n${safeComment(JSON.stringify(meta, null, 2))}\n-->\n`,
    capture.html,
    '\n',
  ]
  capture.frames.forEach((f, i) => {
    const attrs = { index: i, src: f.src, name: f.name, url: f.url, charset: f.charset, error: f.error }
    parts.push(`\n<!-- timetable-debug frame ${i}: ${safeComment(JSON.stringify(attrs))} -->\n`)
    if (f.html !== null) {
      parts.push(`<script type="text/plain" data-timetable-debug-frame="${i}">\n${safeScriptBody(f.html)}\n</script>\n`)
    }
  })
  return { text: parts.join(''), name: debugFileName(capture.url, now) }
}
