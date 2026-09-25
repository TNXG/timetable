/** 教务状态：绑定的学校、自动更新开关、立即更新 / 重新登录、退出登录；没绑定时给登录入口 */
import { useEduSync } from '../edu-sync'
import { EduSyncGroup } from './Semester'
import { PrimaryButton, SubPage } from '../ui'

export function EduStatusPage({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const s = useEduSync()
  return (
    <SubPage title="教务账号" onBack={onBack}>
      {s ? (
        <EduSyncGroup onLogin={onLogin} />
      ) : (
        <div className="mt-6 flex flex-col items-center gap-5 rounded-[18px] bg-(--c-surface) px-4 py-8">
          <div className="text-[14px] font-bold text-(--c-ink)">还没有绑定教务账号</div>
          <PrimaryButton onClick={onLogin}>登录</PrimaryButton>
        </div>
      )}
    </SubPage>
  )
}
