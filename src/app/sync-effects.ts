import type { Route } from "./routes";
import { App as CapApp } from "@capacitor/app";
/** 数据跟随：按已保存的选择同步手机日历，小组件独立刷新；回前台对时；深链与 .ics 进对应页。 */
import { useEffect, useRef } from "react";
import { refreshReminderStatus, scheduleReminderSync, syncReminders } from "./reminder-service";
import { outcomeText, resumeSync } from "./edu-sync";
import { onIncomingIcs } from "./files";
import { store } from "./store";
import { nativeToast, syncWidgets } from "./widgets";

export function useDataSync(go: (tab: number, stack: Route[]) => void, onIcs: (text: string) => void) {
  /* 这两个回调只取最新一份：监听只挂一次，不随它们换身份重挂 */
  const goRef = useRef(go);
  const onIcsRef = useRef(onIcs);
  useEffect(() => {
    goRef.current = go;
    onIcsRef.current = onIcs;
  });

  useEffect(() => {
    let timer: number | null = null;
    const run = () => {
      scheduleReminderSync();
      if (timer != null)
        window.clearTimeout(timer);
      timer = window.setTimeout(() => void syncWidgets(), 400);
    };
    run();
    const off = store.subscribe(run);
    const onResume = CapApp.addListener("resume", () => {
      void syncReminders();
      void refreshReminderStatus();
      void syncWidgets();
      void resumeSync()?.then((o) => {
        if (o.result === "ok" || o.note)
          nativeToast(outcomeText(o));
      });
    });
    /* 通知与日历链接共用同一跳转；冷启动也消费入口 Intent。 */
    const openUrl = ({ url }: { url: string }) => {
      const m = /^timetable:\/\/open\/(course|task|day)\/([^/?#]+)/.exec(url);
      if (!m)
        return;
      const [, kind, id] = m;
      if (kind === "course") {
        const c = store.state.courses.find(x => x.id === id);
        goRef.current(0, c ? [{ k: "course", course: c }] : []);
      } else if (kind === "task") {
        const t = store.state.tasks.find(x => x.id === id);
        goRef.current(2, t ? [{ k: "todoDetail", task: t }] : []);
      } else {
        goRef.current(0, []);
      }
    };
    const onUrl = CapApp.addListener("appUrlOpen", openUrl);
    let alive = true;
    void CapApp.getLaunchUrl().then(value => { if (alive && value) openUrl(value); });
    /* 别人发来的 .ics 用课程表打开：直接进导入预览 */
    const offIcs = onIncomingIcs(text => onIcsRef.current(text));
    return () => {
      alive = false;
      off();
      offIcs();
      if (timer != null)
        window.clearTimeout(timer);
      void onResume.then(h => h.remove());
      void onUrl.then(h => h.remove());
    };
  }, []);
}
