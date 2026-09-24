import React from 'react'
import { stickerOf } from '../../domain/stickers'
import { Sticker, stickerTilt } from '../../app/Sticker'
import { C, Phone, Nav, todayIndex, DayPicker, tint, TopBar } from '../shared'
import { weekCols } from './today-week'

/* ---------------- edit one session / manual add ---------------- */

export function Chips({ items, active }: { items: string[]; active: number }) {
  return (
    <div className="flex gap-1.5">
      {items.map((t, i) => (
        <span
          key={t}
          className={`rounded-[9px] px-2.5 py-[6px] text-[12px] font-bold ${i === active ? 'bg-(--c-accent-soft) text-(--c-accent)' : 'bg-(--c-surface) text-(--c-ink3)'}`}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

export function Field({ k, v, sub, muted }: { k: string; v: string; sub?: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline px-4 py-3">
      <span className="w-[62px] flex-none text-[12.5px] font-medium text-(--c-ink4)">{k}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-[14px] font-semibold ${muted ? 'text-(--c-ink4b)' : 'text-(--c-ink)'}`}>{v}</div>
        {sub && <div className="mt-1 text-[11.5px] font-medium text-(--c-ink4)">{sub}</div>}
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4" className="ml-2 flex-none self-center"><path d="m9 5 7 7-7 7" /></svg>
    </div>
  )
}

export function EditSessionScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="编辑课程" sub="线性代数，10月16日 周四 5–6 节" />

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">生效范围</div>
        <div className="mt-2.5">
          <Chips items={['仅本次', '每周']} active={0} />
        </div>

        <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">详情</div>
        <div className="mt-2.5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Field k="状态" v="正常上课" sub="可改为请假、停课或调课" />
          <Field k="时间" v="14:00 – 15:40" sub="5–6 节" />
          <Field k="地点" v="教学三楼 110" />
          <Field k="老师" v="赵一鸣" />
          <Field k="备注" v="带上上次的习题册" />
        </div>

        <div className="mt-4 text-[12.5px] font-semibold text-(--c-ink3)">快捷操作</div>
        <div className="mt-2.5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          {([
            ['请假一次', '出勤记一次缺勤'],
            ['这节停课', '仅移除这一次，不影响其他周'],
            ['调整时间', '选新的日期和节次，保留一条变更记录'],
          ] as [string, string][]).map(([t, d]) => (
            <div key={t} className="flex items-center px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-(--c-ink)">{t}</div>
                <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink4)">{d}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4" className="ml-2 flex-none"><path d="m9 5 7 7-7 7" /></svg>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between px-1">
          <span className="text-[12px] font-medium text-(--c-ink4b)">手动改动不被导入覆盖</span>
          <div className="flex items-center gap-5">
            <span className="text-[13px] font-bold text-(--c-ink3)">取消</span>
            <span className="text-[13px] font-bold text-(--c-accent)">保存</span>
          </div>
        </div>
      </div>
    </Phone>
  )
}

export function ManualAddScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="手动添加" />

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">类型</div>
        <div className="mt-2.5">
          <Chips items={['课程', '自习', '考试', '其他']} active={1} />
        </div>

        <div className="mt-4 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Field k="名称" v="数据结构复习" />
          <Field k="时间" v="周三 19:00 – 21:00" sub="不占节次，按钟点安排" />
          <Field k="地点" v="图书馆 3 层 自习区" />
          <Field k="重复" v="每周三，到第 16 周" sub="也可只加这一次" />
          <Field k="提醒" v="开始前 15 分钟" />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <span className="text-[12.5px] font-medium text-(--c-ink4)">颜色</span>
          <div className="flex items-center gap-2.5">
            {[C.la, C.ds, C.eng, C.phy, C.pol, '#8A8E97'].map((c, i) => (
              <span
                key={c}
                className="flex h-[19px] w-[19px] items-center justify-center rounded-full"
                style={{ background: tint(c, 22), boxShadow: i === 0 ? `inset 0 0 0 1.6px ${c}` : undefined }}
              >
                <i className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="text-[12.5px] font-semibold text-(--c-ink3)">预览</div>
          <div className="mt-2.5 flex items-center rounded-[12px] px-3.5 py-3" style={{ background: tint(C.la, 8) }}>
            <i className="mr-3 h-[34px] w-[3px] flex-none rounded-full" style={{ background: C.la }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-(--c-ink)">数据结构复习</div>
              <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink3)">周三 19:00–21:00　图书馆 3 层</div>
            </div>
          </div>
          <div className="mt-2.5 text-[11.5px] leading-[1.5] font-medium text-(--c-ink4b)">和周三的课不冲突。</div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-5 px-1">
          <span className="text-[13px] font-bold text-(--c-ink3)">取消</span>
          <span className="text-[13px] font-bold text-(--c-accent)">添加</span>
        </div>
      </div>
    </Phone>
  )
}

/* ---------------- command palette search ---------------- */

export const searchGroups: [string, [string, string, string, string][]][] = [
  ['课程', [
    ['线性代数', '周四 5–6 节，教学三楼 110', '赵一鸣', C.la],
    ['线性代数习题课', '周二 9–10 节，教学三楼 110', '选到课', C.la],
  ]],
  ['老师', [
    ['赵一鸣', '线性代数、线代习题课，2 门', '', C.la],
  ]],
  ['教室', [
    ['教学三楼 110', '线性代数、线代习题课，本周 3 节', '', '#8A8E97'],
  ]],
]

export function SearchScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-4 pt-12">
        <div className="flex items-center rounded-full bg-(--c-surface) px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.2" className="mr-2.5 flex-none"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
          <span className="text-[14px] font-medium text-(--c-ink)">线</span>
          <i className="ml-[1px] h-[15px] w-[1.5px] bg-(--c-accent)" />
          <span className="ml-auto flex-none text-[12.5px] font-medium text-(--c-ink3)">取消</span>
        </div>

        <div className="mt-3 space-y-3.5">
          {searchGroups.map(([g, rows]) => (
            <div key={g}>
              <div className="px-1.5 text-[11.5px] font-medium text-(--c-ink4)">{g}</div>
              <div className="mt-1.5 overflow-hidden rounded-[14px] bg-(--c-surface) p-1">
                {rows.map(([name, meta, right], i) => (
                  <div key={name} className={`flex items-center rounded-[10px] px-2.5 py-2.5 ${g === '课程' && i === 0 ? 'bg-(--c-line2)' : ''}`}>
                    <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full" style={{ background: rows[i][3] }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-(--c-ink)">
                        {name.split('线').map((part, k) => (
                          <React.Fragment key={k}>
                            {k > 0 && <span className="bg-(--c-accent-soft) text-(--c-accent)">线</span>}
                            {part}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="mt-[2px] truncate text-[11.5px] font-medium text-(--c-ink4)">{meta}</div>
                    </div>
                    {right && <span className="ml-2 flex-none text-[11.5px] font-medium text-(--c-ink4b)">{right}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  )
}

export function SearchEmptyScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-4 pt-12">
        <div className="flex items-center rounded-full bg-(--c-surface) px-4 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.2" className="mr-2.5 flex-none"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
          <span className="text-[14px] font-medium text-(--c-ink)">线代考试</span>
          <i className="ml-[1px] h-[15px] w-[1.5px] bg-(--c-accent)" />
          <span className="ml-auto flex-none text-[12.5px] font-medium text-(--c-ink3)">取消</span>
        </div>
        <div className="mt-8 text-center text-[12.5px] font-medium text-(--c-ink4)">未找到“线代考试”</div>
        <div className="mt-4 overflow-hidden rounded-[14px] bg-(--c-surface) p-1">
          <div className="flex items-center rounded-[10px] px-2.5 py-2.5">
            <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full bg-(--c-accent)" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-(--c-ink)">新建待办“线代考试”</div>
              <div className="mt-[2px] text-[11.5px] font-medium text-(--c-ink4)">线性代数，考试</div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4" className="ml-2 flex-none"><path d="m9 5 7 7-7 7" /></svg>
          </div>
        </div>
      </div>
    </Phone>
  )
}

/* ---------------- long press quick menu ---------------- */

export const pressMenu: [React.ReactNode, string, string][] = [
  [<g key="b"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 6-2 6h16s-2-1-2-6a6 6 0 0 0-6-6z" /><path d="M4 4l16 16" /></g>, '静音本节', '仅本次不提醒'],
  [<g key="c"><path d="M20 6 9 17l-5-5" /></g>, '标记已上', '计入出勤，13 → 14 课时'],
  [<g key="l"><rect x="3.5" y="4" width="17" height="16" rx="4" /><path d="M9 12h6" /></g>, '请假一次', '出勤记一次缺勤'],
  [<g key="h"><path d="M4 17V7M20 17V7" /><path d="m8 13 4-4 4 4" /></g>, '变更记录', '共 2 条'],
  [<g key="e"><path d="M4 20h4L20 8l-4-4L4 16z" /></g>, '编辑课程', '时间、地点、备注'],
]

export function LongPressScreen() {
  const col = 1
  const evTop = 84
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">
            第 7 周
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.6"><path d="m6 9 6 6 6-6" /></svg>
          </div>
          <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>单周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>秋季学期</span>
          </div>
        </div>

        <div className="mt-3.5 px-2">
          <div className="rounded-[22px] bg-(--c-surface) p-2.5 pb-4">
            <DayPicker
              active={todayIndex}
              lead={<div className="-mr-[5px] flex w-8 flex-none items-center justify-center text-[10.5px] font-semibold text-(--c-ink4)">10月</div>}
            />
            <div className="relative mt-2">
              {[0, 84, 168, 252, 336, 420, 504].map((t) => (
                <div key={t} className="absolute right-0 left-8 h-px bg-(--c-line2)" style={{ top: t + 6 }} />
              ))}
              <div className="flex pt-1.5">
                <div className="w-8 flex-none">
                  {['8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((t) => (
                    <div key={t} className="h-[84px] pr-1.5 text-right text-[9.5px] font-semibold tabular-nums text-(--c-ink4b)">{t}</div>
                  ))}
                </div>
                <div className="relative flex h-[536px] flex-1 gap-[5px]">
                  {weekCols.map((c, i) => (
                    <div key={i} className="relative flex-1">
                      {c.map((ev) => {
                        const pressed = i === col && ev.top === evTop
                        const sticker = ev.h >= 44 ? stickerOf(ev.name) : null
                        return (
                          <div key={ev.name + ev.top} className="absolute inset-x-0" style={{ top: ev.top, height: ev.h, zIndex: pressed ? 40 : undefined }}>
                            <div
                              className="relative h-full w-full overflow-hidden rounded-[9px] px-1 py-1.5 text-[9.5px] leading-[1.35] font-bold"
                              style={{
                                background: tint(ev.color, pressed ? 20 : 10),
                                color: `color-mix(in srgb, ${ev.color} 85%, var(--c-ink-mix))`,
                                boxShadow: pressed ? `inset 0 0 0 1.5px ${ev.color}, var(--c-lift-shadow)` : undefined,
                                transform: pressed ? 'scale(1.06)' : undefined,
                              }}
                            >
                              {ev.name}
                              <div className={`mt-0.5 text-[8.5px] leading-[1.3] font-semibold opacity-60 ${sticker ? 'pr-2.5' : ''}`}>{ev.loc}</div>
                            </div>
                            {sticker && (
                              <Sticker id={sticker} size={20} tilt={stickerTilt(ev.name)} className="pointer-events-none absolute -right-1.5 -bottom-1.5 z-10" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-30 bg-(--c-bg)/72" />

      <div className="absolute top-[318px] right-4 z-40 w-[226px] overflow-hidden rounded-[17px] border border-(--c-line) bg-(--c-surface) py-2" style={{ boxShadow: 'var(--c-menu-shadow)' }}>
        <div className="px-3.5 pt-1 pb-2.5">
          <div className="truncate text-[12.5px] font-medium text-(--c-ink4)">高等数学（下）　10:00</div>
        </div>
        {pressMenu.map(([ic, t], i) => (
          <div key={t} className={`mx-2 flex items-center rounded-[11px] px-2.5 py-[9px] ${i === 0 ? 'bg-(--c-line2)' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-ink2)" strokeWidth="1.7" strokeLinecap="round" className="mr-3 h-[17px] w-[17px] flex-none">{ic}</svg>
            <span className="truncate text-[14px] font-medium text-(--c-ink)">{t}</span>
          </div>
        ))}
        <div className="mx-2 mt-0.5 flex items-center rounded-[11px] px-2.5 py-[9px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="#C25B5B" strokeWidth="1.7" strokeLinecap="round" className="mr-3 h-[17px] w-[17px] flex-none"><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" /></svg>
          <span className="text-[14px] font-medium text-(--c-danger)">本节停课</span>
        </div>
      </div>

      <Nav active={1} />
    </Phone>
  )
}
