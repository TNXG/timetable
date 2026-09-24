import React from 'react'

/* 动画参数：与 lexicon 一致 */
export const SPRING = { type: 'spring', bounce: 0.2, duration: 0.6 } as const
export const SLIDE = { type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.4 } as const
export const SHEET = { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.3 } as const
export const FADE = { duration: 0.2 } as const
/* 长按抬起/落下：进出走同一条曲线，阴影跟着一起消 */
export const LIFT = { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.24 } as const

/* 与原型一致的视觉基元 */

export const dockStyle: React.CSSProperties = {
  background: 'var(--c-dock)',
  border: '1px solid var(--c-dock-line)',
  boxShadow: 'var(--c-dock-shadow)',
}

export function tint(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, var(--c-surface))`
}

export const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const WD_SHORT = ['', '一', '二', '三', '四', '五', '六', '日']
export const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`
