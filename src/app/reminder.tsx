import type { Minutes, Prefs, ReminderMethod } from "../domain/types";
import { useEffect, useRef, useState } from "react";
import RightLine from "~icons/mingcute/right-line";
import { CLASS_LEADS, EARLY_LEADS, TASK_LEADS } from "../domain/types";
import { REMINDER_METHODS, refreshReminderStatus, scheduleReminderSync, setReminderMethod, useReminderStatus } from "./reminder-service";
import { openNotificationSettings } from "./notifications";
import { store, useStore } from "./store";
import { Page, PrimaryButton, Switch, TextAction, Tick, TopBar } from "./ui";

/* 提醒方式统一管理，提醒时机由两种通道共用。 */

type PrefKey = "classLead" | "earlyLead" | "taskLeads" | "examDays";

interface Option {
  label: string;
  patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>);
  match: (p: Prefs) => boolean;
}

export const leadLabel = (m: Minutes) => (m % 1440 === 0 ? `${m / 1440} 天` : m % 60 === 0 ? `${m / 60} 小时` : `${m} 分钟`);


/** 「7 天、3 天、1 天及当天」 */
const examDaysLabel = (days: number[]) => {
  if (days.length === 0)
    return "不提醒";
  const ahead = [...days].filter(d => d > 0).sort((a, b) => b - a).map(d => `${d} 天`).join("、");
  const today = days.includes(0);
  return ahead ? (today ? `${ahead}及当天` : ahead) : "当天";
};

const OPTIONS: Record<PrefKey, { title: string; sub?: string; multi?: boolean; options: Option[] }> = {
  classLead: {
    title: "上课前提醒",
    options: CLASS_LEADS.map(n => ({
      label: `${n} 分钟`,
      patch: { classLead: n },
      match: p => p.classLead === n,
    })),
  },
  earlyLead: {
    title: "首节课额外提醒",
    options: EARLY_LEADS.map(n => ({
      label: n === 0 ? "不提醒" : `${n} 分钟`,
      patch: { earlyLead: n },
      match: p => p.earlyLead === n,
    })),
  },
  taskLeads: {
    title: "作业截止前",
    multi: true,
    options: TASK_LEADS.map(m => ({
      label: leadLabel(m),
      patch: (p: Prefs) => ({ taskLeads: p.taskLeads.includes(m) ? p.taskLeads.filter(x => x !== m) : [...p.taskLeads, m] }),
      match: (p: Prefs) => p.taskLeads.includes(m),
    })),
  },
  examDays: {
    title: "考试前",
    options: [
      { label: "7 天、3 天、1 天及当天", patch: { examDays: [7, 3, 1, 0] }, match: p => p.examDays.join() === "7,3,1,0" },
      { label: "3 天、1 天及当天", patch: { examDays: [3, 1, 0] }, match: p => p.examDays.join() === "3,1,0" },
      { label: "1 天及当天", patch: { examDays: [1, 0] }, match: p => p.examDays.join() === "1,0" },
      { label: "当天", patch: { examDays: [0] }, match: p => p.examDays.join() === "0" },
      { label: "不提醒", patch: { examDays: [] }, match: p => p.examDays.length === 0 },
    ],
  },
};

function valueOf(key: PrefKey, p: Prefs): string {
  if (key === "taskLeads")
    return p.taskLeads.length === 0 ? "不提醒" : [...p.taskLeads].sort((a, b) => b - a).map(leadLabel).join("、");
  if (key === "examDays")
    return examDaysLabel(p.examDays);
  const hit = OPTIONS[key].options.find(o => o.match(p));
  return hit ? hit.label : "—";
}

const GROUPS: [string, PrefKey[]][] = [
  ["上课", ["classLead", "earlyLead"]],
  ["作业与考试", ["taskLeads", "examDays"]],
];

const rowCls = (i: number) => `flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? "border-t border-(--c-surface2)" : ""}`;

const Chevron = () => (
  <RightLine width="13" height="13" className="ml-2" style={{ color: "var(--c-ink5)" }} />
);

function MethodPicker({ selected, onSelect, disabled }: { selected: ReminderMethod; onSelect: (method: ReminderMethod) => void; disabled: boolean }) {
  return (
    <fieldset disabled={disabled} className="mt-6 rounded-[18px] bg-(--c-surface) px-4">
      <legend className="sr-only">提醒方式</legend>
      {REMINDER_METHODS.map(([method, label], i) => (
        <button type="button" key={method} onClick={() => onSelect(method)} className={rowCls(i)} aria-pressed={selected === method}>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-(--c-ink)">{label}</span>
            {method !== "off" && <span className="mt-0.5 block text-[12px] font-medium text-(--c-ink4)">{method === "calendar" ? "同步课程、作业和考试" : "本机通知与课程实时状态"}</span>}
          </span>
          <Tick on={selected === method} />
        </button>
      ))}
    </fieldset>
  );
}

export function NotifPrefPage({ onBack, onPick }: { onBack: () => void; onPick: (k: PrefKey) => void }) {
  const state = useStore();
  const status = useReminderStatus();
  useEffect(() => { void refreshReminderStatus(); }, []);
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-32.5 scrollbar-none">
        <TopBar title="提醒" onBack={onBack} />
        <MethodPicker selected={state.prefs.reminderMethod} disabled={status.busy} onSelect={method => void setReminderMethod(method)} />
        {status.error && <div role="alert" className="mt-3 text-[12px] text-(--c-rose)">{status.error}</div>}
        {state.prefs.reminderMethod === "notification" && (
          <div className="mt-5 rounded-[18px] bg-(--c-surface) px-4">
            <div className="flex min-h-14 items-center justify-between gap-3 py-3.5">
              <span className="text-[14px] font-semibold text-(--c-ink)">通知状态</span>
              <span className="text-[12px] font-medium text-(--c-ink4)">{!status.checked ? "待检查" : !status.notificationsEnabled ? "未获允许" : status.exactAlarms ? "已开启" : "可能延迟"}</span>
              <span className="sr-only">{status.focusModuleActive ? "LSPosed 增强已生效" : "Live Updates"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-(--c-surface2) py-3.5">
              <TextAction onClick={() => void openNotificationSettings()}>通知设置</TextAction>
              <TextAction busy={status.refreshing} onClick={() => void refreshReminderStatus()}>刷新状态</TextAction>
            </div>
            <div role="status" aria-live="polite" className={`flex min-h-9 items-center pb-3 text-[12px] tabular-nums ${status.refreshError ? "text-(--c-rose)" : "text-(--c-ink4)"}`}>
              {status.refreshing ? "正在检查通知权限" : status.refreshError || (status.refreshedAt ? `已刷新 · ${new Date(status.refreshedAt).toLocaleTimeString("zh-CN", { hour12: false })}` : "尚未检查")}
            </div>
            <div className="flex items-center gap-4 border-t border-(--c-surface2) py-3.5">
              <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-(--c-ink)">下课倒计时</div><div className="mt-0.5 text-[12px] text-(--c-ink4)">上课后在超级岛显示剩余时间</div></div>
              <Switch on={state.prefs.showDismissCountdown} onChange={on => { store.setPrefs({ showDismissCountdown: on }); scheduleReminderSync(); }} />
            </div>
          </div>
        )}
        <div className="mt-5">
          {GROUPS.map(([g, keys]) => (
            <div key={g} className="mt-5 first:mt-0">
              <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{g}</div>
              <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
                {keys.map((k, i) => (
                  <button key={k} onClick={() => onPick(k)} className={rowCls(i)}>
                    <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{OPTIONS[k].title}</span>
                    <span className="text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{valueOf(k, state.prefs)}</span>
                    <Chevron />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

export function PrefPickPage({ pref, onBack }: { pref: PrefKey; onBack: () => void }) {
  const state = useStore();
  const { title, sub, multi, options } = OPTIONS[pref];
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-32.5 scrollbar-none">
        <TopBar title={title} sub={sub} onBack={onBack} />
        <div className="mt-6 rounded-[18px] bg-(--c-surface) px-4">
          {options.map((o, i) => {
            const on = o.match(state.prefs);
            return (
              <button
                key={o.label}
                onClick={() => {
                  store.setPrefs(typeof o.patch === "function" ? o.patch(state.prefs) : o.patch);
                  scheduleReminderSync();
                  if (!multi)
                    onBack();
                }}
                className={rowCls(i)}
              >
                <span className={`flex-1 text-[14px] font-semibold ${on && !multi ? "text-(--c-accent)" : "text-(--c-ink)"}`}>{o.label}</span>
                <Tick on={on} multi={multi} />
              </button>
            );
          })}
        </div>
      </div>
    </Page>
  );
}

/** 首次只选择提醒方式，不重复完整提醒设置页。 */
export function ReminderSetupPage({ root = false, onDone }: { root?: boolean; onDone?: () => void }) {
  const state = useStore();
  const status = useReminderStatus();
  const [selected, setSelected] = useState<ReminderMethod>(state.prefs.reminderMethod);
  return (
    <Page root={root} className="pointer-events-auto">
      <div className="flex-1 overflow-y-auto px-5 pb-6 scrollbar-none">
        <TopBar title="提醒方式" />
        <MethodPicker selected={selected} onSelect={setSelected} disabled={status.busy} />
        {status.error && <div role="alert" className="mt-3 text-[12px] text-(--c-rose)">{status.error}</div>}
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton busy={status.busy} onClick={() => void setReminderMethod(selected).then(ok => { if (ok) onDone?.(); })}>完成</PrimaryButton>
      </div>
    </Page>
  );
}

export type { PrefKey };
