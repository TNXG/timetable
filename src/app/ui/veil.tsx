import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, type MotionValue } from 'motion/react'
import { useImeShrink } from '../ime'
import { FADE } from './constants'
import { BackButton } from './nav'

/* 顶部标题区的白色半透明层：越靠上越白、越模糊，往下是连续的梯度而不是硬边。
   多层 backdrop-filter 叠放，每层带一条渐变遮罩让模糊半径连续过渡，不出硬边。
   每层 [模糊半径, 遮罩开始消退的位置%, 完全消退的位置%] */
const BLUR_BANDS: [number, number, number][] = [
  [1, 70, 100],
  [2, 56, 92],
  [4, 42, 78],
  [8, 26, 62],
  [14, 8, 46],
]

const VEIL = 'linear-gradient(to bottom, rgb(var(--c-bg-rgb) / .84) 0%, rgb(var(--c-bg-rgb) / .74) 58%, rgb(var(--c-bg-rgb) / .28) 86%, rgb(var(--c-bg-rgb) / 0) 100%)'

/** 最近的可滚动祖先 */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/** 大标题是否已整段滑进标题区下面；只在跨过阈值时触发一次重渲染 */
function useTitlePassed(h1: React.RefObject<HTMLElement | null>) {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    const el = h1.current
    const sc = scrollParent(el)
    if (!el || !sc) return
    const on = () => {
      const spacer = el.previousElementSibling as HTMLElement | null
      setPassed(sc.scrollTop > 0 && !!spacer && el.getBoundingClientRect().bottom <= sc.getBoundingClientRect().top + spacer.offsetHeight)
    }
    on()
    sc.addEventListener('scroll', on, { passive: true })
    return () => sc.removeEventListener('scroll', on)
  }, [h1])
  return passed
}

/** 羽化随滚动距离渐现：前 24px 内 ease-out 到 1 */
export const VEIL_RANGE = 24
export const veilProgress = (top: number) => {
  const t = Math.min(1, Math.max(0, top / VEIL_RANGE))
  return 1 - (1 - t) * (1 - t)
}

/** 滚动容器驱动的羽化透明度：MotionValue 直接写样式，不走 React 重渲染 */
export function useVeilOpacity(ref: React.RefObject<HTMLElement | null>, offset: () => number = () => 0) {
  const mv = useMotionValue(0)
  useEffect(() => {
    const sc = scrollParent(ref.current)
    if (!sc) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      /* 每帧写一个肉眼不可见的新值：Android WebView 的合成器只在属性树有改动时重新采样 backdrop，
         纯合成线程滚动（慢滑）不会触发，模糊层就停在旧画面上 */
      raf = requestAnimationFrame(() => mv.set(veilProgress(sc.scrollTop - offset()) - (sc.scrollTop % 97) * 1e-6))
    }
    on()
    sc.addEventListener('scroll', on, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      sc.removeEventListener('scroll', on)
    }
  }, [ref, mv])
  return mv
}

export function TopVeil({ bleed = 0, feather = 44, progress = 1 }: {
  bleed?: number
  feather?: number
  progress?: number | MotionValue<number>
}) {
  return (
    /* 透明度写在每个子层上而不是父层：父层 opacity<1 会成为 backdrop root，模糊层就采样不到底下内容 */
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-[-1]"
      style={{ left: -bleed, right: -bleed, bottom: -feather }}
    >
      {BLUR_BANDS.map(([r, a, b]) => {
        /* 层只铺到遮罩消尽处：再往下全透明，模糊却照样要算 */
        const mask = `linear-gradient(to bottom, #000 0%, #000 ${(a / b) * 100}%, rgba(0,0,0,0) 100%)`
        return (
          <motion.div
            key={r}
            className="absolute inset-x-0 top-0"
            style={{
              height: `${b}%`,
              opacity: progress,
              backdropFilter: `blur(${r}px)`,
              WebkitBackdropFilter: `blur(${r}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        )
      })}
      <motion.div className="absolute inset-0" style={{ background: VEIL, opacity: progress }} />
    </div>
  )
}

/** 底栏后面的渐变遮挡：底色向上淡出，再叠一点轻微的模糊过渡 */
const BOTTOM_BANDS: [number, number, number][] = [
  [1, 60, 100],
  [2, 40, 80],
  [4, 18, 58],
]

/** 底色完全不透明的那段（%）：这段下面的模糊看不见，模糊层从它上沿开始铺 */
const BOTTOM_SOLID = 42
const BOTTOM_VEIL = `linear-gradient(to top, var(--c-bg) 0%, var(--c-bg) ${BOTTOM_SOLID}%, rgb(var(--c-bg-rgb) / .85) 66%, rgb(var(--c-bg-rgb) / 0) 100%)`

export function BottomVeil({ height }: { height: number }) {
  const shrink = useImeShrink()
  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[7]" style={{ height, y: shrink }}>
      {BOTTOM_BANDS.map(([r, a, b]) => {
        /* 原遮罩在 [BOTTOM_SOLID, b] 这段的取值原样映射到缩小后的层上 */
        const mask = a > BOTTOM_SOLID
          ? `linear-gradient(to top, #000 0%, #000 ${((a - BOTTOM_SOLID) / (b - BOTTOM_SOLID)) * 100}%, rgba(0,0,0,0) 100%)`
          : `linear-gradient(to top, rgba(0,0,0,${(b - BOTTOM_SOLID) / (b - a)}) 0%, rgba(0,0,0,0) 100%)`
        return (
          <div
            key={r}
            className="absolute inset-x-0"
            style={{ bottom: `${BOTTOM_SOLID}%`, height: `${b - BOTTOM_SOLID}%`, backdropFilter: `blur(${r}px)`, WebkitBackdropFilter: `blur(${r}px)`, maskImage: mask, WebkitMaskImage: mask }}
          />
        )
      })}
      <div className="absolute inset-0" style={{ background: BOTTOM_VEIL }} />
    </motion.div>
  )
}

/** 固定在滚动容器顶部的标题区：内容从它下面滑过去，标题本身不动；羽化只在滚动后出现 */
export function StickyHead({ children, bleed = 0, feather, className = '' }: {
  children: React.ReactNode
  bleed?: number
  feather?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const veil = useVeilOpacity(ref)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [h, setH] = useState(0)
  /* 标题区挂到滚动容器外层：backdrop-filter 不在 sticky 里，慢滚也能实时取到下面的内容 */
  useLayoutEffect(() => {
    const sc = scrollParent(ref.current)
    setHost((ref.current?.closest('[data-veil-host]') as HTMLElement | null) ?? sc?.parentElement ?? null)
  }, [])
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [host])
  const head = (
    <div ref={box} className={`absolute inset-x-0 top-0 z-[30] isolate pt-[max(52px,calc(env(safe-area-inset-top)+22px))] pb-3 ${className}`}>
      <TopVeil bleed={bleed} feather={feather} progress={veil} />
      {children}
    </div>
  )
  return (
    <>
      <div ref={ref} style={{ height: h }} />
      {host ? createPortal(head, host) : null}
    </>
  )
}

export function TopBar({ title, sub, onBack, trail }: { title: string; sub?: string; onBack?: () => void; trail?: React.ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null)
  /* 大标题整段滑进羽化层后，小标题接在返回按钮右侧 */
  const passed = useTitlePassed(h1)
  return (
    <>
      <StickyHead className="px-5 pb-1">
        <div className="flex h-9 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {onBack ? <BackButton onClick={onBack} /> : <span />}
            <motion.div
              aria-hidden={!passed}
              initial={false}
              animate={{ opacity: passed ? 1 : 0, y: passed ? 0 : 6 }}
              transition={FADE}
              className="truncate text-[17px] font-bold tracking-[-.01em] text-(--c-ink)"
            >
              {title}
            </motion.div>
          </div>
          {trail}
        </div>
      </StickyHead>
      <h1 ref={h1} className="mt-4 text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">{title}</h1>
      {sub && <div className="mt-1.5 text-[13px] leading-[1.5] font-medium text-(--c-ink4)">{sub}</div>}
    </>
  )
}
