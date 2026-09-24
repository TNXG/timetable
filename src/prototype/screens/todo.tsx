import React from 'react'
import { C, Phone, Nav } from '../shared'

/* ---------------- 07 todo ---------------- */

export type Todo = {
  title: string
  course: string
  color: string
  meta: string
  left: string
  kind?: 'exam'
  done?: boolean
  urgent?: boolean
}

export const todoGroups: [string, string, Todo[]][] = [
  ['今天', '2 项', [
    { title: '习题册 P41–P45 曲面积分', course: '高等数学（下）', color: C.math, meta: '今晚 23:00 截止', left: '还剩 11 小时', urgent: true },
    { title: '实验报告：单摆测重力加速度', course: '大学物理', color: C.phy, meta: '课上交，14:00', left: '带纸质版' },
  ]],
  ['这周', '3 项', [
    { title: '期中考试 覆盖 1–5 章', course: '线性代数', color: C.la, meta: '10月17日 周五 14:00', left: '3 天后', kind: 'exam' },
    { title: '第 4 次上机：红黑树插入', course: '数据结构', color: C.ds, meta: '10月18日 周六 23:59', left: '4 天后' },
    { title: '背完 Unit 6 词表', course: '大学英语（三）', color: C.eng, meta: '本周内', left: '已完成 60%' },
  ]],
  ['已完成', '', [
    { title: '第 3 次上机：哈希表', course: '数据结构', color: C.ds, meta: '10月11日 提交', left: '', done: true },
  ]],
]

export function TodoScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">待办</h1>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>本周 5 项</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>1 项今天到期</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span className="text-(--c-ink4)">已完成 4 项</span>
          </div>
        </div>

        <div className="mt-6 px-5">
          {todoGroups.map(([g, count, list]) => (
            <div key={g} className="mb-5">
              <div className="flex items-baseline justify-between px-0.5">
                <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink)">{g}</span>
                {count && <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">{count}</span>}
              </div>
              <div className="mt-2.5 space-y-2">
                {list.map((t) => (
                  <div key={t.title} className={`flex overflow-hidden rounded-[14px] bg-(--c-surface) px-3.5 py-3 ${t.done ? 'opacity-45' : ''}`}>
                    <div className="mt-[3px] mr-3 flex-none">
                      <span
                        className="flex h-[17px] w-[17px] items-center justify-center rounded-[6px] border-[1.8px]"
                        style={{ borderColor: t.done ? t.color : 'var(--c-radio-border)', background: t.done ? t.color : 'transparent' }}
                      >
                        {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <span className={`text-[14px] leading-[1.3] font-bold tracking-[-.01em] text-(--c-ink) ${t.done ? 'line-through' : ''}`}>{t.title}</span>
                        {t.kind === 'exam' && <span className="ml-2 flex-none rounded-[6px] bg-(--c-rose-soft) px-1.5 py-[2px] text-[10px] font-bold text-(--c-rose)">考试</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <i className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: t.color }} />
                        <span className="text-[11.5px] font-semibold text-(--c-ink3)">{t.course}</span>
                        <span className="text-[11.5px] font-medium tabular-nums text-(--c-ink4)">{t.meta}</span>
                      </div>
                      {t.left && (
                        <div className={`mt-1.5 text-[11.5px] font-bold tabular-nums ${t.urgent ? 'text-(--c-rose)' : 'text-(--c-ink3)'}`}>{t.left}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-[150px]"
        style={{ background: 'var(--c-fade)' }}
      />
      <Nav active={2} />
    </Phone>
  )
}
