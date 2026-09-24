/** 地址栏里的加载进度：淡色填充从左往右铺满胶囊（Safari 的做法） */
import { useEffect, useRef } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'

export /*
 * 地址栏里的加载进度：一层淡色填充从左往右铺满胶囊（Safari 的做法）。
 * 不直接跟真实进度跳：只往前走，很快走到上报的位置，等网络时继续慢慢蠕动到 9 成，
 * 加载完成直接拉满再淡出，不倒退不闪。
 */
function LoadFill({ loading, progress }: { loading: boolean; progress: number }) {
  const x = useMotionValue(0)
  const op = useMotionValue(0)
  const width = useTransform(x, (v) => `${v * 100}%`)
  const started = useRef(false)
  useEffect(() => {
    if (loading) {
      started.current = true
      if (x.get() >= 1) x.set(0)
      const target = Math.max(x.get(), 0.12 + (progress / 100) * 0.78)
      const fade = animate(op, 1, { duration: 0.15 })
      const step = animate(x, target, { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.35 })
      let creep: ReturnType<typeof animate> | null = null
      void step.then(() => {
        creep = animate(x, 0.9, { type: 'tween', ease: 'linear', duration: 14 })
      })
      return () => {
        fade.stop()
        step.stop()
        creep?.stop()
      }
    }
    if (!started.current) return
    let done = false
    const fill = animate(x, 1, { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.2 })
    let fade: ReturnType<typeof animate> | null = null
    void fill.then(() => {
      if (done) return
      fade = animate(op, 0, { duration: 0.25 })
      void fade.then(() => {
        if (!done) x.set(0)
      })
    })
    return () => {
      done = true
      fill.stop()
      fade?.stop()
    }
  }, [loading, progress, x, op])
  return <motion.div aria-hidden style={{ width, opacity: op, background: 'color-mix(in oklab, var(--c-accent) 14%, transparent)' }} className="pointer-events-none absolute inset-y-0 left-0" />
}
