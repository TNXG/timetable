import React from 'react'
import { Phone, dockStyle, tint, TopBar } from '../shared'
import { parsed } from './detail-rules'
import { weekCols } from './today-week'

/* ---------------- 05b import from edu system ---------------- */

/* 流程：首页「导入课表」直达默认学校（新疆理工职业大学）的统一身份认证登录页，
   登录后打开课表页一键导入；其他导入方式在浏览器菜单的「其他导入方式」里。 */

export const eduTerms = ['2025-2026 学年 第 1 学期', '2024-2025 学年 第 2 学期', '2024-2025 学年 第 1 学期']

export function EduTermSheet() {
  return (
    <div className="absolute inset-0 z-[20]" style={{ background: 'var(--c-scrim)' }}>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] bg-(--c-surface) px-5 pt-5 pb-9 shadow-(--c-lift-shadow)">
        <div className="text-[17px] font-extrabold tracking-[-.02em] text-(--c-ink)">导入哪个学期？</div>
        <div className="mt-4 space-y-2">
          {eduTerms.map((t, i) => {
            const on = i === 0
            return (
              <div
                key={t}
                className="flex items-center rounded-[12px] px-3.5 py-3"
                style={{ background: on ? 'var(--c-accent-soft)' : 'var(--c-row-muted)', boxShadow: on ? 'inset 0 0 0 1.5px var(--c-accent)' : undefined }}
              >
                <span className="mr-3 flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full border-[1.8px]" style={{ borderColor: on ? 'var(--c-accent)' : 'var(--c-radio-border)', background: on ? 'var(--c-accent)' : 'transparent' }}>
                  {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>}
                </span>
                <span className={`text-[13.5px] font-bold text-(--c-ink) ${on ? '' : 'opacity-55'}`}>{t}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-5 rounded-[16px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">继续</div>
      </div>
    </div>
  )
}

/* 内置浏览器：页面内容是学校的，我们只叠一个悬浮胶囊 */
export function EduBrowserScreen({ ready = true, overlay }: { ready?: boolean; overlay?: React.ReactNode }) {
  const cells = ['高等数学（下）', '大学英语（三）', '数据结构', '大学物理', '线性代数', '形势与政策']
  return (
    <Phone>
      <div className="relative flex flex-1 flex-col overflow-hidden pt-12">
        <div className="flex items-center gap-3 px-5">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4"><path d="M15 19 8 12l7-7" /></svg>
          </div>
          <div className="flex h-9 min-w-0 flex-1 items-center rounded-full bg-(--c-surface) px-4">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink4)" strokeWidth="2.4" className="mr-2 flex-none"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            <span className="min-w-0 truncate text-[12.5px] font-semibold text-(--c-ink2)">qyrz.xjvut.edu.cn</span>
          </div>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.4" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
          </div>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface)">
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: 'var(--c-ink)' }}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </div>
        </div>

        {/* 教务页面示意：按实际网页风格灰级展示，不用我们的主题色 */}
        {!ready ? (
          <div className="mt-4 flex flex-1 flex-col overflow-hidden bg-white px-7 pt-12 text-[#111]">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tracking-[.06em]">新疆理工职业大学</span>
              <span className="text-[11.5px] text-[#9A9A9A]">统一身份认证</span>
            </div>
            <div className="mt-14 text-[24px] font-semibold tracking-[-.02em]">登录</div>
            <div className="mt-1.5 text-[12.5px] text-[#8A8A8A]">使用学号和统一身份认证密码</div>
            <div className="mt-8 space-y-3">
              <div>
                <div className="text-[11.5px] font-medium text-[#6B6B6B]">学号</div>
                <div className="mt-1.5 h-[44px] rounded-[10px] bg-[#F4F4F5] px-3.5 text-[13px] leading-[44px] text-[#B0B0B0]">2023 ···</div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-[11.5px] font-medium text-[#6B6B6B]"><span>密码</span><span className="text-[#9A9A9A]">忘记密码</span></div>
                <div className="mt-1.5 h-[44px] rounded-[10px] bg-[#F4F4F5] px-3.5 text-[13px] leading-[44px] text-[#B0B0B0]">••••••••</div>
              </div>
            </div>
            <div className="mt-6 h-[46px] rounded-[10px] bg-[#111] text-center text-[13.5px] leading-[46px] font-semibold text-white">登录</div>
            <div className="mt-4 text-center text-[11.5px] text-[#9A9A9A]">登录即同意《教务系统使用条款》</div>
            <div className="mt-auto pb-3 text-center text-[10.5px] text-[#B8B8B8]">新疆理工职业大学　© 2026</div>
          </div>
        ) : (
        <div className="mt-4 flex flex-1 flex-col overflow-hidden bg-white text-[#111]">
          <div className="flex items-center px-5 pt-4 pb-3">
            <span className="text-[16px] font-semibold tracking-[-.01em]">我的课表</span>
            <span className="ml-auto flex h-[26px] items-center gap-1.5 rounded-full bg-[#F4F4F5] px-3 text-[11px] font-medium text-[#444]">2025 秋季学期<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="3" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg></span>
          </div>
          <div className="grid grid-cols-[34px_repeat(5,1fr)] px-3 text-[9px]">
            <div />
            {[['一', 8], ['二', 9], ['三', 10], ['四', 11], ['五', 12]].map(([d, n]) => (
              <div key={d as string} className="pb-2 text-center">
                <div className="text-[9px] text-[#9A9A9A]">周{d}</div>
                <div className={`mx-auto mt-0.5 w-6 rounded-full text-[11px] font-semibold ${n === 10 ? 'bg-[#111] text-white' : 'text-[#111]'}`}>{n}</div>
              </div>
            ))}
            {Array.from({ length: 6 }).map((_, r) => (
              <React.Fragment key={r}>
                <div className="flex h-[74px] flex-col items-center pt-1 text-[8.5px] leading-[1.3] text-[#9A9A9A]">
                  <span className="font-semibold text-[#444]">{r * 2 + 1}</span>
                  <span>{['8:00', '10:05', '14:00', '15:55', '19:00', '20:45'][r]}</span>
                </div>
                {Array.from({ length: 5 }).map((_, c) => {
                  const k = (r * 5 + c) % 7
                  const on = k < 6 && (r + c) % 2 === 0
                  const bg = ['#EEF1FF', '#E9F6EE', '#FFF1E6', '#F3ECFF', '#E6F4F9', '#FDEDF1'][k]
                  const fg = ['#3E4A9E', '#2E7A4D', '#A45A1E', '#6A3EA6', '#1F6C8C', '#A8395A'][k]
                  const room = ['教三 302', '外语楼 105', '教一 201', '理科楼 B204', '教三 410', '主楼 117'][k]
                  return (
                    <div key={c} className="h-[74px] p-[2px]">
                      {on && (
                        <div className="h-full overflow-hidden rounded-[7px] px-1.5 py-1.5 text-[8px] leading-[1.3]" style={{ background: bg, color: fg }}>
                          <div className="font-semibold">{cells[k]}</div>
                          <div className="mt-[3px] opacity-70">{room}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-9 z-[9] flex justify-center">
          <span className={`flex h-[36px] items-center gap-1.5 rounded-full px-4 text-[13px] font-bold ${ready ? 'text-(--c-accent)' : 'text-(--c-ink3)'}`} style={dockStyle}>
            {ready ? '导入 32 门课' : '登录后打开课表页'}
          </span>
        </div>
        {overlay}
      </div>
    </Phone>
  )
}

export function EduPreviewScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col overflow-hidden px-5 pt-12">
        <TopBar title="32 门课" />

        <div className="mt-6 rounded-[16px] bg-(--c-surface) px-3 pt-2.5 pb-3">
          <div className="flex gap-[4px]">
            {['一', '二', '三', '四', '五', '六'].map((w) => (
              <div key={w} className="flex-1 text-center text-[9.5px] font-semibold text-(--c-ink4)">{w}</div>
            ))}
          </div>
          <div className="relative mt-1.5 flex h-[152px] gap-[4px]">
            {[0, 50, 100].map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-(--c-line2)" style={{ top: t + 48 }} />
            ))}
            {weekCols.map((col, i) => (
              <div key={i} className="relative flex-1">
                {col.map((ev) => (
                  <div
                    key={ev.name + ev.top}
                    className="absolute inset-x-0 overflow-hidden rounded-[5px] px-1 py-[3px] text-[7.5px] leading-[1.25] font-bold"
                    style={{ top: ev.top * 0.28, height: ev.h * 0.28, background: tint(ev.color, 14), color: `color-mix(in srgb, ${ev.color} 88%, var(--c-ink-mix))` }}
                  >
                    {ev.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between px-1">
          <span className="text-[12.5px] font-semibold text-(--c-ink3)">新增 32 门</span>
          <span className="text-[11.5px] font-semibold text-(--c-ink4)">学期开始 9月1日</span>
        </div>
        <div className="mt-2.5 space-y-2">
          {parsed.slice(0, 3).map((p) => (
            <div key={p.name} className="flex items-center overflow-hidden rounded-[12px] pr-3.5" style={{ background: tint(p.color, 7) }}>
              <i className="mr-3 h-[42px] w-[3px] flex-none rounded-full" style={{ background: p.color }} />
              <div className="flex-1 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-bold tracking-[-.01em] text-(--c-ink)">{p.name}</span>
                  <span className="ml-2 flex-none text-[11px] font-semibold tabular-nums text-(--c-ink3)">{p.weeks}</span>
                </div>
                <div className="mt-[3px] text-[11.5px] font-medium tabular-nums text-(--c-ink3)">{p.when}　{p.loc}　{p.teacher}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1" />
        <div className="pb-8">
          <div className="rounded-[16px] bg-(--c-accent) py-[15px] text-center text-[15px] font-bold text-white">导入</div>
        </div>
      </div>
    </Phone>
  )
}

export function EduFailScreen() {
  const options = ['让 AI 转换', '更新到最新版本', '反馈这个页面']
  return (
    <Phone>
      <div className="flex flex-1 flex-col overflow-hidden px-5 pt-12">
        <TopBar title="没有识别到课表" />

        <div className="mt-6 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="text-[11.5px] font-semibold text-(--c-ink4)">页面</div>
          <div className="mt-1.5 truncate font-mono text-[12.5px] text-(--c-ink)">jw.xjvut.edu.cn/xsxk/kbcx_list.jsp</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[16px] bg-(--c-surface)">
          {options.map((t, i) => (
            <div key={t} className={`flex items-center px-4 py-3.5 ${i > 0 ? 'border-t border-(--c-surface2)' : ''}`}>
              <span className="flex-1 text-[14px] font-bold text-(--c-ink)">{t}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.4" className="flex-none"><path d="m9 5 7 7-7 7" /></svg>
            </div>
          ))}
        </div>

        <div className="flex-1" />
        <div className="pb-8">
          <div className="rounded-[16px] bg-(--c-surface) py-[15px] text-center text-[15px] font-bold text-(--c-ink)">返回</div>
        </div>
      </div>
    </Phone>
  )
}
