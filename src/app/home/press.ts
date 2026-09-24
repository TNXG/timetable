/** 长按与轻点：判定与坐标换算到外层壳，视觉反馈交给卡片自己的 active 样式 */
import type { Rect } from '../ui'
import { haptic } from '../widgets'

/* 轻点进详情，长按弹快捷菜单（坐标换算到外层壳） */
let pressTimer: number | null = null
let pressFired = false
let pressAt = { x: 0, y: 0 }

export function clearPress() {
  if (pressTimer != null) {
    window.clearTimeout(pressTimer)
    pressTimer = null
  }
}

export function pressProps(onTap: () => void, onLong: (r: Rect, el: HTMLElement) => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      pressFired = false
      pressAt = { x: e.clientX, y: e.clientY }
      const target = e.currentTarget as HTMLElement
      const el = target.querySelector<HTMLElement>('[data-lift]') ?? target.closest<HTMLElement>('[data-lift]') ?? target
      const shell = el.closest('[data-shell]')?.getBoundingClientRect()
      const box = el.getBoundingClientRect()
      const rect: Rect = {
        x: box.left - (shell?.left ?? 0),
        y: box.top - (shell?.top ?? 0),
        w: box.width,
        h: box.height,
      }
      clearPress()
      pressTimer = window.setTimeout(() => {
        pressFired = true
        pressTimer = null
        haptic('medium')
        onLong(rect, el)
      }, 420)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (pressTimer != null && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) clearPress()
    },
    onPointerUp: () => {
      const pending = pressTimer != null
      clearPress()
      if (pending && !pressFired) onTap()
    },
    onPointerCancel: clearPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
