/** 周视图：节次网格（domain/time-axis）+ 横滑翻周；轻点进详情，长按弹快捷菜单 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import { flushSync } from 'react-dom'
import type { Occurrence } from '../../domain/types'
import { addDays, dateOf, fmtMinutes, weekOf, weekdayOf } from '../../domain/dates'
import { occurrencesInWeek, type Snapshot } from '../../domain/engine'
import { CARD_INSET, buildAxis, rowHeights } from '../../domain/time-axis'
import { stickerOfOcc } from '../../domain/stickers'
import { Sticker, stickerTilt } from '../Sticker'
import { WeekAxis, WeekCard, WeekLines } from '../week-axis'
import { clearPress, pressProps } from './press'
import { BackPill, SearchButton, StickyHead, SPRING, WD, type Rect } from '../ui'
import { useNowMinutes, useToday } from './hooks'
import { CalendarSheet } from './calendar'

/** 一周的日期条 + 节次网格（纵轴见 domain/time-axis）；左右滑时相邻周也各渲染一份 */
function WeekGrid({ snap, week, anchor, today, now, setAnchor, onPick, onMenu, liftKey, gridRef, onGeometry }: {
  snap: Snapshot
  week: number
  anchor: string
  today: string
  now: number
  setAnchor: (d: string) => void
  onPick: (o: Occurrence) => void
  onMenu: (o: Occurrence, r: Rect, el: HTMLElement) => void
  liftKey?: string
  gridRef?: React.MutableRefObject<HTMLDivElement | null>
  onGeometry?: (todayIdx: number, nowTop: number) => void
}) {
  const sem = snap.semester
  const byDay = useMemo(() => occurrencesInWeek(snap, week), [snap, week])
  const monday = dateOf(sem, week, 1)
  const days = [1, 2, 3, 4, 5, 6, 7].map((wd) => dateOf(sem, week, wd))
  const todayIdx = days.indexOf(today)

  /* 列宽决定卡片里文字折几行；首次按视口估，挂载后用真实宽度 */
  const [colW, setColW] = useState(() => (Math.min(window.innerWidth, 430) - 98) / 7)

  /* 轴的范围跟着真实课程走：节次之外的早课、晚自习按真实时长延伸，不会溢出；行高按这一行卡片实际需要的高度来 */
  const axis = useMemo(() => {
    const all = [...byDay.values()].flat()
    const span = all.length > 0 ? { start: Math.min(...all.map((o) => o.start)), end: Math.max(...all.map((o) => o.end)) } : undefined
    return buildAxis(sem.timeGrid, span, rowHeights(sem.timeGrid, all.map((o) => ({ start: o.start, end: o.end, name: o.name, loc: o.location })), colW))
  }, [sem.timeGrid, byDay, colW])
  const first = axis.segs[0]
  const last = axis.segs[axis.segs.length - 1]
  const gridH = axis.height + 8
  const nowTop = now >= first.t0 && now <= last.t1 ? axis.y(now) : 0
  useEffect(() => {
    onGeometry?.(todayIdx, nowTop)
  }, [todayIdx, nowTop, onGeometry])

  const gridEl = useRef<HTMLDivElement | null>(null)
  const setGridEl = useCallback((el: HTMLDivElement | null) => {
    gridEl.current = el
    if (gridRef) gridRef.current = el
  }, [gridRef])
  useEffect(() => {
    const el = gridEl.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const w = (e.contentRect.width - 6 * 5) / 7
      if (w > 0) setColW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <div className="flex items-stretch gap-[5px]">
        <div className="-mr-[5px] flex w-8 flex-none items-center justify-center text-[10.5px] font-semibold text-(--c-ink4)">
          {Number(monday.slice(5, 7))}月
        </div>
        {days.map((d) => {
          const on = d === anchor
          const isToday = d === today
          const n = (byDay.get(weekdayOf(d)) ?? []).length
          return (
            <button key={d} onClick={() => setAnchor(d)} className="relative flex flex-1 flex-col items-center py-[5px]">
              {on && <motion.i layoutId="week-strip-indicator" transition={SPRING} className="absolute inset-x-[-4px] inset-y-0 rounded-[13px] bg-(--c-accent-soft)" />}
              <span className={`relative z-10 flex h-[24px] w-[24px] items-center justify-center text-[17px] leading-none font-bold tabular-nums ${isToday || on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{Number(d.slice(8))}</span>
              <span className={`relative z-10 mt-0.5 text-[10.5px] font-semibold ${on || isToday ? 'text-(--c-accent)' : 'text-(--c-ink4)'}`}>{isToday ? '今天' : WD[weekdayOf(d)]}</span>
              {n > 0 && <span className={`absolute top-[3px] right-[2px] z-10 text-[9px] font-bold tabular-nums ${on ? 'text-(--c-accent2)' : 'text-(--c-ink5)'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="relative mt-2">
        <WeekLines axis={axis} />
        <div className="flex pt-1.5">
          <WeekAxis axis={axis} nowTop={todayIdx >= 0 && nowTop > 0 ? nowTop : undefined} nowLabel={fmtMinutes(now)} />
          <div ref={setGridEl} className="relative flex flex-1 gap-[5px]" style={{ height: gridH }}>
            {days.map((d, i) => {
              const occ = byDay.get(weekdayOf(d)) ?? []
              const pastCol = d < today
              return (
                <div key={d} className={`relative flex-1 ${pastCol ? 'opacity-45' : ''}`}>
                  {occ.map((o) => {
                    /* 冲突：同一时段的课按开始时间叠放，前一张在上，后一张右移露边，右上角标门数 */
                    const cluster = occ.filter((x) => x.start < o.end && o.start < x.end).sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))
                    const lane = cluster.indexOf(o)
                    const stacked = cluster.length > 1
                    const done = d < today || (d === today && o.end <= now)
                    const nowOn = d === today && o.start <= now && now < o.end
                    const lift = liftKey === o.key
                    const top = axis.y(o.start) + CARD_INSET
                    const cellH = axis.y(o.end) - top - CARD_INSET
                    const covered = lane > 0 ? Math.max(0, ...cluster.slice(0, lane).map((x) => axis.y(x.end) - CARD_INSET - top)) : 0
                    const ring = nowOn
                      ? `inset 0 0 0 1.5px ${o.color}`
                      : stacked || o.conflict
                        ? `inset 0 0 0 1.5px ${lane > 0 ? 'rgba(217,169,75,.55)' : '#D9A94B'}`
                        : undefined
                    const sticker = !stacked && cellH >= 44 ? stickerOfOcc(o, snap.courses) : null
                    return (
                      <div
                        key={o.key}
                        data-lift
                        className="absolute"
                        style={{
                          top,
                          height: cellH,
                          left: lane * 5,
                          right: -lane * 5,
                          zIndex: stacked ? 6 - lane : undefined,
                          opacity: done && !pastCol ? 0.55 : 1,
                        }}
                      >
                      <button
                        {...pressProps(() => onPick(o), (r, el) => onMenu(o, r, el))}
                        className={`block h-full w-full transition-transform duration-150 ${lift ? '' : 'active:scale-[.97]'}`}
                      >
                        <WeekCard
                          name={o.name}
                          loc={o.location}
                          color={o.color}
                          h={cellH}
                          w={colW}
                          now={nowOn}
                          done={done}
                          progress={nowOn ? axis.y(now) - top : undefined}
                          sticker={sticker}
                          status={o.status}
                          muted={o.muted && !done}
                          ring={ring}
                          textTop={Math.min(covered, cellH)}
                          tone={stacked && !nowOn ? 14 : undefined}
                        />
                      </button>
                      {stacked && lane === 0 && (
                        <span className="pointer-events-none absolute top-[-5px] right-[-6px] z-10 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#D9A94B] text-[8.5px] leading-none font-bold text-white ring-[2px] ring-(--c-bg)">
                          {cluster.length}
                        </span>
                      )}
                      {sticker && (
                        <Sticker
                          id={sticker}
                          size={20}
                          tilt={stickerTilt(o.name)}
                          className="pointer-events-none absolute -right-1.5 -bottom-1.5 z-10"
                        />
                      )}
                      </div>
                    )
                  })}
                  {i === todayIdx && nowTop > 0 && (
                    <div className="pointer-events-none absolute right-[-2px] left-[-2px] z-20" style={{ top: nowTop }}>
                      <i className="block h-[1.5px] w-full rounded-full bg-(--c-accent)" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

/* 横滑翻周：方向锁定后手指跟随，松手按位移/速度吸附到相邻周 */
const SWIPE_LOCK = 8
const SWIPE_RATIO = 0.3
const SWIPE_VELOCITY = 0.5
const SWIPE_EASE = [0.25, 1, 0.5, 1] as const

export function WeekView({ snap, anchor, setAnchor, onPick, onMenu, onSearch, liftKey }: { snap: Snapshot; anchor: string; setAnchor: (d: string) => void; onPick: (o: Occurrence) => void; onMenu: (o: Occurrence, r: Rect, el: HTMLElement) => void; onSearch: () => void; liftKey?: string }) {
  const sem = snap.semester
  const today = useToday()
  const [cal, setCal] = useState(false)
  const week = Math.min(Math.max(weekOf(sem, anchor), 1), sem.totalWeeks)
  const thisWeek = Math.min(Math.max(weekOf(sem, today), 1), sem.totalWeeks)
  const now = useNowMinutes()
  const monday = dateOf(sem, week, 1)

  /* 首次进入且本周含今天：滚到当前时刻附近 */
  const scroller = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  const onGeometry = useCallback((todayIdx: number, nowTop: number) => {
    const sc = scroller.current
    const grid = gridRef.current
    if (scrolled.current || !sc || !grid || todayIdx < 0 || nowTop <= 0) return
    scrolled.current = true
    const gridTop = grid.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
    const target = gridTop + nowTop - sc.clientHeight * 0.4
    if (target > 0) sc.scrollTop = target
  }, [])

  /* 换周时整块网格按方向平移；横滑翻过来的那次已经滑到位，不再播 */
  const seen = useRef(week)
  const swiped = useRef(false)
  const [dir, setDir] = useState(0)
  useEffect(() => {
    if (seen.current !== week) {
      setDir(week > seen.current ? 1 : -1)
      seen.current = week
    }
    swiped.current = false
  }, [week])

  const x = useMotionValue(0)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x0: number; y0: number; w: number; state: 'pending' | 'drag' | 'off'; last: number; t: number; v: number } | null>(null)

  const settle = (delta: -1 | 0 | 1, from: number, w: number) => {
    const to = -delta * w
    const dist = Math.abs(to - from)
    animate(x, to, { type: 'tween', ease: SWIPE_EASE, duration: Math.min(0.4, Math.max(0.2, dist / w * 0.4)) }).then(() => {
      if (!delta) return
      swiped.current = true
      x.jump(0)
      flushSync(() => setAnchor(addDays(monday, delta * 7)))
    })
  }

  const onDown = (e: React.PointerEvent) => {
    if (drag.current?.state === 'drag') return
    const pane = box.current
    if (!pane) return
    drag.current = { x0: e.clientX, y0: e.clientY, w: pane.clientWidth - 12, state: 'pending', last: 0, t: e.timeStamp, v: 0 }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.state === 'off') return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (d.state === 'pending') {
      if (Math.abs(dy) > SWIPE_LOCK && Math.abs(dy) >= Math.abs(dx)) {
        d.state = 'off'
        return
      }
      if (Math.abs(dx) <= SWIPE_LOCK) return
      d.state = 'drag'
      clearPress()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    const dt = e.timeStamp - d.t
    if (dt > 0) d.v = (dx - d.last) / dt
    d.last = dx
    d.t = e.timeStamp
    const blocked = (dx > 0 && week <= 1) || (dx < 0 && week >= sem.totalWeeks)
    x.set(blocked ? dx * 0.25 : dx)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.state !== 'drag') return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    const dx = d.last
    let delta: -1 | 0 | 1 = 0
    if (dx < -d.w * SWIPE_RATIO || (dx < 0 && d.v < -SWIPE_VELOCITY)) delta = 1
    else if (dx > d.w * SWIPE_RATIO || (dx > 0 && d.v > SWIPE_VELOCITY)) delta = -1
    if ((delta === 1 && week >= sem.totalWeeks) || (delta === -1 && week <= 1)) delta = 0
    settle(delta, x.get(), d.w)
  }

  const panes = [week - 1, week, week + 1]

  return (
    <>
      <div ref={scroller} className="flex-1 overflow-y-auto pb-[130px] [scrollbar-width:none]">
        <StickyHead className="px-5">
          <div className="flex items-center justify-between">
          <button onClick={() => setCal(true)} className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em]">
            第 {week} 周
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink4)' }} strokeWidth="2.6" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-[12.5px] font-semibold text-(--c-ink3)">{week % 2 === 1 ? '单周' : '双周'}</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span className="text-[12.5px] font-semibold text-(--c-ink3)">{sem.name}</span>
            <SearchButton onClick={onSearch} />
          </div>
          </div>
        </StickyHead>

        <div className="mt-1 px-2">
          <div
            ref={box}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="overflow-hidden rounded-[22px] bg-(--c-surface) px-1.5 pt-2.5 pb-4 [touch-action:pan-y]"
          >
            {/* 相邻周在这层裁掉：每周自带 4px 内边，选中标记外扩的 4px 不被切 */}
            <motion.div
              key={week}
              initial={swiped.current ? false : { opacity: 0, transform: `translateX(${dir * 28}px)` }}
              animate={{ opacity: 1, transform: 'translateX(0px)' }}
              transition={{ type: 'tween', ease: SWIPE_EASE, duration: 0.22 }}
              className="-mx-1 overflow-hidden px-1"
            >
              <motion.div className="flex w-[300%] -ml-[100%] items-start" style={{ x }}>
                {panes.map((w) => (
                  <div key={w} className="w-1/3 flex-none px-1">
                    {w >= 1 && w <= sem.totalWeeks && (
                      <WeekGrid
                        snap={snap}
                        week={w}
                        anchor={anchor}
                        today={today}
                        now={now}
                        setAnchor={setAnchor}
                        onPick={onPick}
                        onMenu={onMenu}
                        liftKey={liftKey}
                        gridRef={w === week ? gridRef : undefined}
                        onGeometry={w === week ? onGeometry : undefined}
                      />
                    )}
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
      <BackPill show={!cal && week !== thisWeek} label="回到本周" bottom="calc(80px + max(24px, env(safe-area-inset-bottom)))" onClick={() => setAnchor(today)} />
      {cal && <CalendarSheet snap={snap} mode="week" anchor={anchor} onPick={setAnchor} onClose={() => setCal(false)} />}
    </>
  )
}
