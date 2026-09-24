import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { haptic } from '../widgets'

/*
 * 滚轮：自己接管手势与惯性，不用原生滚动。
 * 松手后按 τ=170ms 指数衰减，落点四舍五入到整行，再用 ease-out 收进去（比原生 scroll-snap 的长滑行短得多）；
 * 越界有 0.3 倍的橡皮筋；每跨过一行给一次 tick，撞到边界给一次 edge。
 * 上下淡出用叠在上面的渐变层而不是 mask-image（Android WebView 给滚动层建 mask 层时会闪一帧）。
 */
const WHEEL_ROW = 40
const WHEEL_TAU = 170
const WHEEL_MAX_V = 2.4
const WHEEL_BAND = 0.3
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function Wheel({ items, index, onChange, className = '' }: { items: string[]; index: number; onChange: (i: number) => void; className?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const max = (items.length - 1) * WHEEL_ROW
  const st = useRef({
    y: index * WHEEL_ROW,
    raw: 0,
    row: index,
    dragging: false,
    moved: false,
    pid: -1,
    lastY: 0,
    lastT: 0,
    v: 0,
    raf: 0,
    edged: false,
    anim: null as null | { from: number; to: number; t0: number; dur: number },
  })
  const [cur, setCur] = useState(index)

  const paint = useCallback(() => {
    const el = track.current
    if (el) el.style.transform = `translate3d(0,${-st.current.y}px,0)`
  }, [])

  /** y 变化后：换行给 tick、越界给 edge、同步高亮行 */
  const settle = useCallback((y: number) => {
    const s = st.current
    s.y = y
    const row = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ROW)))
    if (row !== s.row) {
      s.row = row
      setCur(row)
      haptic('selection')
    }
    const out = y < 0 || y > max
    if (out && !s.edged) haptic('light')
    s.edged = out
    paint()
  }, [items.length, max, paint])

  const stop = useCallback(() => {
    const s = st.current
    if (s.raf) cancelAnimationFrame(s.raf)
    s.raf = 0
    s.anim = null
  }, [])

  /** 从当前位置 ease-out 到 to；到位后回调 */
  const glide = useCallback((to: number, dur: number) => {
    const s = st.current
    stop()
    s.anim = { from: s.y, to, t0: performance.now(), dur }
    const step = (now: number) => {
      const a = s.anim
      if (!a) return
      const p = Math.min(1, (now - a.t0) / a.dur)
      settle(a.from + (a.to - a.from) * easeOut(p))
      if (p < 1) s.raf = requestAnimationFrame(step)
      else {
        s.anim = null
        s.raf = 0
        const i = Math.round(a.to / WHEEL_ROW)
        if (i !== index) onChange(i)
      }
    }
    s.raf = requestAnimationFrame(step)
  }, [index, onChange, settle, stop])

  /* 外部 index 变了（另一列联动、初始化）：不在手里时直接对齐 */
  useLayoutEffect(() => {
    const s = st.current
    if (s.dragging || s.anim) return
    const to = index * WHEEL_ROW
    if (Math.abs(s.y - to) < 0.5) return
    if (Math.abs(s.y - to) <= WHEEL_ROW * 3) glide(to, 220)
    else {
      s.y = to
      s.row = index
      setCur(index)
      paint()
    }
  }, [index, glide, paint])

  useEffect(() => stop, [stop])

  const release = () => {
    const s = st.current
    s.dragging = false
    const v = Math.max(-WHEEL_MAX_V, Math.min(WHEEL_MAX_V, s.v))
    const target = Math.max(0, Math.min(max, Math.round((s.y + v * WHEEL_TAU) / WHEEL_ROW) * WHEEL_ROW))
    const dist = Math.abs(target - s.y)
    glide(target, Math.max(180, Math.min(520, 160 + dist * 0.9)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const s = st.current
    stop()
    s.dragging = true
    s.moved = false
    s.raw = s.y
    s.pid = e.pointerId
    s.lastY = e.clientY
    s.lastT = e.timeStamp
    s.v = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current
    if (!s.dragging || e.pointerId !== s.pid) return
    const dy = s.lastY - e.clientY
    const dt = Math.max(1, e.timeStamp - s.lastT)
    s.lastY = e.clientY
    s.lastT = e.timeStamp
    /* 速度取近几帧的加权，抬手瞬间抖一下不至于飞出去 */
    s.v = s.v * 0.6 + (dy / dt) * 0.4
    s.raw += dy
    if (Math.abs(s.raw - s.y) > 4 || s.moved) s.moved = true
    settle(s.raw < 0 ? s.raw * WHEEL_BAND : s.raw > max ? max + (s.raw - max) * WHEEL_BAND : s.raw)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current
    if (!s.dragging || e.pointerId !== s.pid) return
    if (e.timeStamp - s.lastT > 60) s.v = 0
    release()
  }
  const onWheel = (e: React.WheelEvent) => {
    const s = st.current
    if (s.dragging) return
    const dir = Math.sign(e.deltaY)
    if (!dir) return
    const to = Math.max(0, Math.min(max, (Math.round((s.anim?.to ?? s.y) / WHEEL_ROW) + dir) * WHEEL_ROW))
    glide(to, 200)
  }

  return (
    <div
      className={`relative touch-none overflow-hidden select-none ${className}`}
      style={{ height: WHEEL_ROW * 5 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[10px] bg-(--c-surface2)" style={{ height: WHEEL_ROW }} />
      <div ref={track} className="relative will-change-transform" style={{ paddingTop: WHEEL_ROW * 2, transform: `translate3d(0,${-index * WHEEL_ROW}px,0)` }}>
        {items.map((t, i) => (
          <div
            key={i}
            onClick={() => { if (!st.current.moved) glide(i * WHEEL_ROW, 220) }}
            className={`flex items-center justify-center text-[16px] tabular-nums transition-colors ${i === cur ? 'font-bold text-(--c-ink)' : 'font-medium text-(--c-ink4)'}`}
            style={{ height: WHEEL_ROW }}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: WHEEL_ROW * 1.5, background: 'linear-gradient(to bottom, var(--c-surface), transparent)' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: WHEEL_ROW * 1.5, background: 'linear-gradient(to top, var(--c-surface), transparent)' }} />
    </div>
  )
}
