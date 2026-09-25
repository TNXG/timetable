/** 学期：设置、新学期、往期、分享选学期、教务自动更新 */
import { useRef, useState } from 'react'
import type { Semester } from '../../domain/types'
import type { Snapshot } from '../../domain/engine'
import type { SemesterArchive } from '../../domain/store'
import { uid } from '../../domain/store'
import { store, useStore } from '../store'
import { guessSemesterName, mondayOf, semesterEnded, termEnd, todayStr } from '../semester'
import { holidaysBetween } from '../../domain/holidays'
import { currentWeek } from '../Onboarding'
import { shareIcs } from '../files'
import { haptic, nativeConfirm, nativeToast, syncWidgets } from '../widgets'
import { eduSyncing, logoutEduSync, outcomeText, setEduSyncEnabled, statusText, syncNow, useEduSync } from '../edu-sync'
import { DateInput, Field, Loader, Page, PrimaryButton, RadioRow, Row, Sheet, SheetClose, SheetHead, SubPage, Switch, TextInput, TopBar, md } from '../ui'

const liveCount = (s: Snapshot) => s.courses.filter((c) => !c.hidden && !c.removedByImport).length

/* 选学期：和教务导入的「导入哪个学期？」同一套单选样式，第一项默认选中 */
export function SemesterPickSheet({ title, action, options, onPick, onClose }: {
  title: string; action: string; options: Snapshot[]; onPick: (s: Snapshot) => void; onClose: () => void
}) {
  const [sel, setSel] = useState(0)
  const dismiss = useRef<(() => void) | null>(null)
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-5 pb-1"
      header={<SheetHead title={title} trail={<SheetClose onClick={() => dismiss.current?.()} />} />}
      footer={<div className="px-5 pt-2"><PrimaryButton onClick={() => { onPick(options[sel]); dismiss.current?.() }}>{action}</PrimaryButton></div>}
    >
      <div className="space-y-2 pt-1">
        {options.map((s, i) => {
          const on = i === sel
          return (
            <RadioRow
              key={s.semester.id}
              on={on}
              onClick={() => { haptic('selection'); setSel(i) }}
              right={i === 0 ? '当前' : `${liveCount(s)} 门课`}
            >
              {s.semester.name}
            </RadioRow>
          )
        })}
      </div>
    </Sheet>
  )
}

/* 往期学期：只读内页，课程列表、底部分享；删除走和规则页一样的红色行 */
export function ArchivePage({ a, onBack }: { a: SemesterArchive; onBack: () => void }) {
  const courses = a.courses.filter((c) => !c.hidden && !c.removedByImport)
  const remove = async () => {
    const ok = await nativeConfirm({ title: `删除「${a.semester.name}」`, message: `${courses.length} 门课一起删除，不可恢复`, ok: '删除' })
    if (!ok) return
    store.removeArchive(a.semester.id)
    haptic('warning')
    nativeToast('已删除')
    onBack()
  }
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <TopBar title={a.semester.name} sub={`${md(a.semester.startDate)} 开学，${a.semester.totalWeeks} 周，${courses.length} 门课`} onBack={onBack} />
        <div className="mt-6 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          {courses.map((c) => <Row key={c.id} title={c.name} desc={c.teacher} right={<span />} />)}
        </div>
        <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Row title="删除学期" danger onClick={() => void remove()} right={<span />} />
        </div>
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={() => void shareIcs(a)}>分享课表</PrimaryButton>
      </div>
    </Page>
  )
}

/** 学期页的自动更新组：开关与状态、立即更新、退出登录；没绑定过不显示 */
export function EduSyncGroup({ onLogin }: { onLogin: () => void }) {
  const s = useEduSync()
  const [busy, setBusy] = useState(eduSyncing)
  if (!s) return null
  const status = statusText(s)
  const update = async () => {
    if (busy) return
    setBusy(true)
    try {
      const o = await syncNow()
      haptic(o.result === 'ok' || o.result === 'nochange' ? 'success' : 'error')
      nativeToast(outcomeText(o))
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    const ok = await nativeConfirm({ title: '退出登录', message: `清除${s.school.name}的登录会话，关闭自动更新`, ok: '退出' })
    if (!ok) return
    await logoutEduSync()
    haptic('warning')
    nativeToast('已退出登录')
  }
  return (
    <>
      <div className="mt-7 mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">自动更新</div>
      <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
        <div className="flex items-center px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold">{s.school.name}</div>
            <div className={`mt-0.5 text-[12px] font-medium ${status.danger ? 'text-(--c-danger)' : 'text-(--c-ink4)'}`}>{status.text}</div>
          </div>
          <Switch on={s.enabled} onChange={setEduSyncEnabled} />
        </div>
        {s.lastResult === 'expired' ? (
          <Row title="重新登录" onClick={() => onLogin()} />
        ) : (
          <Row title="立即更新" onClick={() => void update()} right={busy ? <Loader className="ml-3 text-(--c-ink4)" /> : <span />} />
        )}
        <Row title="退出登录" danger onClick={() => void logout()} right={<span />} />
      </div>
    </>
  )
}

export function SemesterSettings({ sem, onBack, onNew, onArchive, onLogin }: { sem: Semester; onBack: () => void; onNew: () => void; onArchive: (id: string) => void; onLogin: () => void }) {
  const state = useStore()
  const [name, setName] = useState(sem.name)
  const [date, setDate] = useState(sem.startDate)
  const [weeks, setWeeks] = useState(sem.totalWeeks)
  const [holidays, setHolidays] = useState(sem.holidays !== false)
  const start = mondayOf(date)
  const ended = semesterEnded({ startDate: start, totalWeeks: weeks })
  const archives = [...state.archives].reverse()
  const hols = holidaysBetween(start, termEnd({ startDate: start, totalWeeks: weeks }))

  return (
    <SubPage title="学期" sub={ended ? `已结束，共 ${weeks} 周` : `第 ${Math.max(1, currentWeek(start))} 周，共 ${weeks} 周`} onBack={onBack}>
      <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
        <Field k="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field k="开学" sub={`第 1 周 ${md(start)} 周一`}><DateInput value={date} onChange={setDate} /></Field>
        <Field k="总周数"><TextInput type="number" min={1} max={64} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></Field>
        <div className="flex items-center px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">法定节假日不排课</div>
            <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{hols.length > 0 ? hols.map((h) => `${h.name} ${md(h.start)}${h.start !== h.end ? `–${md(h.end)}` : ''}`).join('，') : '学期内无法定节假日'}</div>
          </div>
          <Switch on={holidays} onChange={setHolidays} />
        </div>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-[16px] bg-(--c-surface)">
        <Row title="开始新学期" desc={ended ? "当前学期移入往期" : undefined} onClick={onNew} />
      </div>

      <EduSyncGroup onLogin={onLogin} />

      {archives.length > 0 && (
        <>
          <div className="mt-7 mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">往期学期</div>
          <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
            {archives.map((a) => (
              <Row key={a.semester.id} title={a.semester.name} desc={`${md(a.semester.startDate)} 开学，${liveCount(a)} 门课`} onClick={() => onArchive(a.semester.id)} />
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <PrimaryButton
          onClick={() => {
            store.setSemester({
              ...sem,
              name: name.trim() || sem.name,
              startDate: start,
              totalWeeks: Math.min(64, Math.max(1, weeks)),
              holidays,
            })
            store.setPrefs({ dateSet: true })
            onBack()
          }}
        >保存</PrimaryButton>
      </div>
    </SubPage>
  )
}

/* 新学期：当前学期连课表封存进往期，作息、待办、偏好带到新学期，完成后直接进导入 */
export function NewSemesterPage({ sem, onBack, onDone }: { sem: Semester; onBack: () => void; onDone: () => void }) {
  const state = useStore()
  const [date, setDate] = useState(() => mondayOf(todayStr()))
  const start = mondayOf(date)
  const [name, setName] = useState(() => guessSemesterName(start))
  const [named, setNamed] = useState(false)
  const [weeks, setWeeks] = useState(sem.totalWeeks)
  const shown = named ? name : guessSemesterName(start)
  const keep = state.courses.length > 0 || state.entries.length > 0
  const live = liveCount({ ...state, semester: sem })

  return (
    <SubPage title="新学期" sub={keep ? `${sem.name} 移入往期，${live} 门课；作息与待办将会保留` : '作息与待办将会保留'} onBack={onBack}>
      <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
        <Field k="名称"><TextInput value={shown} onChange={(e) => { setNamed(true); setName(e.target.value) }} /></Field>
        <Field k="开学" sub={`第 1 周 ${md(start)} 周一`}><DateInput value={date} onChange={setDate} /></Field>
        <Field k="总周数"><TextInput type="number" min={1} max={64} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></Field>
      </div>

      <div className="mt-8">
        <PrimaryButton
          onClick={() => {
            store.startSemester({
              ...sem,
              id: uid(),
              name: shown.trim() || guessSemesterName(start),
              startDate: start,
              totalWeeks: Math.min(64, Math.max(1, weeks)),
              vacations: [],
              examWeeks: [],
            })
            store.setPrefs({ dateSet: true })
            void syncWidgets()
            onDone()
          }}
        >开始新学期</PrimaryButton>
      </div>
    </SubPage>
  )
}
