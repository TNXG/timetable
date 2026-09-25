/** 关于：应用信息与开发者 */
import { useEffect, useRef, useState } from 'react'
import { Page, Row, TopBar } from '../ui'
import { haptic } from '../widgets'
import { appVersion, openExternal } from '../edu/share'

const DEV_AVATAR = 'https://api-space.tnxg.top/avatar?s=qq'
const DEV_PROFILE = 'https://github.com/TNXG'
const DEV_REPO = 'https://github.com/TNXG/timetable'
const ORIGIN_AVATAR = 'https://api-space.tnxg.top/images/proxy?url=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F149454909%3Fv%3D4'
const ORIGIN_PROFILE = 'https://github.com/shuakami'

function DevRow({ avatar, name, role, href }: { avatar: string; name: string; role: string; href: string }) {
  return (
    <button onClick={() => openExternal(href)} className="flex w-full items-center px-4 py-3.5 text-left transition-colors active:bg-(--c-bg)">
      <img src={avatar} alt={`${name} 头像`} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} className="h-10 w-10 flex-none rounded-full bg-(--c-surface2) object-cover" />
      <div className="ml-3 min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-(--c-ink)">{name}</div>
        <div className="mt-0.5 truncate text-[12px] font-medium text-(--c-ink4)">{role} · GitHub.com</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-ink5)' }} strokeWidth="2.4" strokeLinecap="round" className="ml-3 flex-none"><path d="m9 5 7 7-7 7" /></svg>
    </button>
  )
}

export function AboutPage({ onBack, onDebug }: { onBack: () => void; onDebug: () => void }) {
  const [version, setVersion] = useState('')
  const taps = useRef<number[]>([])
  useEffect(() => {
    let alive = true
    void appVersion().then((v) => {
      if (alive) setVersion(v)
    })
    return () => {
      alive = false
    }
  }, [])
  /* 图标 900ms 内点满三次进调试页；正常点击不改变外观 */
  const tapIcon = () => {
    const now = Date.now()
    const recent = [...taps.current.filter((t) => now - t < 900), now]
    taps.current = recent
    if (recent.length >= 3) {
      taps.current = []
      haptic('light')
      onDebug()
    }
  }
  const repoText = DEV_REPO.replace(/^https:\/\//, '')
  const facts: [string, string][] = version
    ? [
        [version, '版本'],
        ['GPL-3.0', '开源协议'],
        [repoText, '代码仓库'],
      ]
    : [
        ['GPL-3.0', '开源协议'],
        [repoText, '代码仓库'],
      ]
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <TopBar title="关于" onBack={onBack} />
        <div className="mt-10 flex flex-col items-center">
          <button type="button" onClick={tapIcon} className="flex-none outline-none">
            <img src="/icon.png" alt="Koma" className="h-[84px] w-[84px]" />
          </button>
          <div className="mt-4 text-[22px] font-extrabold tracking-[-.02em] text-(--c-ink)">Koma</div>
          {version && <div className="mt-1 text-[12.5px] font-medium tabular-nums text-(--c-ink4)">{version}</div>}
        </div>
        <div className="mt-8 rounded-[18px] bg-(--c-surface) px-4">
          {facts.map(([v, label], i) => (
            <div key={label} className={`py-3.5 ${i ? 'border-t border-(--c-surface2)' : ''}`}>
              <div className="truncate text-[15px] font-semibold text-(--c-ink)">{v}</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-(--c-ink4)">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="px-0.5 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">开发者</div>
          <div className="mt-2 divide-y divide-(--c-surface2) overflow-hidden rounded-[18px] bg-(--c-surface)">
            <DevRow avatar={DEV_AVATAR} name="TNXG" role="维护者" href={DEV_PROFILE} />
            <DevRow avatar={ORIGIN_AVATAR} name="Shuakami" role="原作者" href={ORIGIN_PROFILE} />
            <Row title="反馈问题" onClick={() => openExternal(`${DEV_REPO}/issues/new`)} />
          </div>
        </div>
      </div>
    </Page>
  )
}
