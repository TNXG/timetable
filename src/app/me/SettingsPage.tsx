import { weekOf } from "../../domain/dates";
import { REMINDER_METHODS } from "../reminder-service";
import { semesterEnded, todayStr } from "../semester";
import { useStore } from "../store";
import { THEME_LABEL, useTheme } from "../theme";
import { Chevron, Page, TopBar } from "../ui";
type SettingsPageName = "semester" | "schedule" | "courses" | "notif" | "theme" | "widget" | "erase";

export function SettingsPage({ onBack, onPage }: { onBack: () => void; onPage: (p: SettingsPageName) => void }) {
  const state = useStore();
  const { prefs, semester: sem } = state;
  const theme = useTheme();
  const week = sem ? weekOf(sem, todayStr()) : 0;
  const groups: [string, [string, string, SettingsPageName][]][] = [
    ["课表", [
      ["学期", sem ? (semesterEnded(sem) ? `${sem.name}，已结束` : `${sem.name}，第 ${Math.max(0, Math.min(sem.totalWeeks, week))} / ${sem.totalWeeks} 周`) : "未设置", "semester"],
      ["作息时间", "", "schedule"],
      ["课程", `${state.courses.filter(c => !c.removedByImport).length} 门`, "courses"],
    ]],
    ["提醒", [
      ["提醒", REMINDER_METHODS.find(([method]) => method === prefs.reminderMethod)![1], "notif"],
    ]],
    ["外观", [
      ["主题", THEME_LABEL[theme], "theme"],
      ["桌面小组件", "", "widget"],
    ]],
    ["高级", [
      ["清除数据", "", "erase"],
    ]],
  ];
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 scrollbar-none">
        <TopBar title="设置" onBack={onBack} />
        {groups.map(([heading, rows]) => (
          <div key={heading} className="mt-5">
            <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{heading}</div>
            <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
              {rows.map(([title, value, page], i) => (
                <button
                  key={title}
                  onClick={() => onPage(page)}
                  className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? "border-t border-(--c-surface2)" : ""}`}
                >
                  <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">{title}</span>
                  <span className="text-[12.5px] font-medium text-(--c-ink4)">{value}</span>
                  <Chevron className="ml-2" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
