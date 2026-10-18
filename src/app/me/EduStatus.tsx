/** 已登录的教务账号管理。 */
import { useRef, useState } from "react";
import RefreshLine from "~icons/mingcute/refresh-1-line";
import RightLine from "~icons/mingcute/right-line";
import { termLabel } from "../../domain/edu/zhengfang";
import { eduSyncing, logoutEduSync, outcomeText, setEduSyncEnabled, statusText, syncNow, useEduSync } from "../edu-sync";
import { Loader, SubPage, Switch } from "../ui";
import { haptic, nativeConfirm, nativeToast } from "../widgets";

export function EduStatusPage({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <SubPage title="教务账号" onBack={onBack}>
      <EduSyncGroup onLogin={onLogin} onLogout={onBack} />
    </SubPage>
  );
}

/** 教务账号卡：点卡片检查课表，左滑退出；自动更新只控制后台检查。 */
function EduSyncGroup({ onLogin, onLogout }: { onLogin: () => void; onLogout: () => void }) {
  const s = useEduSync();
  const [busy, setBusy] = useState(eduSyncing);
  const [revealed, setRevealed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const touchXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  if (!s)
    return null;
  const status = statusText(s);
  const expired = s.lastResult === "expired";
  const update = async () => {
    if (busy || loggingOut)
      return;
    setBusy(true);
    try {
      const o = await syncNow();
      if (o.result === "expired") {
        onLogin();
        return;
      }
      haptic(o.result === "ok" || o.result === "nochange" ? "success" : "error");
      nativeToast(outcomeText(o));
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (loggingOut)
      return;
    const ok = await nativeConfirm({ title: "退出登录", message: `清除${s.school.name}的登录会话及保存的密码`, ok: "退出" });
    if (!ok)
      return;
    setLoggingOut(true);
    try {
      await logoutEduSync();
      haptic("warning");
      nativeToast("已退出登录");
      onLogout();
    } catch (e) {
      nativeToast(e instanceof Error ? e.message : "退出登录失败");
    } finally {
      setLoggingOut(false);
    }
  };
  return (
    <div className="mt-6">
      <div className="relative overflow-hidden rounded-[18px] bg-(--c-surface)">
        <button
          type="button"
          onClick={() => void logout()}
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-(--c-danger) text-[13px] font-bold text-white"
        >
          退出登录
        </button>
        <div
          className="relative bg-(--c-surface) transition-transform duration-200"
          style={{ transform: revealed ? "translateX(-96px)" : "translateX(0)" }}
          onTouchStart={(e) => { touchXRef.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchXRef.current === null)
              return;
            const dx = e.changedTouches[0].clientX - touchXRef.current;
            touchXRef.current = null;
            if (Math.abs(dx) > 35) {
              suppressClickRef.current = true;
              setRevealed(dx < 0);
            }
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              if (revealed) { setRevealed(false); return; }
              if (expired)
                onLogin();
              else void update();
            }}
            aria-label={`${s.school.name}，${status.text}，${expired ? "重新登录" : "检查课表"}`}
            className="flex w-full items-start gap-3 px-4 pt-4 pb-3 text-left transition-colors active:bg-(--c-surface2)"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-(--c-ink)">{s.school.name}</div>
              {s.term && <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">{termLabel(s.term)}</div>}
              <div className={`mt-2 text-[12.5px] font-medium ${status.danger || s.lastResult === "error" ? "text-(--c-danger)" : "text-(--c-ink3)"}`}>{status.text}</div>
              {(s.lastResult === "error" || expired) && s.lastMessage && <div className="mt-1 text-[11.5px] font-medium text-(--c-danger)">{s.lastMessage}</div>}
            </div>
            <div className="flex flex-none items-center gap-1 pt-0.5 text-[12px] font-semibold text-(--c-accent)">
              {busy
                ? <Loader size={17} />
                : expired
                  ? (
                      <>
                        重新登录
                        <RightLine width={15} height={15} />
                      </>
                    )
                  : (
                      <>
                        检查课表
                        <RefreshLine width={15} height={15} />
                      </>
                    )}
            </div>
          </button>
          <div className="mx-4 flex items-center border-t border-(--c-surface2) py-3">
            <span className="min-w-0 flex-1 text-[12.5px] font-medium text-(--c-ink3)">{busy ? "正在更新课表" : "自动更新课表"}</span>
            <Switch on={s.enabled} onChange={setEduSyncEnabled} />
          </div>
        </div>
      </div>
    </div>
  );
}
