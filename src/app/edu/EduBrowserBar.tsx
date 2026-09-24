/** 教务浏览器顶栏：返回、地址与加载进度、停止/刷新、更多菜单入口 */
import type { EduNav } from '../edu-browser'
import { edu } from '../edu-browser'
import { hostOf } from '../../domain/edu/systems'
import { BackButton } from '../ui'
import { LoadFill } from './LoadFill'

export function EduBrowserBar({ nav, onBack, onMenu }: {
  nav: EduNav
  onBack: () => void
  onMenu: () => void
}) {
  const secure = /^https:/i.test(nav.url)
  return (
    <div className="flex items-center gap-3 bg-(--c-bg) px-5 pt-[max(52px,calc(env(safe-area-inset-top)+22px))] pb-4">
      <BackButton onClick={onBack} />
      <div className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-(--c-surface) px-4">
        <LoadFill loading={nav.loading} progress={nav.progress} />
        {secure && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink4)' }} strokeWidth="2.4" className="relative mr-2 flex-none"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        )}
        <span className="relative min-w-0 flex-1 truncate text-[12.5px] font-semibold text-(--c-ink2)">{hostOf(nav.url)}</span>
      </div>
      {/* 加载中是“停止”，加载完是“刷新” */}
      <button
        onClick={() => void (nav.loading ? edu.stop() : edu.reload())}
        aria-label={nav.loading ? '停止' : '刷新'}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
      >
        {nav.loading ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink)' }} strokeWidth="2.4" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
        )}
      </button>
      <button
        onClick={onMenu}
        aria-label="更多"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: 'var(--c-ink)' }}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
    </div>
  )
}
