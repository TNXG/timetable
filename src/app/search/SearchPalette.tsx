/** 搜索：课程、老师、教室、待办，盖在 Tab 上的浮层 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course, Task } from '../../domain/types'
import type { State } from '../../domain/store'
import { WD } from '../ui'
import { todayStr } from '../semester'
import { dueText, KIND_LABEL as TASK_KIND_LABEL } from '../todo'

/* 命中部分按原型高亮 */
function Hit({ text, q }: { text: string; q: string }) {
  const s = q.trim()
  const i = s ? text.toLowerCase().indexOf(s.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="bg-(--c-accent-soft) text-(--c-accent)">{text.slice(i, i + s.length)}</span>
      {text.slice(i + s.length)}
    </>
  )
}

export function SearchPalette({ state, onClose, onPickCourse, onPickTask }: { state: State; onClose: () => void; onPickCourse: (c: Course) => void; onPickTask: (t: Task) => void }) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const today = todayStr()

  const tasks = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const hit = (v?: string) => !!v && v.toLowerCase().includes(s)
    return state.tasks
      .filter((t) => hit(t.title) || hit(t.note) || hit(t.location) || hit(state.courses.find((c) => c.id === t.courseId)?.name))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9').localeCompare(b.due ?? '9'))
      .slice(0, 8)
  }, [q, state])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const locOf = new Map<string, string[]>()
    for (const r of state.rules) {
      const arr = locOf.get(r.courseId) ?? []
      if (r.location) arr.push(r.location)
      locOf.set(r.courseId, arr)
    }
    const live = state.courses.filter((c) => !c.removedByImport)
    const byName = live.filter((c) => c.name.toLowerCase().includes(s))
    const byTeacher = live.filter((c) => !byName.includes(c) && c.teacher?.toLowerCase().includes(s))
    const byRoom = live.filter((c) => !byName.includes(c) && !byTeacher.includes(c) && (locOf.get(c.id) ?? []).some((l) => l.toLowerCase().includes(s)))
    const mk = (label: string, list: Course[]): [string, Course[]] => [label, list.slice(0, 8)]
    return ([mk('课程', byName), mk('老师', byTeacher), mk('教室', byRoom)] as [string, Course[]][]).filter(([, l]) => l.length > 0)
  }, [q, state])

  return (
    <div className="flex-1 overflow-y-auto [scrollbar-width:none]">
      <div className="px-4 pt-[max(52px,calc(env(safe-area-inset-top)+22px))] pb-10">
        <div className="flex items-center rounded-full bg-(--c-surface) px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink4)' }} strokeWidth="2.2" strokeLinecap="round" className="mr-2.5 flex-none"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="课程、老师、教室、待办"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-(--c-ink) outline-none placeholder:text-(--c-ink5)"
          />
          <button onClick={onClose} className="ml-auto flex-none pl-2 text-[12.5px] font-medium text-(--c-ink3)">取消</button>
        </div>

        <div className="mt-3 space-y-3.5">
          {groups.map(([g, list]) => (
            <div key={g}>
              <div className="px-1.5 text-[11.5px] font-medium text-(--c-ink4)">{g}</div>
              <div className="mt-1.5 overflow-hidden rounded-[14px] bg-(--c-surface) p-1">
                {list.map((c) => {
                  const locs = [...new Set(state.rules.filter((r) => r.courseId === c.id).map((r) => r.location).filter(Boolean))]
                  const slots = state.rules.filter((r) => r.courseId === c.id)
                  return (
                    <button key={c.id} onClick={() => onPickCourse(c)} className="flex w-full items-center rounded-[10px] px-2.5 py-2.5 text-left transition-colors active:bg-(--c-surface2)">
                      <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full" style={{ background: c.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold"><Hit text={c.name} q={q} /></div>
                        <div className="mt-[2px] truncate text-[11.5px] font-medium text-(--c-ink4)">
                          {slots.length > 0 ? `${WD[slots[0].weekday]} ${slots[0].startPeriod}–${slots[0].endPeriod} 节` : '—'}{locs[0] ? `，${locs[0]}` : ''}
                        </div>
                      </div>
                      {c.teacher && <span className="ml-2 flex-none text-[11.5px] font-medium text-(--c-ink5)">{c.teacher}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {tasks.length > 0 && (
            <div>
              <div className="px-1.5 text-[11.5px] font-medium text-(--c-ink4)">待办</div>
              <div className="mt-1.5 overflow-hidden rounded-[14px] bg-(--c-surface) p-1">
                {tasks.map((t) => {
                  const course = state.courses.find((c) => c.id === t.courseId)
                  return (
                    <button key={t.id} onClick={() => onPickTask(t)} className={`flex w-full items-center rounded-[10px] px-2.5 py-2.5 text-left transition-colors active:bg-(--c-surface2) ${t.done ? 'opacity-45' : ''}`}>
                      <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full" style={{ background: course?.color ?? 'var(--c-ink5)' }} />
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[13.5px] font-semibold ${t.done ? 'line-through' : ''}`}><Hit text={t.title || '板书'} q={q} /></div>
                        <div className="mt-[2px] truncate text-[11.5px] font-medium text-(--c-ink4)">
                          {course?.name ?? TASK_KIND_LABEL[t.kind]}，{dueText(t.due, t.dueMinutes, today)}
                        </div>
                      </div>
                      {t.kind === 'exam' && <span className="ml-2 flex-none rounded-[5px] bg-(--c-rose-soft) px-1.5 py-[2px] text-[10px] font-extrabold text-(--c-rose)">考试</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {q.trim() && groups.length === 0 && tasks.length === 0 && (
            <div className="rounded-[14px] bg-(--c-surface) px-4 py-5 text-center text-[13px] font-medium text-(--c-ink4)">没有匹配的结果</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- 导入 ---------------- */
