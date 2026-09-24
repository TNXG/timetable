import React from 'react'
import { Phone, Nav, SubHead } from '../shared'

/* ---------------- 08 me ---------------- */

export const meGroups: [string, [string, string][]][] = [
  ['课表', [
    ['当前课表', '2025 秋季学期'],
    ['导入规则', '正方教务 通用规则 v2.3'],
    ['作息时间', ''],
  ]],
  ['提醒', [
    ['上课提醒', '课前 15 分钟'],
    ['作业提醒', '截止前 1 天、2 小时'],
  ]],
  ['其他', [
    ['外观', '跟随系统'],
    ['分享课表', ''],
  ]],
  ['高级', [
    ['关于', ''],
    ['清除数据', ''],
  ]],
]

/* ---------------- 个人资料 / 统计 / 清除数据 ---------------- */


export const CAM = <g><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></g>

export function CamBadge({ className }: { className: string }) {
  return (
    <span className={`grid place-items-center rounded-full ${className}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{CAM}</svg>
    </span>
  )
}

export function ProfileScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <SubHead title="个人资料" />
        <div className="mt-6 px-5">
          <div className="relative h-[172px] overflow-hidden rounded-[18px] bg-[#5d6d55]">
            <img src="/wall.jpg" alt="" className="h-full w-full object-cover object-[50%_32%]" />
            <div className="absolute inset-x-0 bottom-0 h-[96px] bg-gradient-to-t from-black/50 to-transparent" />
            <CamBadge className="absolute top-3 right-3 h-[28px] w-[28px] bg-black/35 text-white backdrop-blur-md" />
            <div className="absolute bottom-4 left-4 h-[64px] w-[64px]">
              <img src="/avatar.jpg" alt="" className="h-full w-full rounded-full border-2 border-white/90 object-cover" />
              <CamBadge className="absolute -right-0.5 -bottom-0.5 h-[24px] w-[24px] bg-(--c-ink) text-(--c-bg) ring-2 ring-white" />
            </div>
          </div>
          <div className="mt-5 flex items-baseline rounded-[16px] bg-(--c-surface) px-4 py-3">
            <span className="w-[62px] flex-none text-[12.5px] font-medium text-(--c-ink4)">名称</span>
            <span className="text-[14px] font-semibold text-(--c-ink)">李思远</span>
          </div>
        </div>
      </div>
    </Phone>
  )
}

/* [颜色, 课名, 已上, 全部, 老师, 学分, 每周节数, 请假次数] */
export const statsCourses: [string, string, number, number, string, number, number, number][] = [
  ['var(--c-accent)', '高等数学', 36, 96, '王建国', 4, 6, 2],
  ['var(--c-rose)', '线性代数', 24, 64, '刘娜', 3, 4, 0],
  ['var(--c-amber)', '大学英语', 24, 64, '周敏', 2, 4, 0],
  ['#4F8A6B', '数据结构', 20, 64, '张伟', 3, 4, 1],
]

export function StatsScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <SubHead title="统计" />
        <div className="mt-6 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4 pt-4 pb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[22px] font-extrabold tracking-[-.02em] text-(--c-ink)">第 6 周</span>
              <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">共 18 周</span>
            </div>
            <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-(--c-surface2)">
              <div className="h-full w-1/3 rounded-full bg-(--c-ink)" />
            </div>
            <div className="mt-3.5 flex gap-3 text-[12.5px] font-medium tabular-nums text-(--c-ink3)">
              <span>12 门课</span><span>24 学分</span><span>每周 22 节</span>
            </div>
          </div>
          <div className="mt-5">
            <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">必修</div>
            <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
              {statsCourses.map(([c, n, done, total, t, cr, w, leave], i) => (
                <div key={n} className={`py-3.5 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
                  <div className="flex items-baseline">
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{n}</span>
                    <span className="ml-3 text-[12.5px] font-semibold tabular-nums text-(--c-ink3)">{done} / {total} 节</span>
                  </div>
                  <div className="mt-2 h-[4px] overflow-hidden rounded-full bg-(--c-surface2)">
                    <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: c }} />
                  </div>
                  <div className="mt-1.5 flex items-baseline text-[12px] font-medium tabular-nums text-(--c-ink4)">
                    <span className="flex flex-1 gap-2.5"><span>{t}</span><span>{cr} 学分</span><span>每周 {w} 节</span></span>
                    {leave > 0 && <span className="ml-3 text-(--c-danger)">请假 {leave} 次</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">本学期</div>
            <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
              {([['第一节有课', '每周 3 天', false], ['作业', '5 / 7 已完成', true], ['考试', '2 场', true], ['请假', '3 次', true], ['调课', '1 次', true]] as [string, string, boolean][]).map(([k, v, go], i) => (
                <div key={k} className={`flex items-center py-3.5 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
                  <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                  <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{v}</span>
                  {go && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.2" className="ml-2"><path d="m9 5 7 7-7 7" /></svg>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Phone>
  )
}

export function EraseScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col pt-12">
        <SubHead title="清除数据" sub="卸载应用不会移除系统日历中的内容。" />
        <div className="mt-6 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4">
            {['课表、课程和调整', '作业和照片', '系统日历中由本应用创建的日历'].map((t, i) => (
              <div key={t} className={`py-3.5 text-[14px] font-semibold text-(--c-ink) ${i ? 'border-t border-(--c-line2)' : ''}`}>{t}</div>
            ))}
          </div>
        </div>
        <div className="mt-auto" />
      </div>
      <div className="px-5 pb-6">
        <button className="w-full rounded-[18px] bg-(--c-danger) py-[15px] text-[15px] font-bold text-white">清除全部数据</button>
      </div>
    </Phone>
  )
}

/* ---------------- 关于 ---------------- */

export function AboutScreen() {
  return (
    <Phone>
      <div className="flex flex-1 flex-col pt-12">
        <SubHead title="关于" />
        <div className="mt-10 flex flex-col items-center">
          <img src="/icon.png" alt="" className="h-[84px] w-[84px]" />
          <div className="mt-4 text-[22px] font-extrabold tracking-[-.02em] text-(--c-ink)">嘎嘎课程表</div>
          <div className="mt-1 text-[12.5px] font-medium tabular-nums text-(--c-ink4)">1.4.78</div>
        </div>
        <div className="mt-8 px-5">
          <div className="rounded-[18px] bg-(--c-surface) px-4">
            {([
              ['1.4.78', '版本'],
              ['GPL-3.0', '开源协议'],
              ['github.com/TNXG/timetable', '代码仓库'],
            ] as [string, string][]).map(([v, label], i) => (
              <div key={label} className={`py-3.5 ${i ? 'border-t border-(--c-line2)' : ''}`}>
                <div className="truncate text-[15px] font-semibold text-(--c-ink)">{v}</div>
                <div className="mt-0.5 text-[11.5px] font-medium text-(--c-ink4)">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink4)">开发者</div>
          <div className="mt-2 overflow-hidden rounded-[18px] bg-(--c-surface) px-4">
            {([
              ['TNXG', '维护者', 'https://api-space.tnxg.top/avatar?s=qq'],
              ['Shuakami', '原作者', 'https://api-space.tnxg.top/images/proxy?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F149454909%3Fv%3D4'],
            ] as [string, string, string][]).map(([name, role, avatar]) => (
              <button key={name} className={`flex w-full items-center py-3.5 text-left ${name === 'Shuakami' ? 'border-t border-(--c-line2)' : ''}`}>
                <img src={avatar} alt="" className="h-10 w-10 flex-none rounded-full bg-(--c-surface2) object-cover" />
                <div className="ml-3 min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-(--c-ink)">{name}</div>
                  <div className="mt-0.5 truncate text-[12px] font-medium text-(--c-ink4)">{role} · GitHub.com</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.2" strokeLinecap="round" className="ml-3 flex-none"><path d="m9 5 7 7-7 7" /></svg>
              </button>
            ))}
            {['反馈问题'].map((k) => (
              <div key={k} className={`flex items-center py-3.5 border-t border-(--c-line2)`}>
                <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.2" className="ml-2"><path d="m9 5 7 7-7 7" /></svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Phone>
  )
}

export function MeScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden">
        <div className="relative h-[258px]">
          <img src="/wall.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_32%]" />
          <div className="absolute inset-x-0 bottom-0 h-[150px] bg-(--c-fade-photo)" />
          <div className="absolute inset-x-0 top-0 h-[92px] bg-gradient-to-b from-black/25 to-transparent" />
          <div className="absolute top-12 right-5 left-5">
            <span className="text-[15px] font-bold tracking-[-.01em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.35)]">我的</span>
          </div>
          <div className="absolute inset-x-5 bottom-3 flex items-end">
            <img src="/avatar.jpg" alt="" className="h-[62px] w-[62px] flex-none rounded-full border-[1.5px] border-white object-cover" />
            <div className="mb-1 ml-3.5 flex-1">
              <div className="text-[19px] font-extrabold tracking-[-.02em] text-(--c-ink)">李思远</div>
              <div className="mt-[3px] flex items-center gap-2.5 text-[12px] font-semibold text-(--c-ink3)">
                <span>计算机学院 2023 级</span>
                <span className="tabular-nums text-(--c-ink4b)">20231234</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5">
          <div className="flex rounded-[18px] bg-(--c-surface) px-4 py-3.5">
            {[['18', '门课'], ['24', '学分'], ['86%', '出勤']].map(([n, l], i) => (
              <div key={l} className={`flex-1 ${i ? 'border-l border-(--c-surface2)' : ''}`}>
                <div className="text-center text-[17px] font-extrabold tabular-nums text-(--c-ink)">{n}</div>
                <div className="mt-0.5 text-center text-[11px] font-semibold text-(--c-ink4)">{l}</div>
              </div>
            ))}
          </div>

          {meGroups.map(([g, rows]) => (
            <div key={g} className="mt-5">
              <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink4)">{g}</div>
              <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
                {rows.map(([k, v], i) => (
                  <div key={k} className={`flex items-center py-3.5 ${i ? 'border-t border-(--c-line2)' : ''}`}>
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                    <span className="text-[12.5px] font-medium text-(--c-ink4)">{v}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink5)" strokeWidth="2.2" className="ml-2"><path d="m9 5 7 7-7 7" /></svg>
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
      <Nav active={3} />
    </Phone>
  )
}
