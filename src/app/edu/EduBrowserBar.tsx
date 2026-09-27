import LockLine from "~icons/mingcute/lock-line";
import CloseLine from "~icons/mingcute/close-line";
import Refresh2Line from "~icons/mingcute/refresh-2-line";
import More1Line from "~icons/mingcute/more-1-line";
/** 教务浏览器顶栏：返回、地址与加载进度、停止/刷新、更多菜单入口 */
import type { EduNav } from "../edu-browser";
import { hostOf } from "../../domain/edu/systems";
import { edu } from "../edu-browser";
import { BackButton } from "../ui";
import { LoadFill } from "./LoadFill";

export function EduBrowserBar({ nav, onBack, onMenu }: {
  nav: EduNav;
  onBack: () => void;
  onMenu: () => void;
}) {
  const secure = /^https:/i.test(nav.url);
  return (
    <div className="flex items-center gap-3 bg-(--c-bg) px-5 pt-[max(52px,calc(env(safe-area-inset-top)+22px))] pb-4">
      <BackButton onClick={onBack} />
      <div className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-(--c-surface) px-4">
        <LoadFill loading={nav.loading} progress={nav.progress} />
        {secure && (
          <LockLine width="11" height="11" className="relative mr-2 flex-none" style={{ color: "var(--c-ink4)" }} />
        )}
        <span className="relative min-w-0 flex-1 truncate text-[12.5px] font-semibold text-(--c-ink2)">{hostOf(nav.url)}</span>
      </div>
      {/* 加载中是“停止”，加载完是“刷新” */}
      <button
        onClick={() => void (nav.loading ? edu.stop() : edu.reload())}
        aria-label={nav.loading ? "停止" : "刷新"}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
      >
        {nav.loading
          ? (
              <CloseLine width="14" height="14" style={{ color: "var(--c-ink)" }} />
            )
          : (
              <Refresh2Line width="14" height="14" style={{ color: "var(--c-ink)" }} />
            )}
      </button>
      <button
        onClick={onMenu}
        aria-label="更多"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]"
      >
        <More1Line width="16" height="16" style={{ color: "var(--c-ink)" }} />
      </button>
    </div>
  );
}
