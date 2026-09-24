import React from 'react'
import { motion } from 'motion/react'
import { useImeShrink } from '../ime'
import { dockStyle } from './constants'

export const NAV_ITEMS: [React.ReactNode, string][] = [
  [<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" key="h" />, '今天'],
  [<g key="c"><rect x="3" y="4" width="18" height="17" rx="4" /><path d="M3 9h18M8 2v4M16 2v4" /></g>, '课表'],
  [<g key="t"><path d="M9 11.5 11 14l4-5" /><rect x="3.5" y="4" width="17" height="16" rx="4" /></g>, '待办'],
  [<g key="s"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></g>, '我的'],
]

export function Nav({ active, onTab, hidden }: { active: number; onTab: (i: number) => void; hidden?: boolean }) {
  const shrink = useImeShrink()
  return (
    <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8]" style={{ y: shrink }}>
    <motion.div
      animate={{ y: hidden ? 130 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
      className="pointer-events-none absolute inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-[92%] items-center justify-between rounded-full p-[5px]" style={dockStyle}>
        {NAV_ITEMS.map(([ic, label], i) => {
          const on = i === active
          return (
            <button
              key={label}
              onClick={() => onTab(i)}
              className="relative flex flex-1 flex-col items-center gap-[2px] px-1 pt-[6px] pb-[5px] transition-transform duration-150 active:scale-[.94]"
            >
              {on && (
                <motion.i
                  layoutId="nav-indicator"
                  className="absolute inset-x-[1px] inset-y-0 rounded-full bg-(--c-accent-soft)"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--c-accent)' : 'var(--c-ink)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 h-[19px] w-[19px] transition-colors duration-200">{ic}</svg>
              <span className={`relative z-10 text-[9.5px] font-bold transition-colors duration-200 ${on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </motion.div>
    </motion.div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] bg-(--c-surface) p-5 ${className}`}>{children}</div>
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19 8 12l7-7" /></svg>
    </button>
  )
}
