import React from 'react'
import { Page } from './sheet'
import { TopBar } from './veil'

export function PopHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-3.5 pt-1 pb-2.5">
      <div className="truncate text-[12.5px] font-medium text-(--c-ink4)">{title}{sub ? `　${sub}` : ''}</div>
    </div>
  )
}

export function PopItem({ icon, title, danger, onClick }: { icon: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-2 flex w-[calc(100%-16px)] items-center rounded-[11px] px-2.5 py-[9px] text-left transition-colors active:bg-(--c-surface2)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke={danger ? 'var(--c-danger)' : 'var(--c-ink2)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mr-3 h-[17px] w-[17px] flex-none">{icon}</svg>
      <span className={`truncate text-[14px] font-medium ${danger ? 'text-(--c-danger)' : 'text-(--c-ink)'}`}>{title}</span>
    </button>
  )
}

export const ICON = {
  bell: <g><path d="M12 3a6 6 0 0 0-6 6c0 5-2 6-2 6h16s-2-1-2-6a6 6 0 0 0-6-6z" /><path d="M4 4l16 16" /></g>,
  check: <path d="M20 6 9 17l-5-5" />,
  leave: <g><rect x="3.5" y="4" width="17" height="16" rx="4" /><path d="M9 12h6" /></g>,
  clock: <g><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  edit: <path d="M4 20h4L20 8l-4-4L4 16z" />,
  undo: <g><path d="M4 10h9a5 5 0 0 1 0 10H8" /><path d="m4 10 4-4M4 10l4 4" /></g>,
  ban: <g><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" /></g>,
  info: <g><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></g>,
  trash: <g><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" /></g>,
  download: <g><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 17.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" /></g>,
  image: <g><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-3 4.5 4.5" /></g>,
  camera: <g><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></g>,
  calendar: <g><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></g>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  flag: <path d="M5 21V4.5M5 4.5h11l-1.5 4L18 12.5H5" />,
  note: <g><rect x="4.5" y="3.5" width="15" height="17" rx="3" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></g>,
  hourglass: <g><path d="M7 3.5h10M7 20.5h10" /><path d="M8 3.5v3.2c0 2 4 3.8 4 5.3s-4 3.3-4 5.3v3.2M16 3.5v3.2c0 2-4 3.8-4 5.3s4 3.3 4 5.3v3.2" /></g>,
  sun: <g><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></g>,
  book: <g><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" /></g>,
}

/** 右侧箭头：列表行通用 */
export function Chevron({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.2" strokeLinecap="round" className={`flex-none ${className}`}><path d="m9 5 7 7-7 7" /></svg>
  )
}

/** 标题行右侧的搜索按钮：今天、周视图共用 */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
      <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink2)' }} strokeWidth="2" strokeLinecap="round" className="h-[16px] w-[16px]"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.2-3.2" /></svg>
    </button>
  )
}

/** 内页通用布局：TopBar + 滚动区 */
export function SubPage({ title, sub, onBack, children }: { title: string; sub?: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title={title} sub={sub} onBack={onBack} />
        <div className="mt-6">{children}</div>
      </div>
    </Page>
  )
}

/** 单选行：教务选学期、分享选学期同一套样式 */
export function RadioRow({ on, onClick, children, right }: { on: boolean; onClick?: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center rounded-[12px] px-3.5 py-3 text-left" style={{ background: on ? 'var(--c-accent-soft)' : 'var(--c-row-muted)', boxShadow: on ? 'inset 0 0 0 1.5px var(--c-accent)' : undefined }}>
      <span className="mr-3 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border-[1.8px]" style={{ borderColor: on ? 'var(--c-accent)' : 'var(--c-radio-border)', background: on ? 'var(--c-accent)' : 'transparent' }}>
        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[13.5px] font-bold text-(--c-ink) ${on ? '' : 'opacity-55'}`}>{children}</span>
      {right != null && <span className={`ml-3 flex-none text-[12.5px] font-semibold tabular-nums text-(--c-ink4) ${on ? '' : 'opacity-55'}`}>{right}</span>}
    </button>
  )
}
