import { motion } from 'motion/react'
import type { Course, Task } from '../../domain/types'
import { nowMinutes, todayStr } from '../semester'
import { CameraIcon, COMPOSE_RADIUS, SHEET, composeLayoutId } from '../ui'
import { TaskRow } from './TodoView'

/* ---------------- 课程内页：作业与备忘 ---------------- */

export function CourseTasks({
  tasks, course, composing, onOpen, onCamera, onText,
}: {
  tasks: Task[]
  course: Course
  composing: boolean
  onOpen: (t: Task) => void
  onCamera: () => void
  onText: () => void
}) {
  const today = todayStr()
  const now = nowMinutes()
  return (
    <>
      <div className="text-[14px] font-bold text-(--c-ink)">作业与备忘</div>
      {tasks.length === 0 ? (
        <div className="mt-3 text-[12.5px] font-medium text-(--c-ink4)">还没有作业或备忘</div>
      ) : (
        <div className="mt-3 space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} course={course} today={today} now={now} onOpen={() => onOpen(t)} tone="surface2" />
          ))}
        </div>
      )}
      <div className="mt-3.5 h-12">
        {!composing && (
          <motion.div
            layoutId={composeLayoutId(course.id)}
            transition={SHEET}
            className="flex items-center gap-2 bg-(--c-surface2) p-[6px] pr-3.5"
            style={{ borderRadius: COMPOSE_RADIUS }}
          >
            <button
              onClick={onCamera}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
            >
              <CameraIcon size={17} />
            </button>
            <button onClick={onText} className="flex-1 pl-1 text-left text-[14px] font-medium text-(--c-ink4)">点击添加新待办</button>
          </motion.div>
        )}
      </div>
    </>
  )
}
