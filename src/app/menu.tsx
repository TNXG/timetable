import type { RefObject } from "react";
import type { Occurrence, OverrideKind } from "../domain/types";
import type { Route } from "./routes";
import type { Ghost, Rect } from "./ui";
/** 长按课程菜单：浮层退场由 dismissRef 控制，退完再清状态；直接 setMenu(null) 会让它瞬间消失 */
import { AnimatePresence } from "motion/react";
import Delete2Line from "~icons/mingcute/delete-2-line";
import Edit2Line from "~icons/mingcute/edit-2-line";
import FileLine from "~icons/mingcute/file-line";
import ForbidCircleLine from "~icons/mingcute/forbid-circle-line";
import InformationLine from "~icons/mingcute/information-line";
import NotificationLine from "~icons/mingcute/notification-line";
import RestoreLine from "~icons/mingcute/restore-line";
import TimeLine from "~icons/mingcute/time-line";
import { fmtMinutes } from "../domain/dates";
import { uid } from "../domain/store";
import { store } from "./store";
import { PopHead, PopItem, Popover } from "./ui";
import { haptic, nativeToast } from "./widgets";

export interface CourseMenuState {
  occ: Occurrence;
  anchor: Rect;
  ghost: Ghost;
}

export function CourseMenu({ menu, menuDismiss, onClose, push }: { menu: CourseMenuState | null; menuDismiss: RefObject<(() => void) | null>; onClose: () => void; push: (r: Route) => void }) {
  const mo = menu?.occ;
  const ovr = (kind: OverrideKind) => {
    if (!mo?.ruleId)
      return;
    store.addOverride({ id: uid(), kind, date: mo.date, ruleId: mo.ruleId, createdAt: Date.now() });
    onClose();
    haptic(kind === "cancelled" ? "warning" : "light");
    nativeToast(kind === "cancelled" ? "本节已停课" : kind === "leave" ? "已请假" : "本节已静音");
  };
  const restore = () => {
    if (!mo?.ruleId)
      return;
    store.removeOverride(mo.ruleId, mo.date);
    onClose();
    haptic("light");
    nativeToast("已恢复");
  };
  const undoTitle = mo
    ? mo.status === "leave"
      ? "取消请假"
      : mo.status === "cancelled"
        ? "恢复上课"
        : mo.status === "moved"
          ? "恢复原时间"
          : null
    : null;

  return (
    <AnimatePresence>
      {menu && mo && (
        <Popover key={menu.occ.key} anchor={menu.anchor} ghost={menu.ghost} dismissRef={menuDismiss} onClose={onClose}>
          <PopHead title={mo.name} sub={fmtMinutes(mo.start)} />
          {mo.ruleId && undoTitle && <PopItem icon={<RestoreLine />} title={undoTitle} onClick={restore} />}
          {mo.ruleId && mo.status === "normal" && <PopItem icon={<FileLine />} title="请假一次" onClick={() => ovr("leave")} />}
          {mo.ruleId && mo.status === "normal" && <PopItem icon={<NotificationLine />} title={mo.muted ? "取消静音" : "静音本节"} onClick={() => (mo.muted ? restore() : ovr("muted"))} />}
          {mo.ruleId && mo.status !== "cancelled" && <PopItem icon={<TimeLine />} title="调整时间" onClick={() => push({ k: "session", occ: mo })} />}
          {mo.conflict && <PopItem icon={<InformationLine />} title="查看冲突" onClick={() => push({ k: "conflict", occ: mo })} />}
          {mo.courseId && (
            <PopItem
              icon={<Edit2Line />}
              title="编辑课程"
              onClick={() => {
                const c = store.state.courses.find(x => x.id === mo.courseId);
                if (c)
                  push({ k: "courseEdit", course: c });
                else onClose();
              }}
            />
          )}
          {mo.ruleId && mo.status === "normal" && <PopItem icon={<ForbidCircleLine />} title="本节停课" danger onClick={() => ovr("cancelled")} />}
          {mo.entryId && <PopItem icon={<Delete2Line />} title="删除这条安排" danger onClick={() => { store.removeEntry(mo.entryId!); onClose(); haptic("warning"); nativeToast("已删除"); }} />}
        </Popover>
      )}
    </AnimatePresence>
  );
}
