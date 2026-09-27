/** 教务账号：已绑定显示学校卡片；未绑定时进入登录。 */
import { useEduSync } from "../edu-sync";
import { PrimaryButton, SubPage } from "../ui";
import { EduSyncGroup } from "./Semester";

export function EduStatusPage({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const s = useEduSync();
  return (
    <SubPage title="教务账号" onBack={onBack}>
      {s
        ? (
            <EduSyncGroup onLogin={onLogin} heading={false} />
          )
        : (
            <>
              <div className="mt-6 rounded-[18px] bg-(--c-surface) px-4 py-5">
                <div className="text-[14px] font-bold text-(--c-ink)">未绑定教务账号</div>
                <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">课表未连接学校</div>
              </div>
              <div className="mt-6"><PrimaryButton onClick={onLogin}>登录教务账号</PrimaryButton></div>
            </>
          )}
    </SubPage>
  );
}
