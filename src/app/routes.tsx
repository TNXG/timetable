/** 内页路由表：栈里每一页的渲染；跳转能力由 RealApp 通过 ctx 注入 */
import type { ReactNode } from 'react'
import type { Course, Occurrence, OverrideKind, Task } from '../domain/types'
import { dateOf, fmtMinutes, weekOf } from '../domain/dates'
import { todayStr } from './semester'
import { maskHasWeek } from '../domain/weeks'
import { occurrencesOn, type Snapshot } from '../domain/engine'
import type { RuleManifest } from '../domain/rules'
import type { RuleOutput } from '../domain/importer'
import { uid } from '../domain/store'
import { DEFAULT_PLUGIN, EDU_PLUGINS, hasDirectLogin, type EduPlugin } from '../domain/edu/plugin'
import type { CapturedPhoto } from './camera'
import { ConflictPage } from './course/ConflictPage'
import { CourseDetailPage } from './course/CourseDetailPage'
import { CourseEditPage } from './course/CourseEditPage'
import { EditSessionPage } from './course/EditSessionPage'
import { ManualAddPage } from './course/ManualAddPage'
import { CameraPage, PickerPage, ReviewPage, TaskDetailPage } from './todo'
import { ScanPage } from './scan'
import { SchedulePage } from './schedule'
import { EduBrowserPage } from './edu/EduBrowserPage'
import { EduLoginPage } from './edu/EduLoginPage'
import { EduFailPage, type EduFailInfo } from './edu/EduFailPage'
import { ImportPage } from './import/ImportPage'
import { AiImportPage } from './import/AiImportPage'
import { ImportRunPage } from './import/ImportRunPage'
import { RuleEditorPage } from './import/RuleEditorPage'
import { EDU_RULE, getEduSync, restoreEduSync, type EduSyncSource } from './edu-sync'
import { CalendarIntroPage, NotifPrefPage, PrefPickPage, type PrefKey } from './reminder'
import { WidgetPage } from './widget'
import { CoursesPage } from './me/Library'
import { EduStatusPage } from './me/EduStatus'
import { CompleteInfoPage, missingInfo } from './me/CompleteInfo'
import { ArchivePage, NewSemesterPage, SemesterSettings } from './me/Semester'
import { ProfilePage, type PhotoTarget } from './me/ProfilePage'
import { StatsPage } from './me/StatsPage'
import { ThemePage } from './me/ThemePage'
import { ErasePage } from './me/ErasePage'
import { AboutPage } from './me/AboutPage'
import { DebugHub, type DebugPage } from './debug/DebugHub'
import { OcrPage } from './debug/OcrPage'
import { EduPage } from './debug/EduPage'
import { DataPage } from './debug/DataPage'
import { EnvPage } from './debug/EnvPage'
import { ICON, PopHead, PopItem, Popover } from './ui'
import { haptic, nativeToast } from './widgets'
import { store } from './store'

export type Route =
  | { k: 'course'; course: Course }
  | { k: 'courseEdit'; course: Course }
  | { k: 'session'; occ: Occurrence }
  | { k: 'conflict'; occ: Occurrence }
  | { k: 'todoDetail'; task: Task }
  | { k: 'todoCamera'; courseId?: string; taskId?: string }
  | { k: 'todoPicker'; courseId?: string; taskId?: string }
  | { k: 'todoReview'; photos: CapturedPhoto[]; courseId?: string }
  | { k: 'manual' }
  | { k: 'eduLogin' }
  | { k: 'eduRelogin'; plugin: EduPlugin }
  | { k: 'eduBrowser'; startUrl?: string; plugin?: EduPlugin }
  | { k: 'eduPreview'; out: RuleOutput; src: EduSyncSource; over?: boolean }
  | { k: 'eduFail'; info: EduFailInfo }
  | { k: 'eduStatus' }
  | { k: 'import' }
  | { k: 'scan' }
  | { k: 'importRun'; ruleId: string; text?: string; auto?: boolean }
  | { k: 'aiImport'; attach?: string }
  | { k: 'rule'; rule: RuleManifest | null }
  | { k: 'semester' }
  | { k: 'newSemester' }
  | { k: 'archive'; id: string }
  | { k: 'schedule' }
  | { k: 'completeInfo' }
  | { k: 'courses' }
  | { k: 'notif' }
  | { k: 'calendarIntro' }
  | { k: 'notifPick'; pref: PrefKey }
  | { k: 'widget' }
  | { k: 'theme' }
  | { k: 'profile' }
  | { k: 'photoPick'; target: PhotoTarget }
  | { k: 'stats' }
  | { k: 'erase' }
  | { k: 'about' }
  | { k: 'debug' }
  | { k: 'debugOcr' }
  | { k: 'debugEdu' }
  | { k: 'debugData' }
  | { k: 'debugEnv' }

/* 课程详情里点某条每周安排：找到这条规则在本周（或第一周）的那次课 */
export function occurrenceOfRule(snap: Snapshot, ruleId: string): Occurrence | null {
  const rule = snap.rules.find((r) => r.id === ruleId)
  if (!rule) return null
  const cur = Math.max(1, Math.min(snap.semester.totalWeeks, weekOf(snap.semester, todayStr())))
  const weeks = [cur, ...Array.from({ length: snap.semester.totalWeeks }, (_, i) => i + 1)]
  for (const w of weeks) {
    if (!maskHasWeek(rule.weeksMask, w)) continue
    const date = dateOf(snap.semester, w, rule.weekday)
    const hit = occurrencesOn(snap, date).find((o) => o.ruleId === ruleId)
    if (hit) return hit
  }
  return null
}

export interface RouteCtx {
  snap: Snapshot
  stack: Route[]
  compose: { courseId?: string } | null
  pop: () => void
  push: (r: Route) => void
  replaceTop: (r: Route) => void
  setStack: (updater: Route[] | ((prev: Route[]) => Route[])) => void
  setTab: (i: number) => void
  backToTimetable: () => void
  openCourseById: (id: string) => void
  openCapture: (kind: 'camera' | 'text', courseId?: string) => void
  onPhotos: (photos: CapturedPhoto[], courseId?: string, taskId?: string) => void
  applyPhoto: (target: PhotoTarget, ps: CapturedPhoto[]) => void
  pickPhoto: (target: PhotoTarget) => Promise<void>
  eraseDone: () => void
  openEduLogin: () => void
}

/** 拍完/选完的页面：确认页推在相机上方，出栈时一并拿掉 */
export const notShot = (r: Route) => r.k !== 'todoCamera' && r.k !== 'todoPicker' && r.k !== 'todoReview'

/** 栈里第 i 页的渲染；跳转能力由 RealApp 通过 ctx 注入 */
export function renderRoute(r: Route, i: number, ctx: RouteCtx): ReactNode {
  const { snap, stack, compose, pop, push, replaceTop, setStack, setTab, backToTimetable, openCourseById, openCapture, onPhotos, applyPhoto, pickPhoto, eraseDone, openEduLogin } = ctx
  const loginBoundSchool = () => {
    const sync = getEduSync()
    if (!sync) { openEduLogin(); return }
    const plugin = EDU_PLUGINS.find((p) => p.url === sync.school.url)
    if (!plugin) { nativeToast('该学校暂不支持重新登录'); return }
    push(hasDirectLogin(plugin) ? { k: 'eduRelogin', plugin } : { k: 'eduBrowser', plugin })
  }
    const key = `${r.k}-${i}`
    switch (r.k) {
      case 'course':
        return (
          <CourseDetailPage
            key={key}
            course={r.course}
            snap={snap}
            onBack={pop}
            onEdit={() => push({ k: 'courseEdit', course: r.course })}
            composing={compose?.courseId === r.course.id}
            onCapture={(kind) => openCapture(kind, r.course.id)}
            onOpenTask={(t) => push({ k: 'todoDetail', task: t })}
          />
        )
      case 'courseEdit':
        return (
          <CourseEditPage
            key={key}
            course={r.course}
            onBack={pop}
            onEditSession={(ruleId) => {
              const occ = occurrenceOfRule(snap, ruleId)
              if (occ) push({ k: 'session', occ })
            }}
          />
        )
      case 'session':
        return <EditSessionPage key={key} occ={r.occ} snap={snap} onBack={pop} />
      case 'conflict':
        return <ConflictPage key={key} occ={r.occ} snap={snap} onBack={pop} onCourse={openCourseById} />
      case 'todoDetail':
        return (
          <TaskDetailPage
            key={key}
            task={r.task}
            snap={snap}
            onBack={pop}
            onCamera={() => push({ k: 'todoCamera', courseId: r.task.courseId, taskId: r.task.id })}
          />
        )
      case 'todoCamera':
        return (
          <CameraPage
            key={key}
            snap={snap}
            courseId={r.courseId}
            active={i === stack.length - 1}
            onBack={pop}
            onPicker={() => push({ k: 'todoPicker', courseId: r.courseId, taskId: r.taskId })}
            onShot={(photos, cid) => onPhotos(photos, cid, r.taskId)}
          />
        )
      case 'todoPicker':
        return <PickerPage key={key} onBack={pop} onDone={(photos) => onPhotos(photos, r.courseId, r.taskId)} />
      case 'todoReview':
        return (
          <ReviewPage
            key={key}
            snap={snap}
            photos={r.photos}
            courseId={r.courseId}
            onBack={pop}
            onRetake={() => setStack((s) => (s.some((x) => x.k === 'todoCamera') ? s.filter((x) => x.k !== 'todoPicker' && x.k !== 'todoReview') : [...s.filter(notShot), { k: 'todoCamera', courseId: r.courseId }]))}
            onSaved={() => setStack([])}
          />
        )
      case 'manual':
        return <ManualAddPage key={key} snap={snap} onBack={pop} />
      case 'eduLogin': {
        return (
          <EduLoginPage
            key={key}
            plugin={DEFAULT_PLUGIN}
            onBack={pop}
            onDone={(kb, url) => {
              /* 原生拉到课表：登录页原地换预览页；没拉到（会话或学期没接上）退回内置浏览器，此时已登录 */
              if (kb) replaceTop({ k: 'eduPreview', out: kb.out, src: { school: DEFAULT_PLUGIN, pageUrl: kb.pageUrl, term: kb.term } })
              else replaceTop({ k: 'eduBrowser', startUrl: url })
            }}
          />
        )
      }
      case 'eduRelogin':
        return (
          <EduLoginPage
            key={key}
            plugin={r.plugin}
            onBack={pop}
            onDone={(kb, url) => {
              restoreEduSync()
              if (kb) pop()
              else replaceTop({ k: 'eduBrowser', startUrl: url, plugin: r.plugin })
            }}
          />
        )
      case 'eduBrowser':
        return (
          <EduBrowserPage
            key={key}
            plugin={r.plugin ?? DEFAULT_PLUGIN}
            startUrl={r.startUrl}
            active={i === stack.length - 1}
            onBack={pop}
            onImport={(out, src) => push({ k: 'eduPreview', out, src, over: true })}
            onFail={(info) => replaceTop({ k: 'eduFail', info })}
            onOther={() => replaceTop({ k: 'import' })}
          />
        )
      case 'eduPreview':
        return (
          <ImportRunPage
            key={key}
            rule={EDU_RULE}
            initialOut={r.out}
            overBrowser={r.over === true}
            syncSource={r.src}
            onBack={pop}
            /* 教务导入应用完：缺什么补什么（开学日期/称呼），都齐了直接回课表 */
            onDone={r.src && missingInfo(store.state.prefs) ? () => replaceTop({ k: 'completeInfo' }) : backToTimetable}
          />
        )
      case 'eduFail':
        return <EduFailPage key={key} info={r.info} onBack={pop} />
      case 'import':
        return (
          <ImportPage
            key={key}
            onBack={pop}
            onManual={() => push({ k: 'manual' })}
            onScan={() => push({ k: 'scan' })}
            onAi={() => push({ k: 'aiImport' })}
            onRule={() => push({ k: 'rule', rule: null })}
          />
        )
      case 'scan':
        return <ScanPage key={key} onBack={pop} onResult={(ruleId, text) => replaceTop({ k: 'importRun', ruleId, text })} />
      case 'aiImport':
        return <AiImportPage key={key} attach={r.attach} onBack={pop} onNext={(text) => push({ k: 'importRun', ruleId: 'builtin-json', text })} />
      case 'importRun': {
        const rule = store.state.savedRules.find((x) => x.id === r.ruleId)
        return rule ? <ImportRunPage key={key} rule={rule} initialText={r.text} autoRun={r.auto} onBack={pop} onDone={backToTimetable} /> : null
      }
      case 'rule':
        return <RuleEditorPage key={key} rule={r.rule} onBack={pop} />
      case 'semester':
        return <SemesterSettings key={key} sem={snap.semester} onBack={pop} onNew={() => push({ k: 'newSemester' })} onArchive={(id) => push({ k: 'archive', id })} onLogin={loginBoundSchool} />
      case 'archive': {
        const a = store.state.archives.find((x) => x.semester.id === r.id)
        return a ? <ArchivePage key={key} a={a} onBack={pop} /> : null
      }
      case 'newSemester':
        return <NewSemesterPage key={key} sem={snap.semester} onBack={pop} onDone={() => setStack([{ k: hasDirectLogin(DEFAULT_PLUGIN) ? 'eduLogin' : 'eduBrowser' }])} />
      case 'schedule':
        return <SchedulePage key={key} sem={snap.semester} onBack={pop} />
      case 'completeInfo':
        return <CompleteInfoPage key={key} onDone={backToTimetable} />
      case 'eduStatus':
        return <EduStatusPage key={key} onBack={pop} onLogin={loginBoundSchool} />
      case 'notif':
        return <NotifPrefPage key={key} onBack={pop} onPick={(pref) => push({ k: 'notifPick', pref })} />
      case 'calendarIntro':
        return <CalendarIntroPage key={key} onDone={pop} />
      case 'notifPick':
        return <PrefPickPage key={key} pref={r.pref} onBack={pop} />
      case 'widget':
        return <WidgetPage key={key} snap={snap} onBack={pop} />
      case 'theme':
        return <ThemePage key={key} onBack={pop} />
      case 'profile':
        return <ProfilePage key={key} onBack={pop} onPick={(t) => void pickPhoto(t)} />
      case 'photoPick':
        return <PickerPage key={key} single onBack={pop} onDone={(ps) => { applyPhoto(r.target, ps); pop() }} />
      case 'stats':
        return <StatsPage key={key} onBack={pop} onCourse={(c) => push({ k: 'course', course: c })} onTodo={() => { setStack([]); setTab(2) }} />
      case 'erase':
        return <ErasePage key={key} onBack={pop} onDone={eraseDone} />
      case 'about':
        return <AboutPage key={key} onBack={pop} onDebug={() => push({ k: 'debug' })} />
      case 'debug':
        return <DebugHub key={key} onBack={pop} onPage={(p: DebugPage) => push({ k: p })} />
      case 'debugOcr':
        return <OcrPage key={key} onBack={pop} />
      case 'debugEdu':
        return <EduPage key={key} onBack={pop} />
      case 'debugData':
        return <DataPage key={key} onBack={pop} />
      case 'debugEnv':
        return <EnvPage key={key} onBack={pop} />
      case 'courses':
        return (
          <CoursesPage
            key={key}
            onBack={pop}
            onDetail={(c) => push({ k: 'course', course: c })}
            onManual={() => push({ k: 'manual' })}
          />
        )
    }
}
