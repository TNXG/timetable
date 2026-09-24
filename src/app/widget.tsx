/** 桌面小组件：四种样式的实时预览，点一下加到桌面 */
import { useEffect, useMemo, useState } from 'react'
import type { WidgetStyle } from '../domain/types'
import type { Snapshot } from '../domain/engine'
import { addDays, dateOf, fmtMinutes, weekOf } from '../domain/dates'
import { occurrencesOn } from '../domain/engine'
import { store, useStore } from './store'
import { addWidgetToHome, syncWidgets, widgetPinSupported } from './widgets'
import { BackButton, Page, StickyHead, WD, tint } from './ui'
import { todayStr } from './semester'

function WCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[24px] bg-(--c-surface) p-3.5 shadow-[0_6px_20px_rgba(0,0,0,.10)] ${className}`}>{children}</div>
}

function WHead({ d, w, sub }: { d: string; w: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[30px] leading-none font-semibold tracking-[-.03em] tabular-nums text-(--c-ink)">{d}</span>
      <span className="text-[13px] font-semibold text-(--c-accent)">{w}</span>
      {sub && <span className="ml-auto text-[11.5px] font-semibold text-(--c-ink4)">{sub}</span>}
    </div>
  )
}

function WRow({ name, time, loc, color, big = true }: { name: string; time?: string; loc?: string; color: string; big?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] py-1.5 pr-2.5 pl-0" style={{ background: tint(color, 8) }}>
      <i className="my-[3px] ml-1.5 w-[3px] flex-none self-stretch rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${big ? 'text-[13px]' : 'text-[12px]'} leading-[1.3] font-bold tracking-[-.01em] text-(--c-ink)`}>{name}</div>
        {loc && <div className="mt-[1px] truncate text-[11px] leading-[1.25] font-medium text-(--c-ink3)">{loc}</div>}
      </div>
      {time && <div className="flex-none text-right text-[11.5px] leading-[1.3] font-semibold tabular-nums text-(--c-ink3)">{time}</div>}
    </div>
  )
}


function Pick({ style, onAdd, children, className = '' }: { style: WidgetStyle; onAdd: (s: WidgetStyle) => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={() => onAdd(style)} className={`text-left transition-transform active:scale-[.985] ${className}`}>
      {children}
    </button>
  )
}

export function WidgetPage({ snap, onBack }: { snap: Snapshot; onBack: () => void }) {
  const state = useStore()
  const [pinnable, setPinnable] = useState(false)

  useEffect(() => {
    void widgetPinSupported().then(setPinnable)
    void syncWidgets()
  }, [])

  const today = todayStr()
  const tomorrow = addDays(today, 1)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const list = useMemo(() => occurrencesOn(snap, today).filter((o) => o.status !== 'cancelled'), [snap, today])
  const tlist = useMemo(() => occurrencesOn(snap, tomorrow).filter((o) => o.status !== 'cancelled'), [snap, tomorrow])
  const week = Math.max(1, Math.min(snap.semester.totalWeeks, weekOf(snap.semester, today)))
  const cols = useMemo(
    () => [1, 2, 3, 4, 5].map((wd) => {
      const date = dateOf(snap.semester, week, wd)
      return { date, items: occurrencesOn(snap, date).filter((o) => o.status !== 'cancelled') }
    }),
    [snap, week],
  )
  const cur = list.find((o) => o.start <= nowMin && nowMin < o.end)
  const next = list.find((o) => o.start > nowMin) ?? tlist[0]
  const remain = list.filter((o) => o.end > nowMin)
  const left = remain.length
  const dayNum = String(Number(today.slice(8)))
  const wdName = WD[((new Date(`${today}T00:00`).getDay() + 6) % 7) + 1]

  const add = (style: WidgetStyle) => {
    store.setPrefs({ widgetStyle: style })
    void addWidgetToHome(style)
  }

  const preview = (style: WidgetStyle) => {
    switch (style) {
      case 'today':
        return (
          <WCard className="h-[162px] w-[162px]">
            <WHead d={dayNum} w={wdName} sub={left > 0 ? `还剩 ${left} 节` : '没有课了'} />
            <div className="mt-2.5 space-y-1.5">
              {remain.slice(0, 2).map((o) => (
                <WRow key={o.key} name={o.name} loc={o.location ?? undefined} time={fmtMinutes(o.start)} color={o.color} big={false} />
              ))}
            </div>
          </WCard>
        )
      case 'next':
        return (
          <WCard className="flex h-[162px] w-[162px] flex-col">
            <div className="text-[11.5px] font-bold text-(--c-ink3)">{cur ? '上课中' : '下一节'}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[38px] leading-none font-semibold tracking-[-.035em] tabular-nums text-(--c-ink)">
                {cur ? Math.max(1, cur.end - nowMin) : next ? Math.max(1, next.start - nowMin) : '—'}
              </span>
              <span className="text-[13px] font-semibold text-(--c-ink3)">{cur ? '分钟后下课' : next ? '分钟后' : '没有课'}</span>
            </div>
            <div className="mt-auto">
              {(cur ?? next) && (
                <WRow
                  name={(cur ?? next)!.name}
                  loc={[(cur ?? next)!.location, (cur ?? next)!.teacher].filter(Boolean).join('　') || undefined}
                  color={(cur ?? next)!.color}
                  big={false}
                />
              )}
            </div>
          </WCard>
        )
      case 'twoDays':
        return (
          <WCard className="flex h-[162px] w-full gap-3.5">
            <div className="min-w-0 flex-1">
              <WHead d={dayNum} w={wdName} sub={left > 0 ? `还剩 ${left} 节` : '没有课了'} />
              <div className="mt-2.5 space-y-1.5">
                {remain.slice(0, 2).map((o) => (
                  <WRow key={o.key} name={o.name} time={fmtMinutes(o.start)} color={o.color} big={false} />
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-(--c-ink4)">明天{tlist.length > 0 ? ` ${tlist.length} 节` : '没有课'}</div>
              <div className="mt-2.5 space-y-1.5">
                {tlist.slice(0, 2).map((o) => (
                  <WRow key={o.key} name={o.name} time={fmtMinutes(o.start)} color={o.color} big={false} />
                ))}
              </div>
            </div>
          </WCard>
        )
      case 'week':
        return (
          <WCard className="w-full px-3.5 pt-3.5 pb-4">
            <div className="flex items-baseline">
              <span className="text-[17px] font-semibold tracking-[-.02em] text-(--c-ink)">第 {week} 周</span>
              <span className="ml-2 text-[12px] font-semibold text-(--c-ink4)">{Number(today.slice(5, 7))}月{dayNum}日</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((wd) => (
                <div key={wd} className={`flex-1 text-center text-[11.5px] font-bold ${cols[wd - 1].date === today ? 'text-(--c-accent)' : 'text-(--c-ink3)'}`}>{WD[wd]}</div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              {cols.map((col) => (
                <div key={col.date} className="flex flex-1 flex-col gap-1.5">
                  {col.items.slice(0, 2).map((o) => {
                    const isNow = col.date === today && o.start <= nowMin && nowMin < o.end
                    return (
                      <div
                        key={o.key}
                        className="h-[64px] rounded-[10px] px-1.5 py-2"
                        style={{ background: tint(o.color, isNow ? 16 : 8), boxShadow: isNow ? `inset 0 0 0 1.5px ${o.color}` : undefined }}
                      >
                        <div className="truncate text-[11px] leading-[1.25] font-bold" style={{ color: `color-mix(in srgb, ${o.color} 88%, var(--c-ink))` }}>{o.name}</div>
                        <div className="mt-1.5 text-[10px] leading-[1.3] font-semibold tabular-nums text-(--c-ink3)">{fmtMinutes(o.start)}</div>
                        <div className="mt-[1px] truncate text-[10px] leading-[1.3] font-medium text-(--c-ink4)">{o.location ?? ''}</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </WCard>
        )
    }
  }

  return (
    <Page className="bg-[#5d6d55]">
      <img src="/wall.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" />
      <div className="absolute inset-0 bg-black/25" />
      <StickyHead bleed={0} className="relative z-[30] px-5 pb-1">
        <div className="flex h-9 items-center">
          <BackButton onClick={onBack} />
        </div>
      </StickyHead>
      <div className="relative flex-1 overflow-y-auto px-4 pb-[130px] [scrollbar-width:none]">
        <h1 className="px-1 text-[26px] font-extrabold tracking-[-.02em] text-white">桌面小组件</h1>
        <div className="mt-5">
          <div className="flex gap-3.5">
            <Pick style="today" onAdd={add}>{preview('today')}</Pick>
            <Pick style="next" onAdd={add}>{preview('next')}</Pick>
          </div>
          <Pick style="twoDays" onAdd={add} className="mt-3.5 block w-full">{preview('twoDays')}</Pick>
          <Pick style="week" onAdd={add} className="mt-3.5 block w-full">{preview('week')}</Pick>
        </div>
      </div>
    </Page>
  )
}

