import React from 'react'
import { C, Phone, Nav, dockStyle, CameraIcon, Board } from '../shared'

/* ---------------- 07b todo v2：先记下，再整理 ---------------- */


export const ArrowUp = ({ stroke = '#fff' }: { stroke?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
)

/* 板书：相机取景、照片缩略图共用一块假图 */

export type Todo2 = {
  title: string
  course: string
  color: string
  due: string
  left?: string
  leftTone?: 'rose' | 'ink'
  exam?: boolean
  photo?: boolean
  suggest?: string
}

export const todo2Groups: [string, Todo2[]][] = [
  ['待整理', [
    { title: '板书', course: '大学英语（三）', color: C.eng, due: '09:38 拍下', photo: true, suggest: '下次课前，周四 08:00' },
  ]],
  ['今天', [
    { title: '习题册 P41–P45 第 3、5、7 题', course: '高等数学（下）', color: C.math, due: '今晚 23:00', left: '还剩 11 小时', leftTone: 'rose', photo: true },
    { title: '实验报告：单摆测重力加速度', course: '大学物理', color: C.phy, due: '课上交 14:00', left: '带纸质版' },
  ]],
  ['这周', [
    { title: '期中考试 1–5 章', course: '线性代数', color: C.la, due: '周五 14:00', left: '3 天后', exam: true },
    { title: '第 4 次上机：红黑树插入', course: '数据结构', color: C.ds, due: '周六 23:59', photo: true },
    { title: '背完 Unit 6 词表', course: '大学英语（三）', color: C.eng, due: '周日' },
  ]],
]

export function Todo2Row({ t }: { t: Todo2 }) {
  return (
    <div className="flex items-start rounded-[14px] bg-(--c-surface) px-3.5 py-3">
      <span className="mt-[2px] h-[17px] w-[17px] flex-none rounded-[6px] border-[1.6px] border-(--c-ink5)" />
      <div className="ml-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-[14px] font-bold tracking-[-.01em] ${t.suggest ? 'text-(--c-ink3)' : 'text-(--c-ink)'}`}>{t.title}</span>
          {t.exam && <span className="flex-none rounded-[5px] bg-(--c-rose-soft) px-1.5 py-[2px] text-[10px] font-extrabold text-(--c-rose)">考试</span>}
        </div>
        <div className="mt-[5px] flex items-center gap-1.5 text-[12px] font-medium text-(--c-ink4)">
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: t.color }} />
          <span className="truncate">{t.course}</span>
          <span className="flex-none tabular-nums text-(--c-ink3)">· {t.due}</span>
        </div>
        {t.left && (
          <div className={`mt-1 text-[12px] font-semibold tabular-nums ${t.leftTone === 'rose' ? 'text-(--c-rose)' : 'text-(--c-ink3)'}`}>{t.left}</div>
        )}
        {t.suggest && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-(--c-accent-soft) px-2.5 py-[5px] text-[11.5px] font-bold text-(--c-accent)">
            {t.suggest}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 5 7 7-7 7" /></svg>
          </div>
        )}
      </div>
      {t.photo && <Board className="ml-3 h-[56px] w-[56px] flex-none rounded-[10px]" zoom={0.2} />}
    </div>
  )
}

export function Todo2List() {
  return (
    <div className="flex-1 overflow-hidden pt-12">
      <div className="px-5">
        <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">待办</h1>
        <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
          <span>今天 2 项</span>
          <span className="h-3 w-px bg-(--c-line)" />
          <span>这周 3 项</span>
          <span className="h-3 w-px bg-(--c-line)" />
          <span className="text-(--c-ink4)">1 项待整理</span>
        </div>
      </div>
      <div className="mt-6 px-5">
        {todo2Groups.map(([g, list]) => (
          <div key={g} className="mb-5">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink)">{g}</span>
              <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">{list.length} 项</span>
            </div>
            <div className="mt-2.5 space-y-2">{list.map((t) => <Todo2Row key={t.title + t.course} t={t} />)}</div>
          </div>
        ))}
        <div className="flex items-center justify-between px-0.5 py-1">
          <span className="text-[13px] font-extrabold tracking-[-.01em] text-(--c-ink4)">已完成 4 项</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4"><path d="m9 5 7 7-7 7" /></svg>
        </div>
      </div>
    </div>
  )
}

/* 底部胶囊：相机 + 一句话，压在 Nav 上面 */
export function Composer() {
  return (
    <div className="absolute inset-x-4 bottom-[92px] z-[9]">
      <div className="flex items-center gap-2 rounded-full p-[6px] pr-3.5" style={dockStyle}>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-(--c-surface2)"><CameraIcon /></span>
        <span className="flex-1 pl-1 text-[15px] font-medium text-(--c-ink4)">新待办</span>
      </div>
    </div>
  )
}

export function Todo2Screen() {
  return (
    <Phone>
      <Todo2List />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-[190px]" style={{ background: 'var(--c-fade)' }} />
      <Composer />
      <Nav active={2} />
    </Phone>
  )
}

/* iOS 风格键盘占位 */
export function Keyboard() {
  const Key = ({ w = 32, dark, children }: { w?: number; dark?: boolean; children?: React.ReactNode }) => (
    <span
      className={`flex h-[42px] items-center justify-center rounded-[6px] text-[16px] font-medium text-(--c-ink) ${dark ? 'bg-[#ACB1BA]' : 'bg-white'}`}
      style={{ width: w, boxShadow: '0 1px 0 rgba(0,0,0,.25)' }}
    >{children}</span>
  )
  return (
    <div className="absolute inset-x-0 bottom-0 z-[8] bg-[#D1D4DA] px-[3px] pt-2 pb-[38px]">
      <div className="flex justify-center gap-[6px]">{'qwertyuiop'.split('').map((k) => <Key key={k}>{k}</Key>)}</div>
      <div className="mt-[11px] flex justify-center gap-[6px]">{'asdfghjkl'.split('').map((k) => <Key key={k}>{k}</Key>)}</div>
      <div className="mt-[11px] flex justify-center gap-[6px]">
        <Key w={42} dark>⇧</Key>
        {'zxcvbnm'.split('').map((k) => <Key key={k}>{k}</Key>)}
        <Key w={42} dark>⌫</Key>
      </div>
      <div className="mt-[11px] flex justify-center gap-[6px]">
        <Key w={90} dark><span className="text-[14px]">123</span></Key>
        <Key w={182}><span className="text-[14px]">空格</span></Key>
        <Key w={90} dark><span className="text-[14px]">换行</span></Key>
      </div>
      <div className="mx-auto mt-4 h-[5px] w-[134px] rounded-full bg-(--c-ink)/85" />
    </div>
  )
}

export function Chip2({ color, children, tone = 'plain' }: { color?: string; children: React.ReactNode; tone?: 'plain' | 'accent' }) {
  return (
    <span className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold ${tone === 'accent' ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-surface2) text-(--c-ink2)'}`}>
      {color && <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />}
      {children}
    </span>
  )
}

/* 点开胶囊：键盘顶上来，胶囊展开成一段话 + 默认带上的课程/截止 */
export function Todo2ComposeScreen() {
  return (
    <Phone>
      <Todo2List />
      <div className="absolute inset-0 z-[7] bg-(--c-bg)/55" />
      <div className="absolute inset-x-3 bottom-[288px] z-[9]">
        <div className="rounded-[26px] px-4 pt-3.5 pb-3" style={dockStyle}>
          <div className="text-[16px] leading-[1.4] font-semibold tracking-[-.01em] text-(--c-ink)">
            习题册 P41–P45 第 3、5、7 题
            <span className="ml-[1px] inline-block h-[19px] w-[2px] translate-y-[4px] rounded-full bg-(--c-accent)" />
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-(--c-surface2)"><CameraIcon size={16} stroke="var(--c-ink2)" /></span>
            <Chip2 color={C.math}>高等数学（下）</Chip2>
            <Chip2>周四 课前</Chip2>
            <span className="flex-1" />
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-(--c-accent)"><ArrowUp /></span>
          </div>
        </div>
      </div>
      <Keyboard />
    </Phone>
  )
}

/* 相机：黑底、取景框、圆快门；课程默认带上，顶部可换 */
