import type { PluginListenerHandle } from "@capacitor/core";
import { Capacitor, registerPlugin } from "@capacitor/core";

/* 课表文件导入与诊断文本分享 */

interface IncomingFile {
  text?: string;
  name?: string;
}

interface TtFilesPlugin {
  share: (o: { text: string; name: string; mime: string }) => Promise<void>;
  takeIncoming: () => Promise<IncomingFile>;
  addListener: (event: "incoming", fn: (f: IncomingFile) => void) => Promise<PluginListenerHandle>;
}

const TtFiles = registerPlugin<TtFilesPlugin>("TtFiles");

export const filesSupported = () => Capacitor.getPlatform() === "android";


/** 任意文本文件走系统分享面板；浏览器里直接下载 */
export async function shareText(f: { text: string; name: string }, mime: string): Promise<void> {
  if (!filesSupported()) {
    const blob = new Blob([f.text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  await TtFiles.share({ text: f.text, name: f.name, mime });
}

function isCalendarText(text: string | undefined): text is string {
  return !!text && /BEGIN:VCALENDAR/i.test(text.slice(0, 2048));
}

/** 有人用课程表打开了 .ics：启动时带进来的那份立刻给，之后到的持续给 */
export function onIncomingIcs(fn: (text: string) => void): () => void {
  if (!filesSupported())
    return () => undefined;
  let handle: PluginListenerHandle | null = null;
  let off = false;
  TtFiles.addListener("incoming", (f) => {
    if (isCalendarText(f.text))
      fn(f.text);
  }).then((h) => {
    if (off)
      h.remove();
    else handle = h;
    // 监听挂上后再取，启动时带进来的文件不会丢
    TtFiles.takeIncoming().then((f) => {
      if (!off && isCalendarText(f.text))
        fn(f.text);
    }).catch(() => undefined);
  }).catch(() => undefined);
  return () => {
    off = true;
    handle?.remove();
  };
}
