import { useMemo, useState } from 'react'
import type { Snapshot } from '../../domain/engine'
import { captureContext, suggestedDue } from '../../domain/next-class'
import { uid } from '../../domain/store'
import { nowMinutes, todayStr } from '../semester'
import { store, useStore } from '../store'
import type { CapturedPhoto } from '../camera'
import { TaskPhotoImg } from '../photo'
import { Page, PrimaryButton } from '../ui'
import { MetaChips, useMeta } from './shared'

/* ---------------- 拍完：一下保存 ---------------- */

export function ReviewPage({
  snap, photos, courseId, onBack, onRetake, onSaved,
}: {
  snap: Snapshot | null
  photos: CapturedPhoto[]
  courseId?: string
  onBack: () => void
  onRetake: () => void
  onSaved: () => void
}) {
  const state = useStore()
  const today = todayStr()
  const now = nowMinutes()
  const ctx = useMemo(() => (snap ? captureContext(snap, today, now) : null), [snap, today, now])
  const cid0 = courseId ?? ctx?.courseId ?? ''
  const guess = useMemo(() => (snap ? suggestedDue(snap, cid0 || undefined, today, now) : null), [snap, cid0, today, now])
  const meta = useMeta({ cid: cid0, due: guess?.due, dueMinutes: guess?.dueMinutes, kind: 'homework' }, state.courses, snap)
  const [title, setTitle] = useState('')
  const capturedCourse = state.courses.find((c) => c.id === ctx?.courseId)

  const save = () => {
    const name = title.trim()
    store.addTask({
      id: uid(),
      title: name,
      kind: meta.kind,
      courseId: meta.cid || undefined,
      due: meta.due || undefined,
      dueMinutes: meta.dueMinutes,
      done: false,
      createdAt: Date.now(),
      photos: photos.map((p) => ({ id: uid(), path: p.path, w: p.width, h: p.height, takenAt: Date.now() })),
      inbox: name.length === 0,
      capturedCourseId: ctx?.courseId,
      capturedAt: Date.now(),
    })
    onSaved()
  }

  return (
    <Page>
      <div className="flex flex-1 flex-col overflow-hidden px-5 pt-12">
        <div className="flex flex-none items-center justify-between">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
          </button>
          <button onClick={onRetake} className="flex h-9 items-center rounded-full bg-(--c-surface) px-4 text-[13px] font-bold text-(--c-ink) transition-transform duration-150 active:scale-[.96]">重拍</button>
        </div>

        <div className="mt-4 flex flex-none gap-2.5 overflow-x-auto [scrollbar-width:none]">
          {photos.map((p, i) => (
            <TaskPhotoImg
              key={p.path}
              path={p.path}
              className={`h-[250px] flex-none overflow-hidden rounded-[20px] ${photos.length === 1 ? 'w-full' : 'w-[70%]'} ${i === 0 ? '' : ''}`}
            />
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="名称"
          className="mt-5 w-full flex-none bg-transparent text-[17px] font-semibold text-(--c-ink) outline-none placeholder:text-(--c-ink5)"
        />

        <div className="mt-4 flex-none">
          <MetaChips
            cid={meta.cid}
            due={meta.due}
            dueMinutes={meta.dueMinutes}
            kind={meta.kind}
            today={today}
            onCourse={() => void meta.pickCourse()}
            onDue={meta.pickDue}
            onKind={() => void meta.pickKind()}
          />
        </div>

        <div className="flex-1" />
        {meta.node}
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={save}>保存</PrimaryButton>
      </div>
    </Page>
  )
}
