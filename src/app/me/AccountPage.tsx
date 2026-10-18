import { statusText, useEduSync } from "../edu-sync";
import { Chevron, SubPage } from "../ui";

export function AccountPage({ onBack, onEdu }: { onBack: () => void; onEdu: () => void }) {
  const edu = useEduSync();
  const status = edu ? statusText(edu) : { text: "未登录", danger: false };
  return (
    <SubPage title="账号" onBack={onBack}>
      <div className="rounded-[18px] bg-(--c-surface) px-4">
        <button onClick={onEdu} className="flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60">
          <span className="flex-1 text-[14px] font-semibold text-(--c-ink)">教务账号</span>
          <span className={`text-[12.5px] font-medium ${status.danger ? "text-(--c-danger)" : "text-(--c-ink4)"}`}>{status.text}</span>
          <Chevron className="ml-2" />
        </button>
      </div>
    </SubPage>
  );
}
