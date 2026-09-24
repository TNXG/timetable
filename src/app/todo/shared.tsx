import React, { useMemo, useRef, useState } from 'react'
import type { Course, Task } from '../../domain/types'
import { fmtMinutes, weekdayOf } from '../../domain/dates'
import { suggestedDue } from '../../domain/next-class'
import type { Snapshot } from '../../domain/engine'
import { nowMinutes, todayStr } from '../semester'
import { store, useStore } from '../store'
import { haptic } from '../widgets'
import {
  ActionSheet, CAL_H, Calendar, Chip, ICON, PrimaryButton, Sheet, SheetClose, SheetHead, SwapLayer, TimeWheels, WD, addDaysStr, clipText, md, type ActionItem,
} from '../ui'

const KINDS: Task['kind'][] = ['homework', 'exam', 'memo']
export const KIND_LABEL: Record<Task['kind'], string> = { homework: '作业', exam: '考试', memo: '备忘' }

const dayDiff = (a: string, b: string) =>
  Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000)

/** 截止的口语说法：今晚 23:00 / 明天 09:00 / 周四 08:00 / 10月14日 */
export function dueText(due: string | undefined, mins: number | undefined, today: string): string {
  if (!due) return '没有截止'
  const time = mins != null ? fmtMinutes(mins) : ''
  const diff = dayDiff(due, today)
  const tail = time ? ` ${time}` : ''
  if (diff === 0) return mins != null && mins >= 18 * 60 ? `今晚${tail}` : `今天${tail}`
  if (diff === 1) return `明天${tail}`
  if (diff > 1 && diff < 7) return `${WD[weekdayOf(due)]}${tail}`
  return `${md(due)}${tail}`
}

/** 第二行的时间感：已过截止、还剩 11 小时、3 天后 */
export function leftText(t: Task, today: string, now: number): [string, 'rose' | 'ink'] | null {
  if (!t.due || t.done) return null
  const diff = dayDiff(t.due, today)
  if (diff < 0) return ['已过截止', 'rose']
  if (diff === 0) {
    if (t.dueMinutes == null) return ['今天到期', 'rose']
    const h = Math.round((t.dueMinutes - now) / 60)
    return h <= 0 ? ['已过截止', 'rose'] : [`还剩 ${h} 小时`, 'rose']
  }
  if (diff >= 3 && diff < 14) return [`${diff} 天后`, 'ink']
  return null
}

export const timeOfDay = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function CheckBox({ done, color }: { done: boolean; color: string }) {
  return (
    <span
      className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[6px] border-[1.6px] transition-colors"
      style={{ borderColor: done ? color : 'var(--c-ink5)', background: done ? color : 'transparent' }}
    >
      {done && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-surface)' }} strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>
      )}
    </span>
  )
}

/** 勾完成给一段成功触感，撤销只轻点一下 */
export function toggleDone(t: Task) {
  haptic(t.done ? 'light' : 'success')
  store.editTask(t.id, { done: !t.done })
}

export function Check({ done, color, onClick }: { done: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-[2px] flex-none">
      <CheckBox done={done} color={color} />
    </button>
  )
}

/* ---------------- 相机 ---------------- */

export const CircleBtn = ({ children, onClick, size = 36 }: { children: React.ReactNode; onClick?: () => void; size?: number }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center rounded-full bg-white/12 transition-transform duration-150 active:scale-[.92]"
    style={{ height: size, width: size }}
  >
    {children}
  </button>
)

/** 取景区在页面里的布局位置：用 offset 链累加，不受推入动画的 transform 影响 */
export function layoutRect(el: HTMLElement) {
  let x = 0
  let y = 0
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    x += e.offsetLeft
    y += e.offsetTop
  }
  return { x, y, width: el.offsetWidth, height: el.offsetHeight }
}

/** 相机页在栈顶时，系统返回键先走这里把预览定格收起，再出栈 */
export const cameraLeave: { current: (() => Promise<void>) | null } = { current: null }
/* ---------------- 胶囊组：课程、截止、分类 ---------------- */

export function MetaChips({
  cid, due, dueMinutes, kind, today, onCourse, onDue, onKind,
}: {
  cid: string
  due?: string
  dueMinutes?: number
  kind: Task['kind']
  today: string
  onCourse: () => void
  onDue: () => void
  onKind: () => void
}) {
  const state = useStore()
  const course = state.courses.find((c) => c.id === cid)
  return (
    <div className="flex flex-wrap gap-2">
      <Chip color={course?.color} onClick={onCourse}>{course ? clipText(course.name) : '课程'}</Chip>
      <Chip onClick={onDue}>{due ? dueText(due, dueMinutes, today) : '截止'}</Chip>
      <Chip onClick={onKind}>{KIND_LABEL[kind]}</Chip>
    </div>
  )
}


/** 课程选择：不关联 + 各门课，课程色作图标 */
export function CourseSheet({ courses, cid, onPick, onClose }: { courses: Course[]; cid: string; onPick: (id: string) => void; onClose: () => void }) {
  const dot = (color?: string) => <circle cx="12" cy="12" r="5" fill={color ?? 'none'} stroke={color ?? 'currentColor'} />
  const items: ActionItem[] = [
    { title: '不关联', selected: !cid, onClick: () => onPick('') },
    ...courses.map((c) => ({ title: c.name, icon: dot(c.color), selected: c.id === cid, onClick: () => onPick(c.id) })),
  ]
  return <ActionSheet title="课程" groups={[items]} onClose={onClose} />
}

const KIND_ICON: Record<Task['kind'], React.ReactNode> = { homework: ICON.book, exam: ICON.flag, memo: ICON.note }

function KindSheet({ kind, onPick, onClose }: { kind: Task['kind']; onPick: (k: Task['kind']) => void; onClose: () => void }) {
  const items: ActionItem[] = KINDS.map((k) => ({ title: KIND_LABEL[k], icon: KIND_ICON[k], selected: k === kind, onClick: () => onPick(k) }))
  return <ActionSheet title="分类" groups={[items]} onClose={onClose} />
}

/**
 * 截止选择：一张卡里放日期胶囊 + 时刻胶囊，下面随选中的胶囊切成月历 / 时刻滚轮。
 * 常用的「今晚 / 明天 / 下次课前」是一排快捷项，点了直接定；月历里挑完按底部确定。
 */
function DueSheet({
  due, dueMinutes, today, suggest, onPick, onClose,
}: {
  due: string
  dueMinutes?: number
  today: string
  suggest: { due: string; dueMinutes: number; beforeClass: boolean } | null
  onPick: (due: string, mins?: number) => void
  onClose: () => void
}) {
  const dismiss = useRef<(() => void) | null>(null)
  const [d, setD] = useState(due || today)
  const [m, setM] = useState(dueMinutes ?? 23 * 60)
  const [timeView, setTimeView] = useState(false)

  const tomorrow = addDaysStr(today, 1)
  const is = (x: string, mm: number) => due === x && dueMinutes === mm
  const done = (x: string, mm?: number) => { onPick(x, mm); dismiss.current?.() }
  const quick: { label: string; on: boolean; go: () => void }[] = [
    { label: '今晚 23:00', on: is(today, 23 * 60), go: () => done(today, 23 * 60) },
    { label: '明天 09:00', on: is(tomorrow, 9 * 60), go: () => done(tomorrow, 9 * 60) },
  ]
  if (suggest?.beforeClass) {
    quick.push({
      label: `下次课前 ${dueText(suggest.due, suggest.dueMinutes, today)}`,
      on: is(suggest.due, suggest.dueMinutes),
      go: () => done(suggest.due, suggest.dueMinutes),
    })
  }
  if (due) quick.push({ label: '没有截止', on: false, go: () => done('', undefined) })

  const dateLabel = `${d.slice(0, 4) !== today.slice(0, 4) ? `${d.slice(0, 4)}年` : ''}${md(d)} ${WD[weekdayOf(d)]}`
  const pill = (on: boolean) =>
    `h-[38px] rounded-full px-4 text-[14.5px] font-bold tabular-nums transition-colors duration-200 ${on ? 'bg-(--c-accent) text-white' : 'bg-(--c-surface2) text-(--c-ink)'}`

  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-5 pb-1"
      header={<SheetHead title="截止" trail={<SheetClose onClick={() => dismiss.current?.()} />} />}
      footer={<div className="px-5 pt-2"><PrimaryButton onClick={() => done(d, m)}>确定</PrimaryButton></div>}
    >
      <div className="flex items-center gap-2 pb-3.5">
        <span className="mr-auto text-[15px] font-semibold text-(--c-ink)">截止于</span>
        <button onClick={() => setTimeView(false)} className={pill(!timeView)}>{dateLabel}</button>
        <button onClick={() => setTimeView(true)} className={pill(timeView)}>{fmtMinutes(m)}</button>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-(--c-line) py-3">
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={q.go}
            className={`h-[30px] rounded-full px-3 text-[12.5px] font-bold transition-transform duration-150 active:scale-[.96] ${q.on ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-surface2) text-(--c-ink2)'}`}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="relative border-t border-(--c-line)" style={{ height: CAL_H }}>
        {timeView ? (
          <SwapLayer id="time" className="flex items-center">
            <TimeWheels minutes={m} onChange={setM} className="flex-1" />
          </SwapLayer>
        ) : (
          <SwapLayer id="date">
            <Calendar value={d} onChange={setD} today={today} />
          </SwapLayer>
        )}
      </div>
    </Sheet>
  )
}

/** 课程、截止、分类的选择逻辑：三个页面共用；三种选择都是自绘 sheet */
export function useMeta(
  initial: { cid: string; due?: string; dueMinutes?: number; kind: Task['kind'] },
  courses: Course[],
  snap: Snapshot | null,
) {
  const [cid, setCid] = useState(initial.cid)
  const [due, setDue] = useState(initial.due ?? '')
  const [dueMinutes, setDueMinutes] = useState<number | undefined>(initial.dueMinutes)
  const [kind, setKind] = useState<Task['kind']>(initial.kind)
  const [sheet, setSheet] = useState<null | 'course' | 'due' | 'kind'>(null)
  const today = todayStr()
  const list = courses.filter((c) => !c.removedByImport)
  const suggest = useMemo(() => (snap ? suggestedDue(snap, cid || undefined, today, nowMinutes()) : null), [snap, cid, today])
  const close = () => setSheet(null)

  const node = (
    <>
      {sheet === 'course' && <CourseSheet courses={list} cid={cid} onPick={setCid} onClose={close} />}
      {sheet === 'kind' && <KindSheet kind={kind} onPick={setKind} onClose={close} />}
      {sheet === 'due' && (
        <DueSheet
          due={due}
          dueMinutes={dueMinutes}
          today={today}
          suggest={suggest}
          onPick={(d, m) => { setDue(d); setDueMinutes(m) }}
          onClose={close}
        />
      )}
    </>
  )
  return {
    cid, setCid, due, setDue, dueMinutes, kind,
    pickCourse: () => setSheet('course'),
    pickKind: () => setSheet('kind'),
    pickDue: () => setSheet('due'),
    node,
  }
}
