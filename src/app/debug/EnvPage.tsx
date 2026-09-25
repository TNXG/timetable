/** 调试 · 环境：平台、设备、显示与原生桥可用性 */
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { appVersion } from '../edu/share'
import { resolve, useDynamic, useTheme, THEME_LABEL } from '../theme'
import { deviceFacts, type DeviceFacts } from './bridge'
import { Group, KV } from './kit'
import { Page, TopBar } from '../ui'

/* 原生插件名，与 MainActivity.registerPlugin 一一对应 */
const PLUGINS = ['WidgetBridge', 'TtCamera', 'TtCalendar', 'TtFiles', 'TtEdu', 'TtCredentials', 'TtOcr', 'TtDebug']

export function EnvPage({ onBack }: { onBack: () => void }) {
  const [version, setVersion] = useState('')
  const [facts, setFacts] = useState<DeviceFacts | null>(null)
  const [factsError, setFactsError] = useState('')
  const theme = useTheme()
  const [dynamic, dynamicOk] = useDynamic()

  useEffect(() => {
    let alive = true
    void appVersion().then((v) => {
      if (alive) setVersion(v)
    })
    deviceFacts().then(
      (f) => {
        if (alive) setFacts(f)
      },
      (e: unknown) => {
        if (alive) setFactsError(e instanceof Error ? e.message : '读取失败')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const chrome = navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? ''
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="环境" sub="平台、设备与原生桥" onBack={onBack} />
        <Group title="应用">
          <KV k="版本" v={version || '—'} />
          <KV k="平台" v={Capacitor.getPlatform()} sub={Capacitor.isNativePlatform() ? '原生壳' : '浏览器'} />
          <KV k="入口" v={window.location.origin} sub={window.location.pathname} />
        </Group>
        <Group title="设备">
          {facts ? (
            <>
              <KV k="机型" v={`${facts.manufacturer} ${facts.model}`.trim()} sub={`${facts.brand} · ${facts.locale}`} />
              <KV k="芯片" v={facts.soc || '系统未上报'} />
              <KV k="架构" v={facts.abi} sub={facts.abis} />
              <KV k="系统" v={`Android ${facts.release}`} sub={`API ${facts.sdk}`} />
            </>
          ) : (
            <KV k="读取" v={factsError || '读取中…'} tone={factsError ? 'bad' : undefined} />
          )}
        </Group>
        <Group title="显示">
          <KV k="视口" v={`${window.innerWidth} × ${window.innerHeight}`} sub={`DPR ${window.devicePixelRatio}`} />
          <KV k="主题" v={`${THEME_LABEL[theme]} · ${resolve()}`} />
          <KV k="动态色" v={dynamicOk ? (dynamic ? '开' : '关') : '系统不支持'} />
          <KV k="WebView" v={chrome ? `Chrome ${chrome}` : '未知'} sub={navigator.userAgent} />
        </Group>
        <Group title="原生桥">
          {PLUGINS.map((p) => (
            <KV key={p} k={p} v={Capacitor.isPluginAvailable(p) ? '可用' : '不可用'} tone={Capacitor.isPluginAvailable(p) ? 'ok' : 'bad'} />
          ))}
        </Group>
      </div>
    </Page>
  )
}
