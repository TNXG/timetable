/** 长按课程菜单：浮层退场由 dismissRef 控制，退完再清状态；直接 setMenu(null) 会让它瞬间消失 */
import { AnimatePresence } from 'motion/react'
import type { RefObject } from 'react'
import type { Occurrence, OverrideKind } from '../domain/types'
import { fmtMinutes } from '../domain/dates'
import { uid } from '../domain/store'
import { store } from './store'
import { haptic, nativeToast } from './widgets'
import { ICON, PopHead, PopItem, Popover, type Ghost, type Rect } from './ui'
import type { Route } from './routes'

export interface CourseMenuState {
  occ: Occurrence
  anchor: Rect
  ghost: Ghost
}

export function CourseMenu({ menu, menuDismiss, onClose, push }: { menu: CourseMenuState | null; menuDismiss: RefObject<(() => void) | null>; onClose: () => void; push: (r: Route) => void }) {
  const mo = menu?.occ
  const ovr = (kind: OverrideKind) => {
    if (!mo?.ruleId) return
    store.addOverride({ id: uid(), kind, date: mo.date, ruleId: mo.ruleId, createdAt: Date.now() })
    onClose()
    haptic(kind === 'cancelled' ? 'warning' : 'light')
    nativeToast(kind === 'cancelled' ? '本节已停课' : kind === 'leave' ? '已请假' : '本节已静音')
  }
  const restore = () => {
    if (!mo?.ruleId) return
    store.removeOverride(mo.ruleId, mo.date)
    onClose()
    haptic('light')
    nativeToast('已恢复')
  }
  const undoTitle = mo
    ? mo.status === 'leave' ? '取消请假'
      : mo.status === 'cancelled' ? '恢复上课'
      : mo.status === 'moved' ? '恢复原时间'
      : null
    : null

  return (
    <AnimatePresence>
      {menu && mo && (
        <Popover key={menu.occ.key} anchor={menu.anchor} ghost={menu.ghost} dismissRef={menuDismiss} onClose={onClose}>
          <PopHead title={mo.name} sub={fmtMinutes(mo.start)} />
          {mo.ruleId && undoTitle && <PopItem icon={ICON.undo} title={undoTitle} onClick={restore} />}
          {mo.ruleId && mo.status === 'normal' && <PopItem icon={ICON.leave} title="请假一次" onClick={() => ovr('leave')} />}
          {mo.ruleId && mo.status === 'normal' && <PopItem icon={ICON.bell} title={mo.muted ? '取消静音' : '静音本节'} onClick={() => (mo.muted ? restore() : ovr('muted'))} />}
          {mo.ruleId && mo.status !== 'cancelled' && <PopItem icon={ICON.clock} title="调整时间" onClick={() => push({ k: 'session', occ: mo })} />}
          {mo.conflict && <PopItem icon={ICON.info} title="查看冲突" onClick={() => push({ k: 'conflict', occ: mo })} />}
          {mo.courseId && (
            <PopItem
              icon={ICON.edit}
              title="编辑课程"
              onClick={() => {
                const c = store.state.courses.find((x) => x.id === mo.courseId)
                if (c) push({ k: 'courseEdit', course: c })
                else onClose()
              }}
            />
          )}
          {mo.ruleId && mo.status === 'normal' && <PopItem icon={ICON.ban} title="本节停课" danger onClick={() => ovr('cancelled')} />}
          {mo.entryId && <PopItem icon={ICON.trash} title="删除这条安排" danger onClick={() => { store.removeEntry(mo.entryId!); onClose(); haptic('warning'); nativeToast('已删除') }} />}
        </Popover>
      )}
    </AnimatePresence>
  )
}
