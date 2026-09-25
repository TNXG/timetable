/** 调试入口的原生桥：只读运行时与设备信息（`TtDebug.kt`） */
import { Capacitor, registerPlugin } from '@capacitor/core'

/** 调试页「环境」读的运行时与设备信息 */
export interface DeviceFacts {
  model: string
  brand: string
  manufacturer: string
  /** Android 12 起才有；更早是空串 */
  soc: string
  abi: string
  abis: string
  release: string
  sdk: number
  locale: string
}

interface TtDebugPlugin {
  device(): Promise<DeviceFacts>
}

const TtDebug = registerPlugin<TtDebugPlugin>('TtDebug')

/** 设备与运行时信息：只在原生端有，浏览器预览里 reject */
export function deviceFacts(): Promise<DeviceFacts> {
  return Capacitor.getPlatform() === 'android' ? TtDebug.device() : Promise.reject(new Error('浏览器预览没有原生层'))
}
