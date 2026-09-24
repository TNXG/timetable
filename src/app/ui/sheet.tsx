import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { animate, motion } from 'motion/react'
import { SLIDE } from './constants'

/* 底部抽屉（照 vaul 的做法）：只有一个合成层，进出与拖拽都只改这一层的 transform；
   遮罩的透明度跟着抽屉位置走；拖拽期间直接写 style，不经过 React；松手后按 vaul 的阈值决定关闭或回弹 */
const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
const SHEET_MS = 0.5

/** 当前打开的抽屉的关闭函数，最上层在末尾；系统返回先关它们 */
const openSheets: (() => void)[] = []
export function closeTopSheet(): boolean {
  const top = openSheets[openSheets.length - 1]
  if (!top) return false
  top()
  return true
}

/** 全屏覆盖层（图片查看等）也接系统返回：挂进同一个栈 */
export function useBackClose(close: () => void) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    const fn = () => ref.current()
    openSheets.push(fn)
    return () => {
      const i = openSheets.lastIndexOf(fn)
      if (i >= 0) openSheets.splice(i, 1)
    }
  }, [])
}

const CLOSE_RATIO = 0.25
const CLOSE_VELOCITY = 0.4 /* px/ms */

export function Sheet({
  children,
  onClose,
  className = '',
  header,
  footer,
  dismissRef,
}: {
  children: React.ReactNode
  onClose: () => void
  className?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  dismissRef?: React.MutableRefObject<(() => void) | null>
}) {
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const run = (to: number, opacity: number, duration = SHEET_MS) => {
    const el = panel.current
    const sc = scrim.current
    if (!el || !sc) return Promise.resolve()
    const a = animate(el, { transform: `translate3d(0,${to}px,0)` }, { duration, ease: SHEET_EASE })
    animate(sc, { opacity }, { duration, ease: SHEET_EASE })
    return a.then(() => {})
  }

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const h = panel.current?.offsetHeight ?? window.innerHeight
    void run(h, 0).then(() => onCloseRef.current())
  }, [])
  if (dismissRef) dismissRef.current = close

  useLayoutEffect(() => {
    const el = panel.current
    const sc = scrim.current
    if (!el || !sc) return
    el.style.transform = `translate3d(0,${el.offsetHeight}px,0)`
    sc.style.opacity = '0'
    void run(0, 1)
  }, [])

  useEffect(() => {
    openSheets.push(close)
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', h)
    return () => {
      const i = openSheets.lastIndexOf(close)
      if (i >= 0) openSheets.splice(i, 1)
      window.removeEventListener('keydown', h)
    }
  }, [close])

  /* 握把拖拽 */
  const drag = useRef<{ y: number; t: number; h: number; last: number; lastT: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    if (closing.current) return
    const el = panel.current
    if (!el) return
    el.getAnimations().forEach((a) => a.cancel())
    scrim.current?.getAnimations().forEach((a) => a.cancel())
    el.style.transform = 'translate3d(0,0,0)'
    if (scrim.current) scrim.current.style.opacity = '1'
    drag.current = { y: e.clientY, t: performance.now(), h: el.offsetHeight, last: 0, lastT: performance.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    let dy = e.clientY - d.y
    /* 往上拉：像 vaul 一样阻尼，只走一点 */
    if (dy < 0) dy = -Math.pow(-dy, 0.5) * 0.8
    el.style.transform = `translate3d(0,${dy}px,0)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / d.h))
    d.last = dy
    d.lastT = performance.now()
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dy = e.clientY - d.y
    const dt = Math.max(1, performance.now() - d.t)
    const v = dy / dt
    if (dy > d.h * CLOSE_RATIO || v > CLOSE_VELOCITY) {
      closing.current = true
      void run(d.h, 0, Math.min(SHEET_MS, Math.max(0.2, ((d.h - dy) / d.h) * SHEET_MS))).then(() => onCloseRef.current())
    } else {
      void run(0, 1)
    }
  }

  return (
    <>
      <div
        ref={scrim}
        className="absolute inset-0 z-[60]"
        style={{ background: 'var(--c-scrim)', opacity: 0 }}
        onClick={close}
      />
      <div
        ref={panel}
        className={`absolute inset-x-0 bottom-0 z-[70] flex max-h-[88%] flex-col rounded-t-[26px] bg-(--c-surface) pt-2 will-change-transform`}
        style={{ transform: 'translate3d(0,100%,0)', touchAction: 'none' }}
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="flex-none cursor-grab touch-none py-1.5"
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-(--c-line)" />
        </div>
        {header && <div className="flex-none">{header}</div>}
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] ${className}`} style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
        <div className="flex-none pb-[max(22px,env(safe-area-inset-bottom))]">{footer}</div>
      </div>
    </>
  )
}

/* 全屏内页：从右侧推入，盖住底栏；keep 的页在内置浏览器透明模式下仍可见（'opaque' 保留自己的底色，盖在浏览器上方） */
export function Page({ children, className = '', root, keep }: { children: React.ReactNode; className?: string; onBack?: () => void; root?: boolean; keep?: boolean | 'opaque' }) {
  return (
    <motion.div
      initial={root ? false : { transform: 'translateX(100%)' }}
      animate={{ transform: 'translateX(0%)' }}
      exit={{ transform: 'translateX(100%)' }}
      transition={SLIDE}
      data-edu-keep={keep === 'opaque' ? 'opaque' : keep ? '' : undefined}
      className="absolute inset-0 z-[40] will-change-transform"
    >
      <div data-veil-host className={`absolute inset-0 flex flex-col overflow-hidden bg-(--c-bg) ${className}`}>
        {children}
      </div>
    </motion.div>
  )
}
