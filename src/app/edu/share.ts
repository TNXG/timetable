/** 分享与外链：页面调试包走系统分享，反馈走 GitHub issue */
import { App as CapApp } from '@capacitor/app'
import type { EduSystemId } from '../../domain/edu/systems'
import type { PageCapture, ProbeResult } from '../../domain/edu/scripts'
import { DEBUG_MIME, buildDebugPackage } from '../../domain/edu/debug'
import { shareText } from '../files'

/** 系统浏览器打开外链（GitHub）。原生壳里非本站地址由 Capacitor 转交系统浏览器 */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener')
}


/** 页面调试包：当前页面原样导成一个 .html 走系统分享，给未识别、不出导入按钮的页面排查 */
export async function shareDebug(capture: PageCapture, system: EduSystemId | null, probe: ProbeResult | null) {
  const version = await appVersion()
  await shareText(buildDebugPackage({ capture, system, probe, version }), DEBUG_MIME)
}


export async function appVersion(): Promise<string> {
  try {
    return (await CapApp.getInfo()).version
  } catch {
    return ''
  }
}

