import React from 'react'
import type { Course } from '../shared'
import { C, Phone, Nav, days, todayIndex, CourseRow, CameraIcon, Board, EmptyBlock } from '../shared'
import { Chip2 } from './todo2'

export function Todo2CameraScreen() {
  return (
    <Phone>
      <div className="absolute inset-0 bg-black" />
      <div className="relative flex flex-1 flex-col pt-12">
        <div className="flex items-center justify-between px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-bold text-white">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: C.math }} />
            高等数学（下）
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </span>
        </div>

        <div className="relative mx-2 mt-4 flex-1 overflow-hidden rounded-[24px]">
          <Board className="h-full w-full" zoom={0.9} tilt top={150} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.25), transparent 30%, transparent 75%, rgba(0,0,0,.35))' }} />
          {['left-5 top-5 border-l-2 border-t-2 rounded-tl-[8px]', 'right-5 top-5 border-r-2 border-t-2 rounded-tr-[8px]', 'left-5 bottom-5 border-l-2 border-b-2 rounded-bl-[8px]', 'right-5 bottom-5 border-r-2 border-b-2 rounded-br-[8px]'].map((c) => (
            <span key={c} className={`absolute h-6 w-6 border-white/80 ${c}`} />
          ))}
        </div>

        <div className="flex items-center justify-between px-9 pt-6 pb-10">
          <Board className="h-[46px] w-[46px] rounded-[12px] ring-2 ring-white/25" zoom={0.17} />
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3.5px] border-white">
            <span className="h-[62px] w-[62px] rounded-full bg-white" />
          </span>
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white/12">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" /><path d="M4 20v-5h5M20 4v5h-5" /></svg>
          </span>
        </div>
      </div>
    </Phone>
  )
}

/* 相册：黑底网格、多选、底部添加 */
export function Todo2PickerScreen() {
  const tiles: ('board' | 'board2' | 'paper' | 'desk' | 'screen' | 'dark')[] = [
    'board', 'paper', 'board2',
    'screen', 'desk', 'paper',
    'board2', 'dark', 'screen',
    'paper', 'board', 'desk',
    'screen', 'paper', 'board2',
  ]
  const selected: Record<number, number> = { 0: 1, 2: 2 }
  const bg: Record<string, string> = {
    paper: 'repeating-linear-gradient(180deg, #F4F1EA 0 22px, #D9D4C8 22px 23px)',
    desk: 'linear-gradient(150deg,#C9B49A,#8E7658)',
    screen: 'linear-gradient(180deg,#FFFFFF,#ECEDF1)',
    dark: 'linear-gradient(180deg,#2A2E38,#12141A)',
  }
  return (
    <Phone>
      <div className="absolute inset-0 bg-black" />
      <div className="relative flex flex-1 flex-col pt-12">
        <div className="flex items-center justify-between px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-bold text-white">
            最近项目
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
          </span>
          <span className="w-9" />
        </div>

        <div className="mt-4 grid flex-1 grid-cols-3 gap-[3px] overflow-hidden px-[3px] content-start">
          {tiles.map((k, i) => {
            const n = selected[i]
            return (
              <div key={i} className="relative aspect-square overflow-hidden rounded-[6px]">
                {k === 'board' || k === 'board2'
                  ? <Board className="h-full w-full" zoom={0.3} tilt={k === 'board2'} top={k === 'board2' ? -20 : 0} />
                  : <div className="h-full w-full" style={{ background: bg[k] }} />}
                {k === 'screen' && <div className="absolute inset-x-3 top-4 space-y-2"><div className="h-2 w-2/3 rounded bg-[#1B1C20]/80" /><div className="h-1.5 w-full rounded bg-[#1B1C20]/25" /><div className="h-1.5 w-5/6 rounded bg-[#1B1C20]/25" /><div className="h-1.5 w-1/2 rounded bg-[#1B1C20]/25" /></div>}
                {n
                  ? <span className="absolute inset-0 rounded-[6px] ring-[2.5px] ring-inset ring-(--c-accent)" style={{ background: 'rgba(79,91,213,.18)' }} />
                  : <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full border-[1.5px] border-white/80" style={{ background: 'rgba(0,0,0,.25)' }} />}
                {n && <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--c-accent) text-[11px] font-extrabold text-white">{n}</span>}
              </div>
            )
          })}
        </div>

        <div className="px-5 pt-3 pb-8">
          <div className="rounded-[16px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">添加 2 张</div>
        </div>
      </div>
    </Phone>
  )
}

export function BackCircle() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
    </div>
  )
}

/* 拍完：一张图 + 默认带上的东西，一下保存 */
export function Todo2ReviewScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col overflow-hidden px-5 pt-12">
        <div className="flex items-center justify-between">
          <BackCircle />
          <span className="flex h-9 items-center rounded-full bg-(--c-surface) px-4 text-[13px] font-bold text-(--c-ink)">重拍</span>
        </div>

        <div className="relative mt-4 h-[250px] overflow-hidden rounded-[20px]">
          <Board className="h-full w-full" zoom={0.8} tilt />
        </div>

        <div className="mt-5 text-[17px] font-semibold text-(--c-ink5)">名称</div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip2 color={C.math}>高等数学（下）</Chip2>
          <Chip2>周四 08:00 课前</Chip2>
          <Chip2>作业</Chip2>
          <Chip2 tone="accent">＋</Chip2>
        </div>


        <div className="flex-1" />
        <div className="pb-8">
          <div className="rounded-[16px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">保存</div>
        </div>
      </div>
    </Phone>
  )
}

/* 详情：标题 + 照片 + 几个胶囊，没有表单 */
export function Todo2DetailScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col overflow-hidden px-5 pt-12">
        <div className="flex items-center justify-between">
          <BackCircle />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--c-ink)"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </div>
        </div>

        <h1 className="mt-5 text-[22px] leading-[1.3] font-extrabold tracking-[-.02em] text-(--c-ink)">习题册 P41–P45 第 3、5、7 题</h1>

        <div className="mt-4 flex gap-2.5">
          <Board className="h-[76px] w-[102px] rounded-[12px]" zoom={0.3} />
          <Board className="h-[76px] w-[102px] rounded-[12px]" zoom={0.26} tilt />
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-(--c-ink5)"><CameraIcon stroke="var(--c-ink4)" /></span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip2 color={C.math}>高等数学（下）</Chip2>
          <Chip2>今晚 23:00</Chip2>
          <Chip2>作业</Chip2>
          <Chip2>前一晚 21:00 提醒</Chip2>
          <Chip2 tone="accent">＋</Chip2>
        </div>

        <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="text-[14px] leading-[1.5] font-medium text-(--c-ink)">第 7 题要用高斯公式，带上上次的习题册。</div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <span className="h-[17px] w-[17px] flex-none rounded-[6px] border-[1.6px] border-(--c-ink5)" />
          <span className="text-[14px] font-bold text-(--c-ink)">完成</span>
        </div>
      </div>
    </Phone>
  )
}

/* 空状态：两个圆形按钮，拍照为主 */
export function Todo2EmptyScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col overflow-hidden pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">待办</h1>
        </div>
        <div className="flex flex-1 flex-col justify-center pb-24">
          <EmptyBlock
            kind="todo"
            title="没有待办"
            desc="作业、考试与日常备忘。在这里随手记下，件件有着落。"
            actions={['拍板书', '文字']}
            icons={[<CameraIcon key="c" size={15} stroke="#fff" />]}
          />
        </div>
      </div>
      <Nav active={2} />
    </Phone>
  )
}

/* 下课那一刻：今天页时间线里，刚结束的课下面直接给出入口 */
export function Todo2ClassEndScreen() {
  const list = days[todayIndex].courses.map((c): Course => (
    c.name === '高等数学（下）' ? { ...c, state: 'past' } : c
  ))
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">10月14日 <span className="font-bold text-(--c-ink4)">周二</span></h1>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>第 7 周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>单周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>4 节课<span className="text-(--c-ink4)">，剩 2 节</span></span>
          </div>
        </div>

        <div className="mt-6 px-5">
          {list.map((c) => (
            <React.Fragment key={c.name + c.start}>
              <CourseRow c={c} />
              {c.name === '高等数学（下）' && (
                <div className="-mt-4 flex">
                  <div className="w-11 flex-none" />
                  <div className="ml-3 w-[2px] flex-none self-stretch bg-(--c-accent)" />
                  <div className="flex-1 pb-7 pl-4">
                    <div className="rounded-[16px] bg-(--c-surface) p-3.5">
                      <div className="text-[14px] font-bold tracking-[-.01em] text-(--c-ink)">刚下课，这节课有作业吗？</div>
                      <div className="mt-2.5 flex gap-1.5">
                        <span className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full bg-(--c-ink) text-[12.5px] font-bold text-(--c-bg)"><CameraIcon size={15} stroke="var(--c-bg)" />拍板书</span>
                        <span className="flex h-[34px] flex-1 items-center justify-center rounded-full bg-(--c-surface2) text-[12.5px] font-bold text-(--c-ink)">文字</span>
                        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-(--c-surface2)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink3)" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-[150px]" style={{ background: 'var(--c-fade)' }} />
      <Nav active={0} />
    </Phone>
  )
}
