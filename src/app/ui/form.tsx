import React, { useState } from 'react'
import { haptic } from '../widgets'
import { ActionSheet } from './actions'
import { DateSheet, TimeSheet } from './calendar'

export function Chips({ items, active, onPick }: { items: string[]; active: number; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <button
          key={t}
          onClick={() => onPick(i)}
          className={`rounded-[9px] px-2.5 py-[6px] text-[12px] font-bold transition-colors ${i === active ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-surface) text-(--c-ink3)'}`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

export function Field({ k, children, sub }: { k: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline px-4 py-3">
      <span className="w-[62px] flex-none text-[12.5px] font-medium text-(--c-ink4)">{k}</span>
      <div className="min-w-0 flex-1">
        {children}
        {sub && <div className="mt-1 text-[11.5px] font-medium text-(--c-ink4)">{sub}</div>}
      </div>
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-transparent text-[14px] font-semibold text-(--c-ink) outline-none placeholder:font-medium placeholder:text-(--c-ink5) ${props.className ?? ''}`}
    />
  )
}

const pickerBtn = 'block w-full bg-transparent text-left text-[14px] font-semibold tabular-nums text-(--c-ink) outline-none'

/** 日期：点开自绘月历卡 */
export function DateInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`${pickerBtn} ${className ?? ''}`} onClick={() => setOpen(true)}>
        {value ? value.replace(/-/g, '/') : <span className="font-medium text-(--c-ink5)">选择日期</span>}
      </button>
      {open && <DateSheet value={value} onPick={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}

/** 时刻：点开自绘时:分滚轮卡 */
export function TimeInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`${pickerBtn} ${className ?? ''}`} onClick={() => setOpen(true)}>
        {value || <span className="font-medium text-(--c-ink5)">选择时间</span>}
      </button>
      {open && <TimeSheet value={value} onPick={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}

/** 单选：点开自绘选择卡 */
export function SelectInput({ value, options, onChange, title, className }: { value: string; options: [string, string][]; onChange: (v: string) => void; title?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const idx = options.findIndex(([v]) => v === value)
  return (
    <>
      <button type="button" className={`${pickerBtn} ${className ?? ''}`} onClick={() => setOpen(true)}>
        {options[idx]?.[1] ?? options[0]?.[1] ?? ''}
      </button>
      {open && (
        <ActionSheet
          title={title ?? '选择'}
          groups={[options.map(([v, label]) => ({ title: label, selected: v === value, onClick: () => onChange(v) }))]}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function Row({ title, desc, badge, right, onClick, danger, active }: { title: string; desc?: string; badge?: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center px-4 py-3.5 text-left transition-colors active:bg-(--c-bg) ${active ? 'bg-(--c-accent-soft)' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-2 text-[14px] font-bold ${danger ? 'text-(--c-danger)' : active ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>
          <span className="truncate">{title}</span>
          {badge && <span className="flex-none rounded-[7px] bg-(--c-accent-soft) px-2 py-[3px] text-[10.5px] font-bold text-(--c-accent)">{badge}</span>}
        </div>
        {desc && <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{desc}</div>}
      </div>
      {right ?? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.4" strokeLinecap="round" className="ml-3 flex-none"><path d="m9 5 7 7-7 7" /></svg>
      )}
    </button>
  )
}

/** 与原型一致的 − 数值 + 步进器；到边界再按给 edge 反馈 */
export function Stepper({ value, unit, min, max, step = 1, onChange }: { value: number; unit?: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const go = (dir: -1 | 1) => {
    const next = value + dir * step
    if (next < min || next > max) {
      haptic('light')
      return
    }
    haptic('selection')
    onChange(next)
  }
  const btn = (dir: -1 | 1, path: string) => (
    <button
      onClick={() => go(dir)}
      className={`flex h-[28px] w-[28px] items-center justify-center rounded-full bg-(--c-surface2) transition-transform duration-150 active:scale-[.92] ${(dir < 0 ? value - step < min : value + step > max) ? 'opacity-40' : ''}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.6" strokeLinecap="round"><path d={path} /></svg>
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      {btn(-1, 'M5 12h14')}
      <span className="min-w-[56px] text-center text-[15px] font-bold tabular-nums text-(--c-ink)">
        {value}{unit && <span className="ml-0.5 text-[12px] font-semibold text-(--c-ink4)">{unit}</span>}
      </span>
      {btn(1, 'M12 5v14M5 12h14')}
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => { haptic('light'); onChange(!on) }}
      className={`relative h-[26px] w-[44px] flex-none rounded-full transition-colors duration-200 ${on ? 'bg-(--c-accent)' : 'bg-(--c-line)'}`}
    >
      <i className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-[left] duration-200 ${on ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  )
}
