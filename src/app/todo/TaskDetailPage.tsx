import { useEffect, useState } from 'react'
import type { Task } from '../../domain/types'
import type { Snapshot } from '../../domain/engine'
import { todayStr } from '../semester'
import { store, useStore } from '../store'
import { camera } from '../camera'
import { haptic, nativeToast } from '../widgets'
import { PhotoViewer, TaskPhotoImg } from '../photo'
import { ActionSheet, CameraIcon, ICON, Page, type ActionItem } from '../ui'
import { CheckBox, MetaChips, toggleDone, useMeta } from './shared'

/* ---------------- 详情 ---------------- */

export function TaskDetailPage({
  task, snap, onBack, onCamera,
}: {
  task: Task
  snap: Snapshot | null
  onBack: () => void
  onCamera: () => void
}) {
  const state = useStore()
  const cur = state.tasks.find((t) => t.id === task.id) ?? task
  const today = todayStr()
  const meta = useMeta({ cid: cur.courseId ?? '', due: cur.due, dueMinutes: cur.dueMinutes, kind: cur.kind }, state.courses, snap)
  const [title, setTitle] = useState(cur.title)
  const [note, setNote] = useState(cur.note ?? '')
  const capturedCourse = state.courses.find((c) => c.id === cur.capturedCourseId)

  /* 改动即时落库，退出时不需要「保存」 */
  useEffect(() => {
    store.editTask(cur.id, {
      title,
      note: note.trim() || undefined,
      courseId: meta.cid || undefined,
      due: meta.due || undefined,
      dueMinutes: meta.dueMinutes,
      kind: meta.kind,
      inbox: title.trim().length === 0 ? cur.inbox : false,
    })
  }, [title, note, meta.cid, meta.due, meta.dueMinutes, meta.kind])

  const [menu, setMenu] = useState<null | { kind: 'task' }>(null)
  const [viewing, setViewing] = useState<{ id: string; path: string } | null>(null)

  const removeTask = async () => {
    await camera.remove((cur.photos ?? []).map((p) => p.path))
    store.removeTask(cur.id)
    haptic('warning')
    nativeToast('已删除待办')
    onBack()
  }
  const removePhoto = async (id: string, path: string) => {
    await camera.remove([path])
    store.removePhoto(cur.id, id)
  }
  const taskMenu: ActionItem[][] = [
    [{ title: '删除待办', icon: ICON.trash, danger: true, onClick: () => void removeTask() }],
  ]

  return (
    <Page>
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-12 [scrollbar-width:none]">
        <div className="flex flex-none items-center justify-between">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
          </button>
          <button onClick={() => setMenu({ kind: 'task' })} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: 'var(--c-ink)' }}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        </div>

        <textarea
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="名称"
          className="mt-5 w-full resize-none bg-transparent text-[22px] leading-[1.3] font-extrabold tracking-[-.02em] text-(--c-ink) outline-none placeholder:text-(--c-ink5)"
        />

        <div className="mt-4 flex gap-2.5 overflow-x-auto [scrollbar-width:none]">
          {(cur.photos ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setViewing({ id: p.id, path: p.path })}
              className="h-[76px] w-[102px] flex-none overflow-hidden rounded-[12px] transition-transform duration-150 active:scale-[.96]"
            >
              <TaskPhotoImg path={p.path} className="h-full w-full" />
            </button>
          ))}
          <button
            onClick={onCamera}
            className="flex h-[76px] w-[76px] flex-none items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-(--c-ink5) transition-transform duration-150 active:scale-[.94]"
          >
            <CameraIcon stroke="var(--c-ink4)" />
          </button>
        </div>

        <div className="mt-4">
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

        <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <textarea
            rows={1}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注"
            className="w-full resize-none bg-transparent text-[14px] leading-[1.5] font-medium text-(--c-ink) outline-none placeholder:text-(--c-ink4)"
          />
        </div>

        <button
          onClick={() => toggleDone(cur)}
          className="mt-3 flex w-full items-center gap-3 rounded-[16px] bg-(--c-surface) px-4 py-3.5 text-left transition-transform duration-150 active:scale-[.98]"
        >
          <CheckBox done={cur.done} color={state.courses.find((c) => c.id === meta.cid)?.color ?? 'var(--c-accent)'} />
          <span className={`text-[14px] font-bold ${cur.done ? 'text-(--c-ink4)' : 'text-(--c-ink)'}`}>{cur.done ? '已完成' : '完成'}</span>
        </button>

        <div className="pb-[max(22px,env(safe-area-inset-bottom))]" />
        {meta.node}
        {menu?.kind === 'task' && <ActionSheet title={cur.title || '待办'} groups={taskMenu} onClose={() => setMenu(null)} />}
      </div>
      {viewing && (
        <PhotoViewer
          path={viewing.path}
          onClose={() => setViewing(null)}
          onDelete={() => void removePhoto(viewing.id, viewing.path)}
        />
      )}
    </Page>
  )
}
