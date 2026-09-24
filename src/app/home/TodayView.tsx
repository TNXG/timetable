/** 今天：跨日连续时间线 + 底部日期条；轻点进详情，长按弹快捷菜单 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Occurrence } from '../../domain/types'
import { addDays, fmtDuration, fmtMinutes, inVacation, weekOf, weekdayOf } from '../../domain/dates'
import { firstClassDate, occurrencesOn, type Snapshot } from '../../domain/engine'
import { justEndedClass } from '../../domain/next-class'
import { stickerOfOcc } from '../../domain/stickers'
import { ClassEndCard } from '../todo'
import { Sticker } from '../Sticker'
import { pressProps } from './press'
import { BackPill, BottomVeil, EmptyBlock, SearchButton, StickyHead, SPRING, WD, dockStyle, md, type Rect } from '../ui'
import { mondayOf, termEnd, todayStr } from '../semester'
import { useNowMinutes, useToday } from './hooks'
import { CalendarSheet } from './calendar'
import { DateStrip } from './DateStrip'



export function TodayView({
  snap, anchor, setAnchor, onPick, onMenu, onSearch, onImport, onManual, onSemester, onNewSemester, onCapture, liftKey,
}: {
  snap: Snapshot
  anchor: string
  setAnchor: (d: string) => void
  onPick: (o: Occurrence) => void
  onMenu: (o: Occurrence, r: Rect, el: HTMLElement) => void
  onSearch: () => void
  onImport: () => void
  onManual: () => void
  onSemester: () => void
  onNewSemester: () => void
  onCapture: (kind: 'camera' | 'text', courseId?: string) => void
  liftKey?: string
}) {
  const today = useToday()
  const now = useNowMinutes()
  const [cal, setCal] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /* 底部日期条跟随滚动位置：滚到「明天」那段时选中项切到明天 */
  const [view, setView] = useState(anchor)
  useEffect(() => setView(anchor), [anchor])
  /* 某一天的段落在滚动容器里的顶部偏移（标题区下方对齐） */
  const dayTop = (sc: HTMLElement, el: HTMLElement) => {
    const headH = (sc.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0
    return el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - headH
  }
  const gliding = useRef(0)
  const onScroll = () => {
    const sc = scrollRef.current
    if (!sc) return
    if (gliding.current) {
      window.clearTimeout(gliding.current)
      gliding.current = window.setTimeout(() => { gliding.current = 0 }, 120)
      return
    }
    let cur = anchor
    if (sc.scrollTop > 4) {
      const line = sc.scrollTop + Math.min(sc.clientHeight * 0.3, 120)
      for (const el of Array.from(sc.querySelectorAll<HTMLElement>('[data-day]'))) {
        if (dayTop(sc, el) <= line) cur = el.dataset.day!
        else break
      }
    }
    setView(cur)
  }
  /* 点日期条：目标日已在时间线里就滚过去，不重建列表；不在才换锁定日 */
  const pickDay = (d: string) => {
    const sc = scrollRef.current
    const el = sc?.querySelector<HTMLElement>(`[data-day="${d}"]`)
    if (sc && el) {
      setView(d)
      gliding.current = window.setTimeout(() => { gliding.current = 0 }, 120)
      sc.scrollTo({ top: Math.max(0, dayTop(sc, el) - 8), behavior: 'smooth' })
    } else if (d === anchor) sc?.scrollTo({ top: 0, behavior: 'smooth' })
    else setAnchor(d)
  }

  const days = useMemo(() => {
    const out: { date: string; rel: string; occ: Occurrence[] }[] = []
    for (let i = 0; i < 14; i++) {
      const d = addDays(anchor, i)
      const occ = occurrencesOn(snap, d)
      const rel = d === today ? '今天' : d === addDays(today, 1) ? '明天' : d === addDays(today, 2) ? '后天' : WD[weekdayOf(d)]
      if (i === 0 || occ.length > 0) out.push({ date: d, rel, occ })
      if (out.reduce((n, x) => n + x.occ.length, 0) >= 14 && i >= 2) break
    }
    return out
  }, [snap, anchor, today])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [anchor])

  const week = weekOf(snap.semester, anchor)
  const vac = inVacation(snap.semester, anchor)
  const head = days[0]?.occ ?? []
  const remain = anchor === today ? head.filter((o) => o.end > now && o.status !== 'cancelled').length : head.length
  const inTerm = week >= 1 && week <= snap.semester.totalWeeks
  const nothingAtAll = snap.courses.length === 0 && snap.entries.length === 0
  /* 刚下课那一刻：时间线里那节课下面直接给出记录入口 */
  const ended = useMemo(() => justEndedClass(snap, today, now), [snap, today, now])
  const [endHidden, setEndHidden] = useState<string[]>([])
  const endKey = ended ? `${ended.date}-${ended.courseId}-${ended.start}` : ''
  const showEnd = ended && !endHidden.includes(endKey)
  const weekend = weekdayOf(anchor) >= 6
  const termEndDay = termEnd(snap.semester)
  /* 学期第一节课还在选中日之后：整个学期还没开课；两周内都没课且已过学期末：学期已结束 */
  const free = !nothingAtAll && head.length === 0
  const firstClass = useMemo(() => (free ? firstClassDate(snap, snap.semester.startDate) : null), [snap, free])
  const notStarted = free && firstClass != null && firstClass > anchor
  const idle = free && days.length === 1
  const afterTerm = idle && anchor > termEndDay && firstClassDate(snap, anchor) == null

  return (
    <>
      <div
        ref={(el) => { scrollRef.current = el }}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto pb-[210px] [scrollbar-width:none]"
      >
        <StickyHead bleed={0} className="px-5">
          <div className="flex items-start justify-between">
            <h1 className="text-[26px] font-extrabold tracking-[-.02em]">
              {md(anchor)} <span className="font-bold text-(--c-ink5)">{WD[weekdayOf(anchor)]}</span>
            </h1>
            <SearchButton onClick={onSearch} />
          </div>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            {inTerm ? <span>第 {week} 周</span> : <span>学期外</span>}
            {inTerm && (
              <>
                <span className="h-3 w-px bg-(--c-line)" />
                <span>{week % 2 === 1 ? '单周' : '双周'}</span>
              </>
            )}
            <span className="h-3 w-px bg-(--c-line)" />
            {head.length > 0 ? (
              <span>{head.length} 节课{anchor === today && <span className="text-(--c-ink5)">，剩 {remain} 节</span>}</span>
            ) : (
              <span className="text-(--c-ink5)">{nothingAtAll ? '暂无课表' : notStarted ? '暂未开课' : afterTerm ? '学期已结束' : '今天没有课'}</span>
            )}
          </div>
        </StickyHead>
        {vac && <div className="mx-5 mt-1 rounded-[16px] bg-(--c-surface) px-4 py-3 text-[13px] font-semibold text-[#9A7B3F]">{vac}</div>}

        {nothingAtAll ? (
          <div className="mt-16">
            <EmptyBlock
              kind="none"
              title="让课表就位"
              desc="一键导入，或是手动创建。随后的日程追踪与准时提醒，皆会为你准备就绪。"
              actions={[['导入课表', onImport], ['手动添加', onManual]]}
            />
          </div>
        ) : notStarted && idle ? (
          <div className="mt-14">
            <EmptyBlock
              kind="term"
              title="暂未开课"
              desc={`课程将于第 ${weekOf(snap.semester, firstClass)} 周（${md(firstClass)}）正式开启`}
              actions={[[`前往 ${md(firstClass)}`, () => setAnchor(firstClass)]]}
            />
          </div>
        ) : afterTerm ? (
          <div className="mt-14">
            <EmptyBlock
              kind="term"
              title="学期已结束"
              actions={[['开始新学期', onNewSemester], ['学期设置', onSemester]]}
            />
          </div>
        ) : head.length === 0 && days.length === 1 ? (
          <div className="mt-14">
            <EmptyBlock
              kind="free"
              title="今天没有课，好耶"
              desc={weekend ? '周末到了，不如去做点感兴趣的事，出去走走。' : '不如去做点感兴趣的事，出去走走。'}
              actions={[['手动添加', onManual]]}
            />
          </div>
        ) : (
          <div className="mt-6 px-5">
            {days.map((day, di) => {
              /* 今天里第一节还没开始的课：给出「下一节」提示，和原型一致 */
              const nextKey = day.date === today
                ? day.occ.find((x) => x.start > now && x.status !== 'cancelled')?.key
                : undefined
              const inClass = day.date === today && day.occ.some((x) => x.start <= now && now < x.end && x.status !== 'cancelled')
              return (
              <div key={day.date} data-day={day.date}>
                {day.occ.length > 0 && (
                  <div className="flex items-baseline justify-between pb-[22px]">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[17px] leading-none font-extrabold tracking-[-.02em]">{day.rel}</span>
                      <span className="text-[12.5px] font-semibold text-(--c-ink4)">{md(day.date)}{day.rel !== WD[weekdayOf(day.date)] ? ` ${WD[weekdayOf(day.date)]}` : ''}</span>
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums text-(--c-ink5)">{day.occ.length} 节课，{fmtMinutes(day.occ[0].start)} 开始</span>
                  </div>
                )}
                {day.occ.length === 0 && di === 0 && (
                  <div className="pb-7 text-[13.5px] font-semibold text-(--c-ink4)">{notStarted ? '暂未开课' : '无课程'}</div>
                )}
                {day.occ.map((o, oi) => {
                  const isLast = oi === day.occ.length - 1
                  const isToday = day.date === today
                  const past = (isToday && o.end <= now) || day.date < today
                  const nowOn = isToday && o.start <= now && now < o.end
                  const pct = ((now - o.start) / Math.max(1, o.end - o.start)) * 100
                  const sticker = stickerOfOcc(o, snap.courses)
                  return (
                    <Fragment key={o.key}>
                    <button
                      {...pressProps(() => onPick(o), (r, el) => onMenu(o, r, el))}
                      className={`flex w-full py-1.5 text-left transition-transform duration-150 ${liftKey === o.key ? '' : 'active:scale-[.985]'}`}
                    >
                      <div className={`w-11 flex-none pt-3.5 ${past ? 'opacity-50' : ''}`}>
                        <div className="text-[11px] font-bold text-(--c-ink2)">{o.startPeriod === o.endPeriod ? `${o.startPeriod}节` : `${o.startPeriod}–${o.endPeriod}节`}</div>
                        <div className="mt-1 text-[11px] font-medium tabular-nums text-(--c-ink4)">{fmtMinutes(o.start)}</div>
                        <div className="text-[11px] font-medium tabular-nums text-(--c-ink5)">{fmtMinutes(o.end)}</div>
                      </div>
                      {/* 时间轴在一天里贯穿，最后一节下方留出与日期标题下方等高的空白 */}
                      <div className={`-my-1.5 ml-3 w-[2px] flex-none self-stretch ${isLast ? 'pb-7' : ''}`}>
                        <div className="relative h-full bg-(--c-line)">
                          {past && <i className="absolute inset-0 bg-(--c-accent)" />}
                          {nowOn && (
                            <>
                              <i className="absolute inset-x-0 top-0 bg-(--c-accent)" style={{ height: `${pct}%` }} />
                              <i className="absolute left-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-(--c-accent) bg-(--c-surface)" style={{ top: `${pct}%` }} />
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`min-w-0 flex-1 pl-4 ${isLast ? 'pb-7' : ''} ${past || o.status === 'cancelled' ? 'opacity-50' : ''}`}>
                      {/* 每节课一张卡；右侧竖列放学科贴纸和状态标签，右边缘对齐，贴纸随卡片一起抬起 */}
                      <div data-lift className="relative rounded-[16px] bg-(--c-surface) px-4 py-3.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`text-[16px] leading-[1.25] font-bold tracking-[-.01em] ${o.status === 'cancelled' ? 'line-through' : ''}`}>{o.name}</div>
                            <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-(--c-ink3)">
                              <span className="min-w-0 truncate">{[o.location, o.teacher].filter(Boolean).join('，') || '—'}</span>
                              {o.conflict && <span className="flex-none rounded-[7px] bg-(--c-amber-soft) px-2 py-[3px] text-[10.5px] font-bold text-(--c-amber)">冲突</span>}
                              {o.status === 'moved' && <span className="flex-none rounded-[7px] bg-(--c-accent-soft) px-2 py-[3px] text-[10.5px] font-bold text-(--c-accent)">已调课</span>}
                              {o.status === 'cancelled' && <span className="flex-none rounded-[7px] bg-(--c-surface2) px-2 py-[3px] text-[10.5px] font-bold text-(--c-ink3)">停课</span>}
                              {o.status === 'leave' && <span className="flex-none rounded-[7px] bg-(--c-rose-soft) px-2 py-[3px] text-[10.5px] font-bold text-(--c-rose)">请假</span>}
                              {o.muted && o.status === 'normal' && !past && <span className="flex-none rounded-[7px] bg-(--c-surface2) px-2 py-[3px] text-[10.5px] font-bold text-(--c-ink3)">静音</span>}
                            </div>
                          </div>
                          {sticker && <Sticker id={sticker} size={24} tilt={-4} className="flex-none" />}
                        </div>
                        {nowOn && <div className="mt-1.5 text-[12px] font-bold tabular-nums text-(--c-accent)">上课中，现在 {fmtMinutes(now)}，还剩 {fmtDuration(o.end - now)}</div>}
                        {!nowOn && o.key === nextKey && (!inClass && o.start - now <= 60
                          ? <div className="mt-1.5 text-[12px] font-bold tabular-nums text-(--c-accent)">还有 {fmtDuration(o.start - now)}，{fmtMinutes(o.start)} 开始</div>
                          : <div className="mt-1.5 text-[12px] font-semibold tabular-nums text-(--c-ink3)">下一节，{fmtMinutes(o.start)} 开始</div>
                        )}
                      </div>
                      </div>
                    </button>
                    {showEnd && ended && day.date === ended.date && o.courseId === ended.courseId && o.start === ended.start && (
                      <ClassEndCard
                        moment={ended}
                        onCamera={() => onCapture('camera', ended.courseId)}
                        onText={() => onCapture('text', ended.courseId)}
                        onDismiss={() => setEndHidden((s) => [...s, endKey])}
                      />
                    )}
                    </Fragment>
                  )
                })}
              </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomVeil height={210} />
      <BackPill show={!cal && view !== today} label="回到今天" bottom="calc(152px + max(24px, env(safe-area-inset-bottom)))" onClick={() => (anchor === today ? pickDay(today) : setAnchor(today))} />
      <AnimatePresence initial={false}>
        {!cal && <DateStrip snap={snap} anchor={view} onPick={pickDay} onCalendar={() => setCal(true)} />}
      </AnimatePresence>
      {cal && <CalendarSheet snap={snap} mode="day" anchor={anchor} onPick={setAnchor} onClose={() => setCal(false)} />}
    </>
  )
}


