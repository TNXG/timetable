/** 我的：头图 + 概览 + 分组入口 */
import { useRef } from 'react'
import { motion, useTransform } from 'motion/react'
import { weekOf } from '../../domain/dates'
import { useStore } from '../store'
import { semesterEnded, todayStr } from '../semester'
import { taskLeadsText } from '../reminder'
import { THEME_LABEL, useTheme } from '../theme'
import { Chevron, TopVeil, md, useVeilOpacity } from '../ui'
import { usePhotoSrc } from './photo'

export type MePage = 'semester' | 'schedule' | 'history' | 'trash' | 'courses' | 'import' | 'share' | 'changes' | 'notif' | 'widget' | 'theme' | 'profile' | 'stats' | 'about' | 'erase'


export function MeView({ onPage }: { onPage: (p: MePage) => void }) {
  const state = useStore()
  const theme = useTheme()
  const sem = state.semester
  const trashCount = state.courses.filter((c) => c.removedByImport).length
  const live = state.courses.filter((c) => !c.removedByImport)
  const week = sem ? weekOf(sem, todayStr()) : 0
  const homework = state.tasks.filter((t) => t.kind === 'homework')

  const groups: [string, [string, string, MePage][]][] = [
    ['课表', [
      ['学期', sem ? (semesterEnded(sem) ? `${sem.name}，已结束` : `${sem.name}，第 ${Math.max(0, Math.min(sem.totalWeeks, week))} / ${sem.totalWeeks} 周`) : '未设置', 'semester'],
      ['作息时间', '', 'schedule'],
      ['课程', `${live.length} 门`, 'courses'],
      ['导入课表', '', 'import'],
      ['分享课表', '', 'share'],
    ]],
    ['提醒', [
      ['上课提醒', `课前 ${state.prefs.classLead} 分钟`, 'notif'],
      ['作业提醒', taskLeadsText(state.prefs.taskLeads), 'notif'],
    ]],
    ['外观', [
      ['主题', THEME_LABEL[theme], 'theme'],
    ]],
    ['记录', [
      ['变更记录', `${state.changes.length + state.overrides.length} 条`, 'changes'],
      ['导入历史', `${state.batches.length} 次`, 'history'],
      ['回收站', trashCount > 0 ? `${trashCount} 门` : '空', 'trash'],
    ]],
    ['高级', [
      ['关于', '', 'about'],
      ['清除数据', '', 'erase'],
    ]],
  ]
  const avatar = usePhotoSrc(state.prefs.avatar, '/avatar.jpg')
  const wall = usePhotoSrc(state.prefs.wall, '/wall.jpg')

  const meHero = useRef<HTMLDivElement>(null)
  const meHead = useRef<HTMLDivElement>(null)
  /* 头图在标题下面时不起白色羽化（原型里标题是直接写在图上的白字），等头图滑过标题区下沿之后才接上常规羽化 */
  const meVeil = useVeilOpacity(meHero, () => (meHero.current?.offsetHeight ?? 258) - (meHead.current?.offsetHeight ?? 0))
  /* 标题字色：头图顶部的暗色带（92px）滑走后就换成深色 */
  const meInkRaw = useVeilOpacity(meHero, () => 60)
  const meInk = useTransform(meInkRaw, (v) => Math.max(0, Math.min(1, v)))
  const meWhite = useTransform(meInk, (v) => 1 - v)
  return (
    <>
      <div ref={meHead} className="pointer-events-none absolute inset-x-0 top-0 z-[30] isolate px-5 pt-[max(52px,calc(env(safe-area-inset-top)+22px))] pb-3">
        <TopVeil progress={meVeil} />
      </div>
      <div className="relative flex-1 overflow-y-auto pb-[130px] [scrollbar-width:none]">
        <div ref={meHero} className="relative h-[258px] overflow-hidden bg-[#5d6d55]">
          <button onClick={() => onPage('profile')} className="absolute inset-0 transition-opacity active:opacity-85">
            <img src={wall} alt="" className="h-full w-full object-cover object-[50%_32%]" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[150px] bg-gradient-to-t from-(--c-bg) via-(--c-bg)/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[92px] bg-gradient-to-b from-black/25 to-transparent" />
          <button onClick={() => onPage('profile')} className="absolute inset-x-5 bottom-3 flex items-end text-left transition-opacity active:opacity-70">
            <img src={avatar} alt="" className="h-[62px] w-[62px] flex-none rounded-full border-[1.5px] border-(--c-bg) bg-(--c-accent) object-cover" />
            <div className="mb-1 ml-3.5 flex-1">
              <div className="text-[19px] font-extrabold tracking-[-.02em] text-(--c-ink)">{state.prefs.name || sem?.name || '我的课表'}</div>
              <div className="mt-[3px] flex items-center gap-2.5 text-[12px] font-semibold text-(--c-ink3)">
                <span>{sem ? `第 ${Math.max(0, Math.min(sem.totalWeeks, week))} / ${sem.totalWeeks} 周` : '未设置学期'}</span>
                {sem && <span className="tabular-nums text-(--c-ink5)">{md(sem.startDate)} 起</span>}
              </div>
            </div>
          </button>
        </div>

        <div className="px-5">
          <button onClick={() => onPage('stats')} className="flex w-full rounded-[18px] bg-(--c-surface) px-4 py-3.5 transition-opacity active:opacity-60">
            {[[String(live.length), '门课'], [String(state.overrides.length), '次调整'], [String(homework.length), '项作业']].map(([n, l], i) => (
              <div key={l} className={`flex-1 ${i ? 'border-l border-(--c-surface2)' : ''}`}>
                <div className="text-center text-[17px] font-extrabold tabular-nums text-(--c-ink)">{n}</div>
                <div className="mt-0.5 text-center text-[11px] font-semibold text-(--c-ink4)">{l}</div>
              </div>
            ))}
          </button>

          {groups.map(([g, rows]) => (
            <div key={g} className="mt-5">
              <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{g}</div>
              <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
                {rows.map(([k, v, page], i) => (
                  <button
                    key={k}
                    onClick={() => onPage(page)}
                    className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}
                  >
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                    <span className="text-[12.5px] font-medium text-(--c-ink4)">{v}</span>
                    <Chevron className="ml-2" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
