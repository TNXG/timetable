import RightLine from "~icons/mingcute/right-line";
import SearchLine from "~icons/mingcute/search-line";
import React from "react";
import { Page } from "./sheet";
import { TopBar } from "./veil";

export function PopHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-3.5 pt-1 pb-2.5">
      <div className="truncate text-[12.5px] font-medium text-(--c-ink4)">
        {title}
        {sub ? `\u3000${sub}` : ""}
      </div>
    </div>
  );
}

export function PopItem({ icon, title, danger, onClick }: { icon: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-2 flex w-[calc(100%-16px)] items-center rounded-[11px] px-2.5 py-2.25 text-left transition-colors active:bg-(--c-surface2)"
    >
      <span className={`mr-3 flex h-4.25 w-4.25 flex-none items-center justify-center ${danger ? "text-(--c-danger)" : "text-(--c-ink2)"}`}>{icon}</span>
      <span className={`truncate text-[14px] font-medium ${danger ? "text-(--c-danger)" : "text-(--c-ink)"}`}>{title}</span>
    </button>
  );
}


/** 右侧箭头：列表行通用 */
export function Chevron({ size = 13, className = "" }: { size?: number; className?: string }) {
  return <RightLine width={size} height={size} className={`flex-none ${className}`} />;
}

/** 标题行右侧的搜索按钮：今天、周视图共用 */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface) transition-transform duration-150 active:scale-[.92]">
      <SearchLine className="h-4 w-4 text-(--c-ink2)" />
    </button>
  );
}

/** 内页通用布局：TopBar + 滚动区 */
export function SubPage({ title, sub, onBack, children }: { title: string; sub?: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 scrollbar-none">
        <TopBar title={title} sub={sub} onBack={onBack} />
        <div className="mt-6">{children}</div>
      </div>
    </Page>
  );
}

/** 单选行：教务选学期、分享选学期同一套样式 */
export function RadioRow({ on, onClick, children, right }: { on: boolean; onClick?: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center rounded-xl px-3.5 py-3 text-left" style={{ background: on ? "var(--c-accent-soft)" : "var(--c-row-muted)", boxShadow: on ? "inset 0 0 0 1.5px var(--c-accent)" : undefined }}>
      <span className="mr-3 flex h-4.25 w-4.25 flex-none items-center justify-center rounded-full border-[1.8px]" style={{ borderColor: on ? "var(--c-accent)" : "var(--c-radio-border)", background: on ? "var(--c-accent)" : "transparent" }}>
        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6"><path d="m6 12.5 4 4 8-9" /></svg>}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[13.5px] font-bold text-(--c-ink) ${on ? "" : "opacity-55"}`}>{children}</span>
      {right != null && <span className={`ml-3 flex-none text-[12.5px] font-semibold tabular-nums text-(--c-ink4) ${on ? "" : "opacity-55"}`}>{right}</span>}
    </button>
  );
}
