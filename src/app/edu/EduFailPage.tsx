/** 未识别：页面地址与系统猜测，给更新、反馈、调试包三个出口 */
import { useEffect, useState } from 'react'
import { SYSTEM_LABEL, scrubUrl, type EduSystemId } from '../../domain/edu/systems'
import type { PageCapture, ProbeResult } from '../../domain/edu/scripts'
import { LATEST_RELEASE_API, RELEASES_URL, isNewer, issueUrl } from '../../domain/edu/release'
import { nativeToast } from '../widgets'
import { Page, Row, TopBar } from '../ui'
import { appVersion, openExternal, shareDebug } from './share'

export interface EduFailInfo {
  url: string
  system: EduSystemId | null
  /** 点导入时页面的正文文字；给「让 AI 转换」用 */
  text: string
  /** 点导入时的页面快照；给「导出页面调试包」用 */
  capture: PageCapture | null
  probe: ProbeResult | null
}

async function latestRelease(): Promise<{ tag: string; url: string } | null> {
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return null
    const j: unknown = await res.json()
    if (typeof j !== 'object' || j === null) return null
    const o = j as Record<string, unknown>
    if (typeof o.tag_name !== 'string') return null
    return { tag: o.tag_name, url: typeof o.html_url === 'string' ? o.html_url : RELEASES_URL }
  } catch {
    return null
  }
}

export function EduFailPage({ info, onBack }: { info: EduFailInfo; onBack: () => void }) {
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [v, latest] = await Promise.all([appVersion(), latestRelease()])
      if (!alive) return
      setVersion(v)
      if (latest && v && isNewer(latest.tag, v)) setUpdate(latest.url)
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <Page>
      <div className="flex flex-1 flex-col overflow-hidden px-5">
        <div className="flex-1 overflow-y-auto pb-6 [scrollbar-width:none]">
          <TopBar title="没有识别到课表" onBack={onBack} />

          <div className="mt-6 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
            <div className="text-[11.5px] font-semibold text-(--c-ink4)">页面</div>
            <div className="mt-1.5 truncate font-mono text-[12.5px] text-(--c-ink)">{scrubUrl(info.url).replace(/^https?:\/\//, '')}</div>
            {info.system && <div className="mt-1 text-[11.5px] font-medium text-(--c-ink4)">{SYSTEM_LABEL[info.system]}</div>}
          </div>

          <div className="mt-6 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
            {update && <Row title="更新到最新版本" desc="新版本可能已支持这个页面" onClick={() => openExternal(update)} />}
            <Row title="反馈这个页面" desc="只提交页面地址、系统猜测和版本号" onClick={() => openExternal(issueUrl({ url: info.url, system: info.system, version }))} />
            {info.capture && (
              <Row
                title="导出页面调试包"
                desc="当前页面的 HTML，一个 .html 文件"
                onClick={() => {
                  const c = info.capture
                  if (c) void shareDebug(c, info.system, info.probe).catch(() => nativeToast('导出失败'))
                }}
              />
            )}
          </div>
        </div>

        <div className="flex-none pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
          <button onClick={onBack} className="w-full rounded-[18px] bg-(--c-surface) py-[15px] text-[15px] font-bold text-(--c-ink) transition-transform duration-150 active:scale-[.985]">返回</button>
        </div>
      </div>
    </Page>
  )
}
