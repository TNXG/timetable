import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FADE } from './constants'

export interface Rect { x: number; y: number; w: number; h: number }

/** 长按时被按住的卡片：在遮罩之上原位抬起的一份副本 */
export interface Ghost {
  el: HTMLElement
  rect: Rect
  radius: number
  scale: number
  /** 课程色描边；不传则只做白卡抬起 */
  color?: string
  bg?: string
  /** 副本四周向外扩出的内边距（把内容块包成一张卡） */
  pad?: number
  /** 允许贴纸等元素溢出副本边界 */
  overhang?: boolean
}

const MENU_SPRING = { type: 'spring', bounce: 0.28, duration: 0.42 } as const
const MENU_OUT = { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.18 } as const

/* 长按后的浮层菜单：卡片副本抬到遮罩上，菜单从卡片一侧弹出；dismissRef 给外部走同一条退场后再 onClose */
export function Popover({ anchor, ghost, onClose, dismissRef, children }: { anchor: Rect; ghost?: Ghost; onClose: () => void; dismissRef?: React.MutableRefObject<(() => void) | null>; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const close = useCallback(() => setOpen(false), [])
  if (dismissRef) dismissRef.current = close
  useEffect(() => () => { if (dismissRef && dismissRef.current === close) dismissRef.current = null }, [dismissRef, close])
  const shellW = Math.min(window.innerWidth, 430)
  const shellH = window.innerHeight
  const below = anchor.y + anchor.h + 10
  const originTop = shellH - below > 300
  const ghostHost = useRef<HTMLDivElement>(null)
  const pad = ghost?.pad ?? 0
  useLayoutEffect(() => {
    const host = ghostHost.current
    if (!host || !ghost) return
    const clone = ghost.el.cloneNode(true) as HTMLElement
    clone.style.pointerEvents = 'none'
    clone.style.transform = 'none'
    clone.style.opacity = '1'
    clone.style.margin = '0'
    clone.style.position = 'absolute'
    clone.style.top = `${pad}px`
    clone.style.left = `${pad}px`
    clone.style.width = `${ghost.rect.w}px`
    clone.style.height = `${ghost.rect.h}px`
    host.replaceChildren(clone)
  }, [ghost, pad])
  return (
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            className="absolute inset-0 z-[60] bg-(--c-bg)/72"
            onClick={close}
          />
          {ghost && (
            <motion.div
              key="ghost"
              ref={ghostHost}
              initial={{ transform: 'scale(1)' }}
              animate={{ transform: `scale(${ghost.scale})` }}
              exit={{ transform: 'scale(1)', opacity: 0, transition: { transform: MENU_OUT, opacity: FADE } }}
              transition={{ transform: MENU_SPRING }}
              className={`pointer-events-none absolute z-[65] will-change-transform ${ghost.overhang ? '' : 'overflow-hidden'}`}
              style={{
                top: ghost.rect.y - pad,
                left: ghost.rect.x - pad,
                width: ghost.rect.w + pad * 2,
                height: ghost.rect.h + pad * 2,
                borderRadius: ghost.radius,
                background: ghost.bg,
                boxShadow: ghost.color
                  ? `inset 0 0 0 1.5px ${ghost.color}, var(--c-lift-shadow)`
                  : 'var(--c-lift-shadow)',
                transformOrigin: originTop ? 'center bottom' : 'center top',
              }}
            />
          )}
          <motion.div
            key="menu"
            initial={{ opacity: 0, transform: 'scale(0.55)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0, transform: 'scale(0.9)', transition: { transform: MENU_OUT, opacity: { duration: 0.14 } } }}
            transition={{ transform: MENU_SPRING, opacity: { duration: 0.14 } }}
            style={{
              top: originTop ? below : undefined,
              bottom: originTop ? undefined : Math.max(12, shellH - anchor.y + 10),
              left: Math.min(Math.max(12, anchor.x + anchor.w / 2 - 113), shellW - 238),
              transformOrigin: originTop ? 'top center' : 'bottom center',
              boxShadow: 'var(--c-menu-shadow)',
            }}
            className="absolute z-[70] w-[226px] overflow-hidden rounded-[17px] border border-(--c-menu-line) bg-(--c-surface) py-2 will-change-transform"
            onClick={close}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
