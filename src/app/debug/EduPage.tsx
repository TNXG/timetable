/** 调试 · 教务：学校绑定、WebView 会话与自动更新记录 */
import { Capacitor } from '@capacitor/core'
import { DEFAULT_PLUGIN, EDU_PLUGINS, hasDirectLogin, type EduPlugin } from '../../domain/edu/plugin'
import { detectSystem } from '../../domain/edu/systems'
import { termLabel } from '../../domain/edu/zhengfang'
import { eduProfile, nativeEdu } from '../edu-browser'
import { statusText, useEduSync } from '../edu-sync'
import { Group, KV } from './kit'
import { Page, TopBar } from '../ui'

/* 只读展示：这些值决定导入与自动更新走哪条路，出问题时第一眼看它们 */
export function EduPage({ onBack }: { onBack: () => void }) {
  const sync = useEduSync()
  const status = sync ? statusText(sync) : null
  const when = sync?.lastAt ? new Date(sync.lastAt).toLocaleString() : ''
  /* 绑定记录里的 school 只是入口三件套，插件（登录方式）按入口地址回查 */
  const plugin: EduPlugin | undefined = sync ? EDU_PLUGINS.find((p) => p.url === sync.school.url || p.name === sync.school.name) : undefined
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="教务" sub="绑定、会话与自动更新" onBack={onBack} />
        <Group title="插件">
          <KV k="默认学校" v={DEFAULT_PLUGIN.name} sub={DEFAULT_PLUGIN.url} />
          <KV k="内置" v={EDU_PLUGINS.map((p) => p.id).join(' · ')} sub={`${EDU_PLUGINS.length} 家`} />
        </Group>
        <Group title="当前绑定">
          <KV k="学校" v={sync ? sync.school.name : '未绑定'} />
          <KV k="登录方式" v={plugin ? (hasDirectLogin(plugin) ? '应用内直登' : '内置浏览器') : '—'} sub={plugin ? `页面识别 ${plugin.system ?? detectSystem(plugin.url) ?? '未识别'}` : ''} />
          <KV k="WebView" v={sync ? eduProfile(sync.school.url) : '—'} />
        </Group>
        <Group title="自动更新">
          <KV k="开关" v={sync ? (sync.enabled ? '开' : '关') : '—'} />
          <KV k="上次结果" v={status ? status.text : '—'} tone={status?.danger ? 'bad' : undefined} sub={when} />
          <KV k="变更与失效" v={sync ? `${sync.lastChanges} 处 · 连续失效 ${sync.failStreak}` : '—'} />
          <KV k="来源页" v={sync?.pageUrl || '—'} sub={sync?.term ? termLabel(sync.term) : ''} />
        </Group>
        <Group title="原生桥">
          <KV
            k="TtEdu"
            v={nativeEdu() ? '可用' : '不可用'}
            tone={nativeEdu() ? 'ok' : 'bad'}
            sub={Capacitor.isPluginAvailable('TtEdu') ? '已注册' : '未注册'}
          />
        </Group>
      </div>
    </Page>
  )
}
