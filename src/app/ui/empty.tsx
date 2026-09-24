import React from 'react'

export type EmptyKind = 'free' | 'none' | 'todo' | 'term' | 'holiday' | 'search'

export function EmptyArt({ kind }: { kind: EmptyKind }) {
  const art: Record<EmptyKind, React.ReactNode> = {
    free: (
      <>
        <rect x="6" y="9" width="36" height="32" rx="5" />
        <path d="M6 18h36M15 5v7M33 5v7" />
        <path d="m17 30 5 5 9-9" />
      </>
    ),
    none: (
      <>
        <rect x="6" y="9" width="36" height="32" rx="5" strokeDasharray="4 3.5" />
        <path d="M6 18h36M15 5v7M33 5v7" />
        <path d="M24 24v10M19 29h10" />
      </>
    ),
    todo: (
      <>
        <rect x="6" y="10" width="36" height="26" rx="4" />
        <path d="M6 30l10-9 8 7 6-5 12 10" />
        <circle cx="32" cy="18" r="3" />
        <path d="M14 42h20" />
      </>
    ),
    term: (
      <>
        <rect x="6" y="9" width="36" height="32" rx="5" />
        <path d="M6 18h36M15 5v7M33 5v7" />
        <path d="M14 26h6M14 34h6M25 26h6" />
        <rect x="25" y="32" width="6" height="4" rx="1" fill="var(--c-accent)" stroke="none" />
      </>
    ),
    holiday: (
      <>
        <circle cx="24" cy="20" r="7" />
        <path d="M24 5v4M24 31v4M9 20h4M35 20h4M13.4 9.4l2.8 2.8M31.8 27.8l2.8 2.8M13.4 30.6l2.8-2.8M31.8 12.2l2.8-2.8" />
        <path d="M6 42c6-5 12-5 18 0s12 5 18 0" />
      </>
    ),
    search: (
      <>
        <circle cx="21" cy="21" r="12" />
        <path d="m30 30 11 11" />
        <path d="M16 21h10" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 48 48" fill="none" style={{ stroke: 'var(--c-ink3)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[52px] w-[52px]">
      {art[kind]}
    </svg>
  )
}

export type EmptyAction = [label: string, onClick: () => void, icon?: React.ReactNode]

export function EmptyBlock({ kind, title, desc, actions, className = 'px-5', onSurface }: {
  kind: EmptyKind
  title: string
  desc?: string
  actions?: EmptyAction[]
  className?: string
  onSurface?: boolean
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <EmptyArt kind={kind} />
      <div className="mt-6 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">{title}</div>
      {desc && <div className="mt-2 text-[13.5px] leading-[1.55] font-medium text-(--c-ink3)">{desc}</div>}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          {actions.map(([label, fn, icon], i) => (
            <button
              key={label}
              onClick={fn}
              className={`flex h-[34px] items-center gap-1.5 rounded-full text-[13px] font-bold transition-transform duration-150 active:scale-[.96] ${i === 0 ? 'bg-(--c-accent) text-white' : `${onSurface ? 'bg-(--c-surface2)' : 'bg-(--c-surface)'} text-(--c-ink)`} ${icon ? 'pl-3 pr-3.5' : 'px-3.5'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
