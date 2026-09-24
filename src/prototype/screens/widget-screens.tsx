import React from 'react'
import { C, Phone, tint } from '../shared'

/* ---------------- 10 widgets ---------------- */

export function WCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] bg-(--c-surface) p-3.5 shadow-(--c-lift-shadow) ${className}`}>{children}</div>
  )
}

export function WHead({ d, w, sub }: { d: string; w: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[30px] leading-none font-semibold tracking-[-.03em] tabular-nums text-(--c-ink)">{d}</span>
      <span className="text-[13px] font-semibold text-(--c-accent)">{w}</span>
      {sub && <span className="ml-auto text-[11.5px] font-semibold text-(--c-ink4)">{sub}</span>}
    </div>
  )
}

export function WRow({ name, time, loc, color, big = true, badge }: { name: string; time?: string; loc?: string; color: string; big?: boolean; badge?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] py-1.5 pr-2.5 pl-0" style={{ background: tint(color, 8) }}>
      <i className="my-[3px] ml-1.5 w-[3px] flex-none self-stretch rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${big ? 'text-[13px]' : 'text-[12px]'} leading-[1.3] font-bold tracking-[-.01em] text-(--c-ink)`}>{name}</div>
        {loc && <div className="mt-[1px] truncate text-[11px] leading-[1.25] font-medium text-(--c-ink3)">{loc}</div>}
      </div>
      {badge && (
        <span className="flex-none rounded-full bg-(--c-accent) px-1.5 py-[2px] text-[9.5px] font-bold text-white">{badge}</span>
      )}
      {time && <div className="flex-none text-right text-[11.5px] leading-[1.3] font-semibold tabular-nums text-(--c-ink3)">{time}</div>}
    </div>
  )
}

export function WidgetScreen() {
  return (
    <Phone>
      <img src="/wall.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" />
      <div className="absolute inset-0 bg-[#0E1116]/25" />
      <div className="relative flex-1 px-4 pt-10">
        <div className="flex gap-3.5">
          <WCard className="h-[162px] w-[162px]">
            <WHead d="14" w="周二" />
            <div className="mt-2.5 space-y-1.5">
              <WRow name="高等数学" loc="教三 302" time="10:00" color={C.math} big={false} />
              <WRow name="数据结构" loc="教一 201" time="14:00" color={C.ds} big={false} />
            </div>
          </WCard>
          <WCard className="flex h-[162px] w-[162px] flex-col">
            <div className="text-[11.5px] font-bold text-(--c-ink3)">下一节</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[38px] leading-none font-semibold tracking-[-.035em] tabular-nums text-(--c-ink)">15</span>
              <span className="text-[13px] font-semibold text-(--c-ink3)">分钟后</span>
            </div>
            <div className="mt-auto">
              <WRow name="高等数学（下）" loc="教三 302　王立群" color={C.math} big={false} />
            </div>
          </WCard>
        </div>

        <WCard className="mt-3.5 flex h-[162px] gap-3.5">
          <div className="flex-1">
            <WHead d="14" w="周二" />
            <div className="mt-2.5 space-y-1.5">
              <WRow name="高等数学（下）" time="10:00" color={C.math} big={false} />
              <WRow name="数据结构" loc="教一 201" time="14:00" color={C.ds} big={false} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-bold text-(--c-ink4)">明天</div>
            <div className="mt-2.5 space-y-1.5">
              <WRow name="数据结构" time="10:00" color={C.ds} big={false} />
              <WRow name="大学物理" loc="理科楼 A203" time="14:00" color={C.phy} big={false} />
            </div>
          </div>
        </WCard>

        <WCard className="mt-3.5 px-3.5 pt-3.5 pb-4">
          <div className="flex items-baseline">
            <span className="text-[17px] font-semibold tracking-[-.02em] text-(--c-ink)">第 7 周</span>
            <span className="ml-2 text-[12px] font-semibold text-(--c-ink4)">10月14日</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[
              ['周一', false], ['周二', true], ['周三', false], ['周四', false], ['周五', false],
            ].map(([w, on]) => (
              <div key={w as string} className={`flex-1 text-center text-[11.5px] font-bold ${on ? 'text-(--c-accent)' : 'text-(--c-ink3)'}`}>{w}</div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {([
              [[C.eng, '大学英语', '08:00', '外语楼 105', false], [C.math, '高等数学', '10:00', '教三 302', false]],
              [[C.eng, '大学英语', '08:00', '外语楼 105', false], [C.math, '高等数学', '10:00', '教三 302', true]],
              [[C.ds, '数据结构', '10:00', '教一 201', false], [C.phy, '大学物理', '14:00', '理科楼 A', false]],
              [[C.math, '高等数学', '08:00', '教三 302', false], [C.la, '线性代数', '14:00', '教三 110', false]],
              [[C.phy, '大学物理', '08:00', '理科楼 A', false], [C.ds, '数据结构', '10:00', '机房 B2', false]],
            ] as [string, string, string, string, boolean][][]).map((col, i) => (
              <div key={i} className="flex flex-1 flex-col gap-1.5">
                {col.map(([color, name, time, loc, now]) => (
                  <div
                    key={name + time}
                    className="h-[64px] rounded-[10px] px-1.5 py-2"
                    style={{
                      background: tint(color, now ? 16 : 8),
                      boxShadow: now ? `inset 0 0 0 1.5px ${color}` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[11px] leading-[1.25] font-bold" style={{ color: `color-mix(in srgb, ${color} 88%, #000)` }}>{name}</span>
                    </div>
                    <div className="mt-1.5 text-[10px] leading-[1.3] font-semibold tabular-nums text-(--c-ink3)">{time}</div>
                    <div className="mt-[1px] truncate text-[10px] leading-[1.3] font-medium text-(--c-ink4)">{loc}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </WCard>
      </div>
    </Phone>
  )
}


export function WidgetScreen2() {
  return (
    <Phone>
      <img src="/wall.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" />
      <div className="absolute inset-0 bg-[#0E1116]/25" />
      <div className="relative flex-1 px-4 pt-10">
        <div className="flex gap-3.5">
          <WCard className="flex h-[196px] w-[162px] flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] leading-none font-semibold tracking-[-.03em] tabular-nums text-(--c-ink)">14</span>
              <span className="text-[12px] font-semibold text-(--c-accent)">周二</span>
              <span className="ml-auto text-[11px] font-semibold text-(--c-ink4)">还剩 3 节</span>
            </div>
            <div className="relative mt-3 flex-1">
              <i className="absolute top-1 bottom-2 left-[3.5px] w-[1.5px] rounded-full bg-(--c-surface2)" />
              <div className="space-y-[13px]">
                {([
                  ['10:00', '高等数学', '教三 302', C.math, 'now'],
                  ['14:00', '数据结构', '教一 201', C.ds, 'next'],
                  ['16:00', '体育', '东区体育馆', C.phy, 'next'],
                ] as [string, string, string, string, string][]).map(([t, name, loc, color, st]) => (
                  <div key={t} className="relative flex gap-2.5 pl-[18px]" style={{ opacity: st === 'past' ? 0.4 : 1 }}>
                    <i
                      className="absolute top-[4px] left-0 h-[8px] w-[8px] rounded-full"
                      style={{ background: st === 'now' ? color : 'var(--c-surface)', boxShadow: `inset 0 0 0 1.5px ${st === 'now' ? color : 'var(--c-dot-border)'}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] leading-[1.25] font-bold tracking-[-.01em] text-(--c-ink)">{name}</div>
                      <div className="mt-[1px] truncate text-[10.5px] leading-[1.25] font-medium tabular-nums text-(--c-ink3)">{t}　{loc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </WCard>
          <WCard className="flex h-[196px] w-[162px] flex-col">
            <div className="flex items-baseline">
              <span className="text-[11.5px] font-bold text-(--c-ink3)">这周要交</span>
              <span className="ml-auto text-[11px] font-semibold text-(--c-ink4)">3 项未完成</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <WRow name="高数习题册" loc="今晚 23:00" color={C.math} big={false} />
              <WRow name="数据结构实验二" loc="周四 18:00" color={C.ds} big={false} />
              <WRow name="物理实验报告" loc="周五 12:00" color={C.phy} big={false} />
            </div>
          </WCard>
        </div>

      </div>
    </Phone>
  )
}
