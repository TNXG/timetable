/** AI 转换课表：复制 Prompt → AI 输出 JSON → 粘贴 → 走 JSON 规则解析 */
import { useRef, useState } from 'react'
import { AI_IMPORT_PROMPT } from '../../domain/ai-prompt'
import { Page, PrimaryButton, TextAction, TopBar } from '../ui'
import { copyText, haptic, nativeToast, pasteText } from '../widgets'

/* Prompt 高亮：引号内字符串、列表符号、标题分别着色 */
function promptTokens(line: string): [string, 'k' | 'p' | 's'][] {
  const out: [string, 'k' | 'p' | 's'][] = []
  const lead = /^(\s*(?:[-#]+\s|\d+\.\s))/.exec(line)
  if (lead) {
    out.push([lead[1], 'p'])
    line = line.slice(lead[1].length)
  }
  const re = /"[^"]*"/g
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index > last) out.push([line.slice(last, m.index), 's'])
    out.push([m[0], 'k'])
    last = m.index + m[0].length
  }
  if (last < line.length) out.push([line.slice(last), 's'])
  return out
}

/* AI 转换课表：复制 Prompt → AI 输出 JSON → 粘贴 → 走 JSON 规则解析 */
export function AiImportPage({ onBack, onNext, attach }: { onBack: () => void; onNext: (text: string) => void; attach?: string }) {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const copy = async () => {
    if (await copyText(attach ? `${AI_IMPORT_PROMPT.trimEnd()}\n\n—— 课表页面文字 ——\n${attach}` : AI_IMPORT_PROMPT)) {
      setCopied(true)
      haptic('success')
      nativeToast('已复制')
      window.setTimeout(() => setCopied(false), 1500)
    } else {
      haptic('error')
      nativeToast('复制失败')
    }
  }
  const paste = async () => {
    const t = await pasteText()
    if (t.trim()) {
      setText(t)
      return
    }
    nativeToast('剪贴板为空')
    ta.current?.focus()
  }
  const lines = AI_IMPORT_PROMPT.trimEnd().split('\n')
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <TopBar title="让 AI 转换课表" sub={attach ? '复制这段 Prompt（已附上课表页面文字）交给任意 AI，输出后粘贴即可' : '复制这段 Prompt 连同课表交给任意 AI，输出后粘贴即可'} onBack={onBack} />

        <div className="relative mt-6 rounded-[16px] bg-(--c-surface) px-4 py-4">
          <button onClick={copy} className="absolute top-1.5 right-1.5 flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-60">
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-accent)' }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink2)' }} strokeWidth="1.9"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" /></svg>
            )}
          </button>
          <div className="relative h-[168px] overflow-hidden">
            {lines.map((line, i) => (
              <div key={i} className="pr-10 font-mono text-[11.5px] leading-[1.95]">
                {line === '' ? '\u00a0' : promptTokens(line).map(([t, c], j) => (
                  <span
                    key={j}
                    className="whitespace-pre-wrap"
                    style={{ color: c === 'k' ? 'var(--c-accent)' : c === 'p' ? 'var(--c-ink5)' : 'var(--c-ink2)', fontWeight: c === 'k' ? 700 : 500 }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ))}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
              style={{ background: 'linear-gradient(to bottom, transparent, var(--c-surface))' }}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-(--c-ink4)">AI 输出的课表</span>
            <TextAction onClick={paste}>粘贴</TextAction>
          </div>
          <textarea
            ref={ta}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在这里粘贴 AI 输出的 JSON"
            className="mt-2 h-40 w-full resize-none bg-transparent font-mono text-[12.5px] leading-[1.5] outline-none placeholder:text-(--c-ink5)"
          />
        </div>
      </div>

      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton disabled={!text.trim()} onClick={() => onNext(text)}>解析并预览</PrimaryButton>
      </div>
    </Page>
  )
}
