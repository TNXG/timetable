/** 调试页共用零件：分组卡片与标签/值行 */
import React from 'react'

export function KV({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-3.5">
      <span className="w-[76px] flex-none pt-0.5 text-[12.5px] font-medium text-(--c-ink4)">{k}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-[13.5px] font-semibold break-words text-left [overflow-wrap:anywhere] ${tone === 'ok' ? 'text-(--c-accent)' : tone === 'bad' ? 'text-(--c-danger)' : 'text-(--c-ink)'}`}>{v}</div>
        {sub && <div className="mt-0.5 text-[11.5px] font-medium whitespace-pre-line break-words [overflow-wrap:anywhere] text-(--c-ink4)">{sub}</div>}
      </div>
    </div>
  )
}

/** 小标题 + 圆角卡片；行之间自动补分隔线 */
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="px-1 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{title}</div>
      <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
        {React.Children.toArray(children).map((row, i) => (
          <div key={i} className={i ? 'border-t border-(--c-surface2)' : ''}>{row}</div>
        ))}
      </div>
    </div>
  )
}

/** 探测/读取还没回来时的占位 */
export function Pending({ text }: { text: string }) {
  return <div className="mt-5 rounded-[18px] bg-(--c-surface) px-4 py-6 text-[13px] font-medium text-(--c-ink4)">{text}</div>
}

export function Failed({ text }: { text: string }) {
  return <div className="mt-5 rounded-[18px] bg-(--c-surface) px-4 py-6 text-[13px] font-medium text-(--c-danger)">{text}</div>
}
