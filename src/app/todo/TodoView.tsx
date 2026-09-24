import { useMemo, useState } from 'react'
import type { Course, Task } from '../../domain/types'
import { fmtMinutes, weekdayOf } from '../../domain/dates'
import { suggestedDue } from '../../domain/next-class'
import type { Snapshot } from '../../domain/engine'
import { nowMinutes, todayStr } from '../semester'
import { store, useStore } from '../store'
import { TaskPhotoImg } from '../photo'
import { BottomVeil, CameraIcon, EmptyBlock, QuickBar, StickyHead, WD } from '../ui'
import { Check, KIND_LABEL, dueText, leftText, timeOfDay, toggleDone } from './shared'

/* ---------------- 待办列表 ---------------- */

export function TaskRow({
  t, course, today, now, onOpen, tone = 'surface',
}: {
  t: Task
  course?: Course
  today: string
  now: number
  onOpen: () => void
  tone?: 'surface' | 'surface2'
}) {
  const color = course?.color ?? 'var(--c-ink5)'
  const left = leftText(t, today, now)
  const photo = t.photos?.[0]
  const right = t.inbox && t.capturedAt ? `${timeOfDay(t.capturedAt)} 拍下` : dueText(t.due, t.dueMinutes, today)

  return (
    <div className={`flex items-start rounded-[14px] px-3.5 py-3 ${tone === 'surface' ? 'bg-(--c-surface)' : 'bg-(--c-surface2)'} ${t.done ? 'opacity-45' : ''}`}>
      <Check done={t.done} color={course?.color ?? 'var(--c-accent)'} onClick={() => toggleDone(t)} />
      <button onClick={onOpen} className="ml-3 flex min-w-0 flex-1 items-start text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate text-[14px] font-bold tracking-[-.01em] ${t.inbox ? 'text-(--c-ink3)' : 'text-(--c-ink)'} ${t.done ? 'line-through' : ''}`}>
              {t.title || '板书'}
            </span>
            {t.kind === 'exam' && (
              <span className="flex-none rounded-[5px] bg-(--c-rose-soft) px-1.5 py-[2px] text-[10px] font-extrabold text-(--c-rose)">考试</span>
            )}
          </div>
          <div className="mt-[5px] flex items-baseline gap-1.5 text-[12px] leading-[16px] font-medium text-(--c-ink4)">
            <span className="h-[7px] w-[7px] flex-none self-center rounded-full" style={{ background: color }} />
            <span className="truncate">{course?.name ?? KIND_LABEL[t.kind]}</span>
            <span className="flex-none tabular-nums text-(--c-ink3)">{right}</span>
          </div>
          {left && (
            <div className={`mt-1 text-[12px] font-semibold tabular-nums ${left[1] === 'rose' ? 'text-(--c-rose)' : 'text-(--c-ink3)'}`}>{left[0]}</div>
          )}
          {t.note && !left && <div className="mt-1 truncate text-[12px] font-medium text-(--c-ink3)">{t.note}</div>}
        </div>
        {photo && <TaskPhotoImg path={photo.path} className="ml-3 h-[56px] w-[56px] flex-none rounded-[10px]" />}
      </button>
    </div>
  )
}

/** 待整理的一条：底部多一个「下次课前」的一键建议 */
function InboxRow({
  t, course, snap, today, onOpen,
}: {
  t: Task
  course?: Course
  snap: Snapshot | null
  today: string
  onOpen: () => void
}) {
  const suggest = snap ? suggestedDue(snap, t.courseId, today, nowMinutes()) : null
  const photo = t.photos?.[0]
  return (
    <div className="flex items-start rounded-[14px] bg-(--c-surface) px-3.5 py-3">
      <Check done={t.done} color={course?.color ?? 'var(--c-accent)'} onClick={() => toggleDone(t)} />
      <div className="ml-3 min-w-0 flex-1">
        <button onClick={onOpen} className="flex w-full items-start text-left">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold tracking-[-.01em] text-(--c-ink3)">{t.title || '板书'}</div>
            <div className="mt-[5px] flex items-baseline gap-1.5 text-[12px] leading-[16px] font-medium text-(--c-ink4)">
              <span className="h-[7px] w-[7px] flex-none self-center rounded-full" style={{ background: course?.color ?? 'var(--c-ink5)' }} />
              <span className="truncate">{course?.name ?? KIND_LABEL[t.kind]}</span>
              <span className="flex-none tabular-nums text-(--c-ink3)">
                {t.capturedAt ? `${timeOfDay(t.capturedAt)} 拍下` : dueText(t.due, t.dueMinutes, today)}
              </span>
            </div>
          </div>
          {photo && <TaskPhotoImg path={photo.path} className="ml-3 h-[56px] w-[56px] flex-none rounded-[10px]" />}
        </button>
        {suggest && suggest.beforeClass && (
          <button
            onClick={() => store.editTask(t.id, { due: suggest.due, dueMinutes: suggest.dueMinutes, inbox: false })}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-(--c-accent-soft) px-2.5 py-[5px] text-[11.5px] font-bold text-(--c-accent) transition-transform duration-150 active:scale-[.96]"
          >
            下次课前，{WD[weekdayOf(suggest.due)]} {fmtMinutes(suggest.dueMinutes)}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}

export function TodoView({
  snap, composing, onOpen, onCamera, onText,
}: {
  snap: Snapshot | null
  composing: boolean
  onOpen: (t: Task) => void
  onCamera: () => void
  onText: () => void
}) {
  const state = useStore()
  const today = todayStr()
  const now = nowMinutes()
  const [showDone, setShowDone] = useState(false)
  const courseOf = (t: Task) => state.courses.find((c) => c.id === t.courseId)

  const open = state.tasks.filter((t) => !t.done)
  const inbox = open.filter((t) => t.inbox)
  const rest = open.filter((t) => !t.inbox)
  const weekEnd = useMemo(() => {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  }, [today])

  const done = state.tasks.filter((t) => t.done)
  const groups: [string, Task[]][] = [
    ['今天', rest.filter((t) => t.due && t.due <= today)],
    ['这周', rest.filter((t) => t.due && t.due > today && t.due <= weekEnd)],
    ['以后', rest.filter((t) => t.due && t.due > weekEnd)],
    ['没有截止', rest.filter((t) => !t.due)],
  ]

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-[170px] [scrollbar-width:none]">
        <StickyHead className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">待办</h1>
          {state.tasks.length > 0 && (
            <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
              <span>今天 {groups[0][1].length} 项</span>
              <span className="h-3 w-px bg-(--c-line)" />
              <span>这周 {groups[1][1].length} 项</span>
              {inbox.length > 0 && (
                <>
                  <span className="h-3 w-px bg-(--c-line)" />
                  <span className="text-(--c-ink4)">{inbox.length} 项待整理</span>
                </>
              )}
            </div>
          )}
        </StickyHead>

        {state.tasks.length === 0 ? (
          <div className="mt-14">
            <EmptyBlock
              kind="todo"
              title="暂无待办"
              desc="作业、考试与日常备忘。在这里随手记下，件件有着落。"
              actions={[['拍板书', onCamera, <CameraIcon key="c" size={15} stroke="#fff" />], ['文字', onText]]}
            />
          </div>
        ) : (
          <div className="mt-6 px-5">
            {inbox.length > 0 && (
              <div className="mb-5">
                <div className="flex items-baseline justify-between px-0.5">
                  <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink)">待整理</span>
                  <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">{inbox.length} 项</span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {inbox.map((t) => (
                    <InboxRow key={t.id} t={t} course={courseOf(t)} snap={snap} today={today} onOpen={() => onOpen(t)} />
                  ))}
                </div>
              </div>
            )}
            {groups.filter(([, l]) => l.length > 0).map(([g, list]) => (
              <div key={g} className="mb-5">
                <div className="flex items-baseline justify-between px-0.5">
                  <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink)">{g}</span>
                  <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">{list.length} 项</span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {list.map((t) => (
                    <TaskRow key={t.id} t={t} course={courseOf(t)} today={today} now={now} onOpen={() => onOpen(t)} />
                  ))}
                </div>
              </div>
            ))}
            {done.length > 0 && (
              <>
                <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center justify-between px-0.5 py-1">
                  <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink4)">已完成 {done.length} 项</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.4" className={showDone ? 'rotate-90' : ''}><path d="m9 5 7 7-7 7" /></svg>
                </button>
                {showDone && (
                  <div className="mt-2.5 space-y-2">
                    {done.map((t) => (
                      <TaskRow key={t.id} t={t} course={courseOf(t)} today={today} now={now} onOpen={() => onOpen(t)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <BottomVeil height={190} />
      {state.tasks.length > 0 && !composing && <QuickBar onCamera={onCamera} onText={onText} />}
    </>
  )
}
