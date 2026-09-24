/** 已有照片的显示：浏览器下的 data URL 缓存 + 原生文件路径解析 + 导入落库记录 */
import { Capacitor } from '@capacitor/core'
import type { TaskPhoto } from '../domain/types'
import type { CapturedPhoto } from './camera'
import { uid } from '../domain/store'
import { nativeCamera, TtCamera, webPhotos } from './camera'

const srcCache = new Map<string, string>()

/** 相对路径转 <img src>；原生下第一次要问一次插件 */
export function photoSrc(path: string): string {
  if (path.startsWith('data:')) return path
  const web = webPhotos.get(path)
  if (web) return web
  return srcCache.get(path) ?? ''
}

export async function loadPhotoSrc(path: string): Promise<string> {
  const cached = photoSrc(path)
  if (cached) return cached
  if (!nativeCamera()) return ''
  try {
    const r = await TtCamera.resolve({ path })
    const src = r.uri ? Capacitor.convertFileSrc(r.uri) : ''
    if (src) srcCache.set(path, src)
    return src
  } catch {
    return ''
  }
}

export function rememberPhoto(p: CapturedPhoto): TaskPhoto {
  if (nativeCamera() && p.uri) srcCache.set(p.path, Capacitor.convertFileSrc(p.uri))
  return { id: uid(), path: p.path, w: p.width, h: p.height, takenAt: Date.now() }
}
