import type { ClassMoment } from '../../domain/next-class'
import { CameraIcon } from '../ui'

/* ---------------- 今天页：刚下课那一刻 ---------------- */

export function ClassEndCard({ moment, onCamera, onText, onDismiss }: {
  moment: ClassMoment
  onCamera: () => void
  onText: () => void
  onDismiss: () => void
}) {
  return (
    <div className="-mt-4 flex">
      <div className="w-11 flex-none" />
      <div className="ml-3 w-[2px] flex-none self-stretch bg-(--c-accent)" />
      <div className="flex-1 pb-7 pl-4">
        <div className="rounded-[16px] bg-(--c-surface) p-3.5">
          <div className="flex items-start justify-between">
            <div className="text-[14px] font-bold tracking-[-.01em] text-(--c-ink)">刚下课，这节课有作业吗？</div>
            <button onClick={onDismiss} className="ml-2 flex-none pt-[3px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <button onClick={onCamera} className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full bg-(--c-ink) text-[12.5px] font-bold text-(--c-bg) transition-transform duration-150 active:scale-[.96]">
              <CameraIcon size={15} stroke="var(--c-bg)" />
              拍板书
            </button>
            <button onClick={onText} className="flex h-[34px] flex-1 items-center justify-center rounded-full bg-(--c-surface2) text-[12.5px] font-bold text-(--c-ink) transition-transform duration-150 active:scale-[.96]">
              文字
            </button>
          </div>
          <div className="mt-2.5 text-[11.5px] font-medium text-(--c-ink4)">{moment.name}</div>
        </div>
      </div>
    </div>
  )
}
