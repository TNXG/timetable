import type { Route } from "./routes";
import { App as CapApp } from "@capacitor/app";
/** 数据跟随：Store 一变就重写手机日历与小组件；回前台对时；日历深链与别人发来的 .ics 进对应页 */
import { useEffect, useRef } from "react";
import { scheduleCalendarSync, syncCalendar } from "./calendar";
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
      scheduleCalendarSync();
      if (timer != null)
        window.clearTimeout(timer);
      timer = window.setTimeout(() => void syncWidgets(), 400);
    };
    run();
    const off = store.subscribe(run);
    const onResume = CapApp.addListener("resume", () => {
      void syncCalendar();
      void syncWidgets();
      void resumeSync()?.then((o) => {
        if (o.result === "ok" || o.note)
          nativeToast(outcomeText(o));
      });
    });
    /* 日历事件里的「在应用中打开」 */
    const onUrl = CapApp.addListener("appUrlOpen", ({ url }) => {
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
    });
    /* 别人发来的 .ics 用课程表打开：直接进导入预览 */
    const offIcs = onIncomingIcs(text => onIcsRef.current(text));
    return () => {
      off();
      offIcs();
      if (timer != null)
        window.clearTimeout(timer);
      void onResume.then(h => h.remove());
      void onUrl.then(h => h.remove());
    };
  }, []);
}
