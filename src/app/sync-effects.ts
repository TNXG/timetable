/** 数据跟随：Store 一变就重写手机日历与小组件；回前台对时；日历深链与别人发来的 .ics 进对应页 */
import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { store } from './store'
import { scheduleCalendarSync, syncCalendar } from './calendar'
import { nativeToast, syncWidgets } from './widgets'
import { onIncomingIcs } from './files'
import { outcomeText, resumeSync } from './edu-sync'
import type { Route } from './routes'

export function useDataSync(go: (tab: number, stack: Route[]) => void, onIcs: (text: string) => void) {
  useEffect(() => {
    let timer: number | null = null
    const run = () => {
      scheduleCalendarSync()
      if (timer != null) window.clearTimeout(timer)
      timer = window.setTimeout(() => void syncWidgets(), 400)
    }
    run()
    const off = store.subscribe(run)
    const onResume = CapApp.addListener('resume', () => {
      void syncCalendar()
      void syncWidgets()
      void resumeSync()?.then((o) => {
        if (o.result === 'ok' || o.note) nativeToast(outcomeText(o))
      })
    })
    /* 日历事件里的「在应用中打开」 */
    const onUrl = CapApp.addListener('appUrlOpen', ({ url }) => {
      const m = /^timetable:\/\/open\/(course|task|day)\/([^/?#]+)/.exec(url)
      if (!m) return
      const [, kind, id] = m
      if (kind === 'course') {
        const c = store.state.courses.find((x) => x.id === id)
        go(0, c ? [{ k: 'course', course: c }] : [])
      } else if (kind === 'task') {
        const t = store.state.tasks.find((x) => x.id === id)
        go(2, t ? [{ k: 'todoDetail', task: t }] : [])
      } else {
        go(0, [])
      }
    })
    /* 别人发来的 .ics 用课程表打开：直接进导入预览 */
    const offIcs = onIncomingIcs((text) => onIcs(text))
    return () => {
      off()
      offIcs()
      if (timer != null) window.clearTimeout(timer)
      void onResume.then((h) => h.remove())
      void onUrl.then((h) => h.remove())
    }
  }, [])
}
