/** 导入方式：默认入口是教务系统登录（首页「导入课表」直达），这里只列补充方式。
    从内置浏览器的「其他导入方式」进来，盖在浏览器退场上，保持不透明。 */
import { Page, Row, TopBar } from '../ui'

export function ImportPage({ onBack, onManual, onScan, onAi, onRule }: {
  onBack: () => void
  onManual: () => void
  onScan: () => void
  onAi: () => void
  onRule: () => void
}) {
  return (
    <Page keep="opaque">
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="其他导入方式" onBack={onBack} />

        <div className="mt-6 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Row title="手动添加课程" onClick={onManual} />
          <Row title="扫码导入" onClick={onScan} />
          <Row title="让 AI 转换" onClick={onAi} />
          <Row title="自定义规则" onClick={onRule} />
        </div>
      </div>
    </Page>
  )
}
