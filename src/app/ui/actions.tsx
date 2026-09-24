import React, { useRef } from 'react'
import { Sheet } from './sheet'

export function SheetHead({ title, sub, trail }: { title: string; sub?: string; trail?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 pt-1 pb-2.5">
      <div className="min-w-0">
        <div className="truncate text-[17px] font-extrabold tracking-[-.02em] text-(--c-ink)">{title}</div>
        {sub && <div className="mt-1 truncate text-[12px] font-medium text-(--c-ink4)">{sub}</div>}
      </div>
      {trail}
    </div>
  )
}

export function MenuRow({ icon, title, desc, onClick, danger, first }: { icon: React.ReactNode; title: string; desc?: string; onClick: () => void; danger?: boolean; first?: boolean }) {
  return (
    <button onClick={onClick} className={`mx-3 flex w-[calc(100%-24px)] items-center rounded-[13px] px-3 py-[10px] text-left transition-colors active:bg-(--c-surface2) ${first ? 'bg-(--c-bg)' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke={danger ? 'var(--c-danger)' : 'var(--c-ink2)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mr-3 h-[17px] w-[17px] flex-none">{icon}</svg>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[14px] font-medium ${danger ? 'text-(--c-danger)' : 'text-(--c-ink)'}`}>{title}</div>
        {desc && <div className="mt-[2px] truncate text-[11.5px] font-medium text-(--c-ink4)">{desc}</div>}
      </div>
    </button>
  )
}

const EASE_CSS = 'cubic-bezier(.25,1,.5,1)'

export function TextAction({ children, onClick, tone = 'brand', disabled, busy }: { children: React.ReactNode; onClick?: () => void; tone?: 'brand' | 'mute' | 'danger'; disabled?: boolean; busy?: boolean }) {
  const color = tone === 'brand' ? 'text-(--c-accent)' : tone === 'danger' ? 'text-(--c-danger)' : 'text-(--c-ink3)'
  return (
    <button onClick={onClick} disabled={disabled || busy} className={`grid flex-none place-items-center text-[13px] font-bold whitespace-nowrap transition-opacity active:opacity-60 ${busy ? '' : 'disabled:opacity-30'} ${color}`}>
      <span className={`[grid-area:1/1] transition-opacity duration-200 ${busy ? 'opacity-0' : ''}`} style={{ transitionTimingFunction: EASE_CSS }}>{children}</span>
      <span className={`flex [grid-area:1/1] transition-opacity duration-200 ${busy ? '' : 'opacity-0'}`} style={{ transitionTimingFunction: EASE_CSS }}>
        <Loader size={14} />
      </span>
    </button>
  )
}

/* 底部主操作：大号实心主题色 */
const LOADER_SPOKES: [string, number][] = [
  ['M8 0V4', 1], ['M8 16V12', 0.5], ['M3.29773 1.52783L5.64887 4.7639', 0.9], ['M12.7023 1.52783L10.3511 4.7639', 0.1],
  ['M12.7023 14.472L10.3511 11.236', 0.4], ['M3.29773 14.472L5.64887 11.236', 0.6], ['M15.6085 5.52783L11.8043 6.7639', 0.2],
  ['M0.391602 10.472L4.19583 9.23598', 0.7], ['M15.6085 10.4722L11.8043 9.2361', 0.3], ['M0.391602 5.52783L4.19583 6.7639', 0.8],
]

/** 加载指示：12 向辐条渐隐，跟随 currentColor */
export function Loader({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`loader-spin ${className}`} width={size} height={size} viewBox="0 0 16 16" strokeLinejoin="round" style={{ color: 'currentcolor' }}>
      {LOADER_SPOKES.map(([d, o]) => <path key={d} d={d} opacity={o} stroke="currentColor" strokeWidth="1.5" />)}
    </svg>
  )
}

export function PrimaryButton({ children, onClick, disabled, busy, onDark, tone = 'brand' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; onDark?: boolean; tone?: 'brand' | 'danger' }) {
  const bg = tone === 'danger' ? 'bg-(--c-danger) disabled:bg-(--c-danger)' : 'bg-(--c-accent) disabled:bg-(--c-accent)'
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`grid w-full place-items-center rounded-[18px] ${busy ? bg : tone === 'danger' ? 'bg-(--c-danger)' : 'bg-(--c-accent)'} py-[15px] text-[15px] font-bold text-white transition-transform duration-150 active:scale-[.985] ${busy ? 'disabled:text-white' : onDark ? 'disabled:bg-white/12 disabled:text-white/35' : 'disabled:bg-(--c-line) disabled:text-(--c-ink5)'}`}
    >
      <span className={`[grid-area:1/1] transition-opacity duration-200 ${busy ? 'opacity-0' : ''}`} style={{ transitionTimingFunction: EASE_CSS }}>{children}</span>
      <span className={`flex [grid-area:1/1] transition-opacity duration-200 ${busy ? '' : 'opacity-0'}`} style={{ transitionTimingFunction: EASE_CSS }}>
        <Loader size={18} />
      </span>
    </button>
  )
}

/* 底部选择/动作菜单：左上标题、右上圆形关闭；每行「图标 + 文案 + 右侧附注或勾」，选中项主题色；危险项红字 */
export interface ActionItem {
  title: string
  /** 左侧图标（svg 内容） */
  icon?: React.ReactNode
  /** 右侧灰色附注 */
  value?: string
  selected?: boolean
  danger?: boolean
  /** 点了不收起（多选） */
  keepOpen?: boolean
  /** 行尾用方框而不是勾 */
  multi?: boolean
  onClick: () => void
}

export function SheetClose({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface2) transition-transform duration-150 active:scale-[.92]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  )
}

export function SheetRow({ item, onPick }: { item: ActionItem; onPick: (it: ActionItem) => void }) {
  const tone = item.danger ? 'var(--c-danger)' : item.selected ? 'var(--c-accent)' : 'var(--c-ink2)'
  return (
    <button onClick={() => onPick(item)} className="flex h-[52px] w-full items-center rounded-[14px] px-3 text-left transition-colors active:bg-(--c-surface2)">
      {item.icon ? (
        <svg viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mr-3.5 h-[19px] w-[19px] flex-none">{item.icon}</svg>
      ) : (
        <span className="mr-3.5 h-[19px] w-[19px] flex-none rounded-full border-[1.8px] border-dashed border-(--c-ink5)" />
      )}
      <span className={`min-w-0 flex-1 truncate text-[15px] font-medium ${item.danger ? 'text-(--c-danger)' : 'text-(--c-ink)'}`}>{item.title}</span>
      {item.value != null && <span className="ml-3 flex-none text-[14px] font-medium tabular-nums text-(--c-ink4)">{item.value}</span>}
      {!item.danger && <Tick on={!!item.selected} multi={item.multi} className="ml-3" />}
    </button>
  )
}

/** 行尾选中标记：占位宽度固定，选不选都不挤动左边；多选是方框，单选是勾 */
export function Tick({ on, multi, className = '' }: { on: boolean; multi?: boolean; className?: string }) {
  if (multi) {
    return (
      <span
        className={`flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[6px] border-[1.6px] transition-colors duration-150 ${on ? 'border-(--c-accent) bg-(--c-accent)' : 'border-(--c-ink5) bg-transparent'} ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`h-[12px] w-[12px] transition-opacity duration-150 ${on ? 'opacity-100' : 'opacity-0'}`}><path d="m5 13 4.5 4.5L19 7" /></svg>
      </span>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={`h-[16px] w-[16px] flex-none transition-opacity duration-150 ${on ? 'opacity-100' : 'opacity-0'} ${className}`}><path d="m5 13 4.5 4.5L19 7" /></svg>
  )
}

export function ActionSheet({ groups, onClose, title }: { groups: ActionItem[][]; onClose: () => void; title: string }) {
  const dismiss = useRef<(() => void) | null>(null)
  const pick = (it: ActionItem) => {
    it.onClick()
    if (!it.keepOpen) dismiss.current?.()
  }
  return (
    <Sheet onClose={onClose} dismissRef={dismiss} className="px-3 pb-2" header={<SheetHead title={title} trail={<SheetClose onClick={() => dismiss.current?.()} />} />}>
      {groups.filter((g) => g.length > 0).map((g, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-2 border-t border-(--c-line) pt-2' : ''}>
          {g.map((it) => <SheetRow key={it.title} item={it} onPick={pick} />)}
        </div>
      ))}
    </Sheet>
  )
}
