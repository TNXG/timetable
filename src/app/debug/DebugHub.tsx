/** 调试入口：按子系统分组的自检页面，从关于页图标三连点进入（不在原型里） */
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { appVersion } from '../edu/share'
import { statusText, useEduSync } from '../edu-sync'
import { useStore } from '../store'
import { Chevron, Page, TopBar } from '../ui'

export type DebugPage = 'debugOcr' | 'debugEdu' | 'debugData' | 'debugEnv'

export function DebugHub({ onBack, onPage }: { onBack: () => void; onPage: (p: DebugPage) => void }) {
  const [version, setVersion] = useState('')
  const state = useStore()
  const eduSync = useEduSync()
  useEffect(() => {
    let alive = true
    void appVersion().then((v) => {
      if (alive) setVersion(v)
    })
    return () => {
      alive = false
    }
  }, [])
  const groups: [string, [string, string, DebugPage][]][] = [
    ['识别', [['验证码识别', Capacitor.getPlatform() === 'android' ? '本地 OCR' : '仅应用内', 'debugOcr']]],
    ['教务', [['会话与更新', eduSync ? statusText(eduSync).text : '未绑定', 'debugEdu']]],
    ['数据', [['本机数据', `${state.courses.length} 门课 · ${state.tasks.length} 项`, 'debugData']]],
    ['设备', [['运行环境', `${Capacitor.getPlatform()} ${version}`.trim(), 'debugEnv']]],
  ]
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="调试" onBack={onBack} />
        {groups.map(([g, rows]) => (
          <div key={g} className="mt-6">
            <div className="px-1 text-[12px] font-bold tracking-[-.01em] text-(--c-ink5)">{g}</div>
            <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
              {rows.map(([k, v, page], i) => (
                <button
                  key={k}
                  onClick={() => onPage(page)}
                  className={`flex w-full min-w-0 items-center gap-2 py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}
                >
                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-(--c-ink)">{k}</span>
                  <span className="max-w-[45%] min-w-0 truncate text-right text-[12.5px] font-medium text-(--c-ink4)">{v}</span>
                  <Chevron className="shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
