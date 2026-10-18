/** 清除数据：本机课表、作业和系统日历里应用建的日历一并删掉，回到初始状态 */
import { useState } from "react";
import { clearReminders } from "../reminder-service";
import { camera } from "../camera";
import { logoutEduSync } from "../edu-sync";
import { store } from "../store";
import { Page, PrimaryButton, TopBar } from "../ui";
import { syncWidgets } from "../widgets";

/* 清除数据：本机课表、作业和系统日历里应用建的日历一并删掉，回到初始状态 */
export function ErasePage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    if (busy)
      return;
    setBusy(true);
    setError("");
    try {
      const s = store.state;
      const paths = [...s.tasks.flatMap(t => t.photos?.map(p => p.path) ?? []), s.prefs.avatar, s.prefs.wall].filter(Boolean);
      await clearReminders();
      await camera.remove(paths);
      await logoutEduSync();
      store.reset();
      await syncWidgets();
      onDone();
    } catch {
      setError("清除失败，数据已保留");
      setBusy(false);
    }
  };
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 scrollbar-none">
        <TopBar title="清除数据" sub="卸载应用不会移除系统日历中的内容。" onBack={onBack} />
        <div className="mt-6 rounded-[18px] bg-(--c-surface) px-4">
          {["课表、课程和调整", "作业和照片", "教务账号与登录凭据", "系统日历中由本应用创建的日历"].map((t, i) => (
            <div key={t} className={`py-3.5 text-[14px] font-semibold text-(--c-ink) ${i ? "border-t border-(--c-surface2)" : ""}`}>{t}</div>
          ))}
        </div>
        {error && <div role="alert" className="mt-3 text-[12px] text-(--c-rose)">{error}</div>}
      </div>
      <div className="flex-none px-5 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <PrimaryButton tone="danger" busy={busy} onClick={() => void run()}>清除全部数据</PrimaryButton>
      </div>
    </Page>
  );
}
