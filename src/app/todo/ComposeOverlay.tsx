import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Snapshot } from '../../domain/engine'
import { captureContext, suggestedDue } from '../../domain/next-class'
import { uid } from '../../domain/store'
import { nowMinutes, todayStr } from '../semester'
import { store, useStore } from '../store'
import { useImeY } from '../ime'
import { ArrowUpIcon, CameraIcon, Chip, COMPOSE_RADIUS, FADE, SHEET, clipText, composeLayoutId, dockStyle } from '../ui'
import { dueText, useMeta } from './shared'

/* ---------------- 文字：胶囊本身长成一段话 ---------------- */

export function ComposeOverlay({
  snap, courseId, onClose, onCamera,
}: {
  snap: Snapshot | null
  courseId?: string
  onClose: () => void
  onCamera: () => void
}) {
  const state = useStore()
  const today = todayStr()
  const now = nowMinutes()
  const ctx = useMemo(() => (snap ? captureContext(snap, today, now) : null), [snap, today, now])
  const [text, setText] = useState('')
  const cid0 = courseId ?? ctx?.courseId ?? ''
  const guess = useMemo(() => (snap ? suggestedDue(snap, cid0 || undefined, today, now) : null), [snap, cid0, today, now])
  const meta = useMeta({ cid: cid0, due: guess?.due, dueMinutes: guess?.dueMinutes, kind: 'homework' }, state.courses, snap)
  const ref = useRef<HTMLTextAreaElement>(null)
  const course = state.courses.find((c) => c.id === meta.cid)

  /* 先让胶囊长成卡，再叫键盘：键盘抬升由下面的 y 平滑接管 */
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 300)
    return () => window.clearTimeout(t)
  }, [])

  /* 键盘跟随：卡片贴着视口底，按原生逐帧喂进来的键盘高度平移（见 ime.ts） */
  const y = useImeY()

  const send = () => {
    const title = text.trim()
    if (!title) return
    store.addTask({
      id: uid(),
      title,
      kind: meta.kind,
      courseId: meta.cid || undefined,
      due: meta.due || undefined,
      dueMinutes: meta.dueMinutes,
      done: false,
      createdAt: Date.now(),
      photos: [],
      capturedCourseId: ctx?.courseId,
      capturedAt: Date.now(),
    })
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="absolute inset-0 z-[50]">
      <button onClick={onClose} className="absolute inset-0 bg-(--c-bg)/55" />
      <div className="pointer-events-none absolute inset-0">
      <motion.div
        layoutId={composeLayoutId(courseId)}
        transition={SHEET}
        className="pointer-events-auto absolute inset-x-3 bottom-3 px-4 pt-3.5 pb-3"
        style={{ ...dockStyle, borderRadius: COMPOSE_RADIUS, y }}
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, delay: 0.1 }}>
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="新待办"
            className="max-h-[120px] w-full resize-none bg-transparent text-[16px] leading-[1.4] font-semibold tracking-[-.01em] text-(--c-ink) outline-none placeholder:font-medium placeholder:text-(--c-ink4)"
          />
          <div className="mt-3 flex items-center gap-1.5">
            <button
              onClick={onCamera}
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-(--c-surface2) transition-transform duration-150 active:scale-[.92]"
            >
              <CameraIcon size={16} stroke="var(--c-ink2)" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Chip color={course?.color} onClick={() => void meta.pickCourse()} shrink>{course ? clipText(course.name) : '课程'}</Chip>
              <Chip onClick={meta.pickDue}>{meta.due ? dueText(meta.due, meta.dueMinutes, today) : '截止'}</Chip>
            </div>
            <button
              onClick={send}
              disabled={!text.trim()}
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-(--c-accent) transition-transform duration-150 active:scale-[.92] disabled:bg-(--c-line)"
            >
              <ArrowUpIcon />
            </button>
          </div>
        </motion.div>
      </motion.div>
      </div>
      {meta.node}
    </motion.div>
  )
}
