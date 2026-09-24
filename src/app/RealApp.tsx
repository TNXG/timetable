import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { App as CapApp } from '@capacitor/app'
import type { Occurrence } from '../domain/types'
import type { Snapshot } from '../domain/engine'
import { uid } from '../domain/store'
import { mondayOf, todayStr, defaultSemester } from './semester'
import { store, useStore } from './store'
import Onboarding from './Onboarding'
import { camera, nativeCamera, type CapturedPhoto } from './camera'
import { rememberPhoto } from './photo-src'
import { TodoView, ComposeOverlay, cameraLeave } from './todo'
import { TodayView } from './home/TodayView'
import { WeekView } from './home/WeekView'
import { useToday } from './home/hooks'
import { SearchPalette } from './search/SearchPalette'
import { SemesterPickSheet } from './me/Semester'
import { MeView } from './me/MeView'
import { CourseMenu, type CourseMenuState } from './menu'
import { renderRoute, notShot, type Route } from './routes'
import { DEFAULT_PLUGIN, hasDirectLogin } from '../domain/edu/plugin'
import { eduBack } from './edu/EduBrowserPage'
import { calendarPermission, calendarSupported, syncCalendar } from './calendar'
import { nativeToast } from './widgets'
import { shareIcs } from './files'
import { useDataSync } from './sync-effects'
import { useOnboard } from './onboard'
import type { PhotoTarget } from './me/ProfilePage'
import { Nav, SHEET, SLIDE, closeTopSheet } from './ui'

/* ---------------- 壳 ---------------- */

function Shell({ children, tab, onTab, navHidden }: { children: React.ReactNode; tab: number; onTab: (i: number) => void; navHidden?: boolean }) {
  return (
    <div data-shell className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-(--c-bg) font-sans text-(--c-ink)">
      {children}
      <Nav active={tab} onTab={onTab} hidden={navHidden} />
    </div>
  )
}

/* ---------------- 根 ---------------- */

export default function RealApp() {
  const state = useStore()
  const [tab, setTab] = useState(0)
  const today = useToday()
  const [anchor, setAnchor] = useState(today)
  const [weekAnchor, setWeekAnchor] = useState(today)
  /* 还锁在“今天”的视图跨零点后跟着日期走；用户自己翻到别的日子则不动 */
  const lastToday = useRef(today)
  useEffect(() => {
    const prev = lastToday.current
    if (prev === today) return
    lastToday.current = today
    setAnchor((a) => (a === prev ? today : a))
    setWeekAnchor((a) => (mondayOf(a) === mondayOf(prev) ? today : a))
  }, [today])
  const [stack, setStack] = useState<Route[]>([])
  const [menu, setMenu] = useState<CourseMenuState | null>(null)
  /* 关菜单走浮层自己的退场，退完再清状态；直接 setMenu(null) 会让它瞬间消失 */
  const menuDismiss = useRef<(() => void) | null>(null)
  const closeMenu = () => {
    if (menuDismiss.current) menuDismiss.current()
    else setMenu(null)
  }
  const [searching, setSearching] = useState(false)
  const [sharing, setSharing] = useState(false)
  /* 导出：有往期学期时先选学期，否则直接分享当前 */
  const share = () => {
    if (!store.state.semester) { nativeToast('先设置学期'); return }
    if (store.state.archives.length > 0) setSharing(true)
    else void shareIcs()
  }
  const [compose, setCompose] = useState<{ courseId?: string } | null>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  /* 手机日历与小组件跟着数据走：Store 一变就重写、重画；回前台对时；深链与 .ics 进对应页 */
  useDataSync(
    (nextTab, nextStack) => { setMenu(null); setTab(nextTab); setStack(nextStack) },
    (text) => { setMenu(null); setTab(3); setStack([{ k: 'importRun', ruleId: 'builtin-ics', text, auto: true }]) },
  )

  const rootRef = useRef<HTMLDivElement>(null)

  const snap = useMemo<Snapshot | null>(
    () => (state.semester ? { semester: state.semester, courses: state.courses, rules: state.rules, overrides: state.overrides, entries: state.entries } : null),
    [state],
  )
  /** 引导期间底下就把壳挂好，选完去向时内页推入不用等整个应用首次挂载 */
  const shellSnap = useMemo<Snapshot>(
    () => snap ?? { semester: defaultSemester(mondayOf(todayStr())), courses: [], rules: [], overrides: [], entries: [] },
    [snap],
  )

  /* 教务绑定：插件启用直登页时先应用内登录（账号密码+验证码），成功后原位换内置浏览器；
     没启用的学校仍直接进内置浏览器自己登录 */
  const openEduLogin = () => push(hasDirectLogin(DEFAULT_PLUGIN) ? { k: 'eduLogin' } : { k: 'eduBrowser' })

  const push = (r: Route) => { closeMenu(); setStack((s) => [...s, r]) }
  const pop = () => setStack((s) => s.slice(0, -1))
  /* 未识别页顶替浏览器页（会话已关）；预览页推在浏览器上方，退回时回到浏览器 */
  const replaceTop = (r: Route) => setStack((s) => [...s.slice(0, -1), r])
  const backToTimetable = () => { setStack([]); setTab(0) }
  /*
   * 拍完/选完：给已有待办直接加照片并退回；新待办把确认页推在相机上方。
   * 相机留在栈里：确认页从右侧盖上去，底下是定格的取景框；重拍就是退回去，不会出现一页退一页进交叉。
   */
  const onPhotos = (photos: CapturedPhoto[], courseId?: string, taskId?: string) => {
    if (taskId) {
      store.addPhotos(taskId, photos.map((p) => ({ id: uid(), path: p.path, w: p.width, h: p.height, takenAt: Date.now() })))
      setStack((s) => s.filter(notShot))
      return
    }
    setStack((s) => [...s, { k: 'todoReview', photos, courseId }])
  }
  const openCapture = (kind: 'camera' | 'text', courseId?: string) => {
    if (kind === 'camera') push({ k: 'todoCamera', courseId })
    else setCompose({ courseId })
  }
  /* 头像 / 背景：原生走相册页（单选），浏览器直接选文件；换掉的文件随手删 */
  const applyPhoto = (target: PhotoTarget, ps: CapturedPhoto[]) => {
    const p = ps[0]
    if (!p) return
    const old = store.state.prefs[target]
    const path = rememberPhoto(p).path
    store.setPrefs(target === 'avatar' ? { avatar: path } : { wall: path })
    if (old) void camera.remove([old])
  }
  const pickPhoto = async (target: PhotoTarget) => {
    if (nativeCamera()) push({ k: 'photoPick', target })
    else applyPhoto(target, await camera.pick())
  }
  const openCourseById = (id: string) => {
    const c = store.state.courses.find((x) => x.id === id)
    if (c) push({ k: 'course', course: c })
  }
  const openOccurrence = (o: Occurrence) => {
    if (o.courseId) openCourseById(o.courseId)
    else push({ k: 'session', occ: o })
  }

  /* 首次引导：完成条件、去向分发、清除后的重置 */
  const onboard = useOnboard({
    hasCourses: state.courses.length > 0,
    hasSemester: !!snap,
    stackLen: stack.length,
    resetToHome: backToTimetable,
    push,
    openEduLogin,
  })
  const { onboarded, onboardUnder, onboardDone, showOnboard, onboardBack, onOnboardDone, eraseDone } = onboard

  /* 有课表、还没拿到日历权限：每次启动推一次「加进手机日历」，拿到后全自动 */
  const calAsked = useRef(false)
  useEffect(() => {
    if (!onboarded || onboardUnder || stack.length > 0 || !calendarSupported() || calAsked.current) return
    if (state.courses.length === 0) return
    let alive = true
    void calendarPermission().then((p) => {
      if (!alive) return
      calAsked.current = true
      if (p === 'granted') void syncCalendar()
      else setStack((s) => (s.length === 0 ? [{ k: 'calendarIntro' }] : s))
    })
    return () => { alive = false }
  }, [onboarded, onboardUnder, stack.length, state.courses.length])

  /* 系统返回：先关浮层，再退内页，再回今天；引导期间退上一步 */
  const backRef = useRef<() => boolean>(() => false)
  backRef.current = () => {
    if (menu) { closeMenu(); return true }
    if (compose) { setCompose(null); return true }
    if (closeTopSheet()) return true
    if (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (top.k === 'todoCamera' && cameraLeave.current) void cameraLeave.current().then(pop)
      else if (top.k === 'eduBrowser' && eduBack.current) void eduBack.current()
      else setStack((s) => s.slice(0, -1))
      return true
    }
    if (showOnboard && !onboardUnder) return onboardBack.current()
    if (searching) { setSearching(false); return true }
    if (tab !== 0) { setTab(0); return true }
    return false
  }
  /* 栏空后再按一次才退出 */
  const exitArmed = useRef(0)
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      if (backRef.current()) { exitArmed.current = 0; return }
      const t = Date.now()
      if (t - exitArmed.current < 2000) { void CapApp.exitApp(); return }
      exitArmed.current = t
      nativeToast('再按一次退出')
    })
    return () => void h.then((x) => x.remove())
  }, [])

  const renderApp = (snap: Snapshot) => {
    const routeCtx = { snap, stack, compose, pop, push, replaceTop, setStack, backToTimetable, openCourseById, openCapture, onPhotos, applyPhoto, pickPhoto, eraseDone, openEduLogin, setTab }
    return (
    <Shell tab={tab} onTab={(i) => { setStack([]); setTab(i) }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          data-veil-host
          className="relative flex flex-1 flex-col overflow-hidden"
        >
          {tab === 0 && (
            <TodayView
              snap={snap}
              anchor={anchor}
              setAnchor={setAnchor}
              onPick={openOccurrence}
              onMenu={(o, a, el) => setMenu({ occ: o, anchor: a, ghost: { el, rect: a, radius: 16, scale: 1.03, bg: 'var(--c-surface)' } })}
              liftKey={menu?.occ.key}
              onSearch={() => setSearching(true)}
              onImport={openEduLogin}
              onManual={() => push({ k: 'manual' })}
              onSemester={() => push({ k: 'semester' })}
              onNewSemester={() => push({ k: 'newSemester' })}
              onCapture={openCapture}
            />
          )}
          {tab === 1 && (
            <WeekView
              snap={snap}
              anchor={weekAnchor}
              setAnchor={setWeekAnchor}
              onPick={openOccurrence}
              onMenu={(o, a, el) => setMenu({ occ: o, anchor: a, ghost: { el, rect: a, color: o.color, radius: 9, scale: 1.06, overhang: true } })}
              liftKey={menu?.occ.key}
              onSearch={() => setSearching(true)}
            />
          )}
          {tab === 2 && (
            <TodoView
              snap={snap}
              composing={compose != null && compose.courseId == null}
              onOpen={(t) => push({ k: 'todoDetail', task: t })}
              onCamera={() => push({ k: 'todoCamera' })}
              onText={() => setCompose({})}
            />
          )}
          {tab === 3 && <MeView onPage={(p) => { if (p === 'share') share(); else if (p === 'import') openEduLogin(); else push({ k: p } as Route) }} />}
        </motion.div>
      </AnimatePresence>

      {sharing && snap && (
        <SemesterPickSheet
          title="分享哪个学期？"
          action="分享"
          options={[snap, ...[...store.state.archives].reverse()]}
          onPick={(s) => void shareIcs(s)}
          onClose={() => setSharing(false)}
        />
      )}

      {/* 搜索：盖在 Tab 上的浮层（淡入带一点上浮），位于内页之下：从搜索点进课程再返回，回到的是搜索 */}
      <AnimatePresence>
        {searching && (
          <motion.div
            key="search"
            initial={{ opacity: 0, transform: 'translateY(14px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(10px)' }}
            transition={SHEET}
            className="absolute inset-0 z-[35] flex flex-col bg-(--c-bg) will-change-transform"
          >
            <SearchPalette
              state={state}
              onClose={() => setSearching(false)}
              onPickCourse={(c) => push({ k: 'course', course: c })}
              onPickTask={(t) => { setSearching(false); push({ k: 'todoDetail', task: t }) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compose && (
          <ComposeOverlay
            key="compose"
            snap={snap}
            courseId={compose.courseId}
            onClose={() => setCompose(null)}
            onCamera={() => { const cid = compose.courseId; setCompose(null); push({ k: 'todoCamera', courseId: cid }) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{stack.map((r, i) => renderRoute(r, i, routeCtx))}</AnimatePresence>

      <CourseMenu menu={menu} menuDismiss={menuDismiss} onClose={() => setMenu(null)} push={push} />

    </Shell>
    )
  }

  return (
    <div ref={rootRef} className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-(--c-bg)">
      {renderApp(shellSnap)}
      <AnimatePresence initial={false}>
        {showOnboard && (
          <motion.div
            key="onboarding"
            exit={onboardUnder ? { opacity: 1 } : { transform: 'translateX(-28%)', opacity: 0 }}
            transition={onboardUnder ? { duration: 0 } : SLIDE}
            className={`absolute inset-0 ${onboardUnder ? 'z-[35]' : 'z-[90]'}`}
            style={{ visibility: onboardDone ? 'hidden' : 'visible' }}
          >
            <Onboarding
              backRef={onboardBack}
              onDone={onOnboardDone}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
