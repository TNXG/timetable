import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { TaskPhoto } from '../domain/types'
import { uid } from '../domain/store'

/** 拍下或导入的一张照片：path 存进 Task，uri 只用来显示 */
export interface CapturedPhoto {
  path: string
  uri: string
  width: number
  height: number
}

export interface GalleryItem {
  id: string
  thumb: string
  width: number
  height: number
}

/** blocked：用户选了不再询问，系统对话框不会再出现，只能去系统设置放开 */
export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'prompt'

interface TtCameraPlugin {
  checkPermissions(): Promise<{ camera: PermissionStatus; photos: PermissionStatus }>
  requestPermission(o: { kind: 'camera' | 'photos' }): Promise<{ status: PermissionStatus }>
  start(o: { position: 'back' | 'front'; x: number; y: number; width: number; height: number; delay: number; scan?: boolean }): Promise<{ position: 'back' | 'front' }>
  addListener(event: 'scan', fn: (e: { text: string }) => void): Promise<PluginListenerHandle>
  freeze(): Promise<{ frozen?: string }>
  stop(): Promise<void>
  switchCamera(): Promise<{ position: 'back' | 'front' }>
  setTorch(o: { on: boolean }): Promise<void>
  setZoom(o: { ratio: number }): Promise<{ ratio: number }>
  capture(): Promise<CapturedPhoto>
  listRecent(o: { limit: number; page: number }): Promise<{ items: GalleryItem[] }>
  importPicked(o: { ids: string[] }): Promise<{ items: CapturedPhoto[] }>
  importData(o: { data: string }): Promise<CapturedPhoto>
  resolve(o: { path: string }): Promise<{ uri: string }>
  saveToGallery(o: { path: string }): Promise<void>
  deleteFiles(o: { paths: string[] }): Promise<void>
}

export const TtCamera = registerPlugin<TtCameraPlugin>('TtCamera')

export const nativeCamera = () => Capacitor.getPlatform() === 'android'

/* ---------------- 浏览器降级：预览走 getUserMedia，照片存成 data URL ---------------- */

export const webPhotos = new Map<string, string>()
let webStream: MediaStream | null = null
let webVideo: HTMLVideoElement | null = null
let webFacing: 'back' | 'front' = 'back'

async function webStart(position: 'back' | 'front'): Promise<void> {
  webFacing = position
  webStop()
  webStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: position === 'front' ? 'user' : 'environment' },
    audio: false,
  })
  webVideo = document.createElement('video')
  webVideo.playsInline = true
  webVideo.muted = true
  webVideo.srcObject = webStream
  await webVideo.play()
}

function webStop() {
  webStream?.getTracks().forEach((t) => t.stop())
  webStream = null
  webVideo = null
  webScanStop()
}

/* 浏览器扫码：有 BarcodeDetector 就轮询视频帧，没有则不识别 */
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<DetectedBarcode[]> }
declare const BarcodeDetector: (new (o: { formats: string[] }) => BarcodeDetectorLike) | undefined

let webScanTimer = 0
let webScanHandlers: ((text: string) => void)[] = []

function webScanStart() {
  webScanStop()
  if (typeof BarcodeDetector === 'undefined') return
  const det = new BarcodeDetector({ formats: ['qr_code'] })
  let last = ''
  let lastAt = 0
  const tick = async () => {
    if (!webVideo || webVideo.readyState < 2) return
    try {
      const hits = await det.detect(webVideo)
      const text = hits[0]?.rawValue ?? ''
      if (!text) return
      const now = Date.now()
      if (text === last && now - lastAt < 1500) return
      last = text
      lastAt = now
      for (const fn of webScanHandlers) fn(text)
    } catch { /* 帧不可用，下一轮再试 */ }
  }
  webScanTimer = window.setInterval(() => void tick(), 250)
}

function webScanStop() {
  if (webScanTimer) window.clearInterval(webScanTimer)
  webScanTimer = 0
}

/** 把预览当前帧画到画布上；width 是目标宽度，高度按预览比例算 */
function canvasStill(width: number, quality = 0.9): { data: string; width: number; height: number } | null {
  if (!webVideo || !webVideo.videoWidth) return null
  const height = Math.round(webVideo.videoHeight * (width / webVideo.videoWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(webVideo, 0, 0, width, height)
  return { data: canvas.toDataURL('image/jpeg', quality), width, height }
}

async function webCapture(): Promise<CapturedPhoto> {
  const still = canvasStill(webVideo?.videoWidth ?? 0)
  if (!still) throw new Error('not-started')
  const path = `web/${uid()}.jpg`
  webPhotos.set(path, still.data)
  return { path, uri: still.data, width: still.width, height: still.height }
}

/** 浏览器里没有相册接口：用文件选择顶上，选中的图直接当结果 */
async function webPick(): Promise<CapturedPhoto[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = input.files ? Array.from(input.files) : []
      const out: CapturedPhoto[] = []
      for (const f of files) {
        const data = await new Promise<string>((ok) => {
          const r = new FileReader()
          r.onload = () => ok(String(r.result))
          r.readAsDataURL(f)
        })
        const size = await new Promise<[number, number]>((ok) => {
          const img = new Image()
          img.onload = () => ok([img.naturalWidth, img.naturalHeight])
          img.onerror = () => ok([0, 0])
          img.src = data
        })
        const path = `web/${uid()}.jpg`
        webPhotos.set(path, data)
        out.push({ path, uri: data, width: size[0], height: size[1] })
      }
      resolve(out)
    }
    input.click()
  })
}

/* ---------------- 对外接口 ---------------- */

export const camera = {
  async permissions() {
    if (!nativeCamera()) {
      return { camera: 'granted' as PermissionStatus, photos: 'granted' as PermissionStatus }
    }
    return TtCamera.checkPermissions()
  },

  async request(kind: 'camera' | 'photos'): Promise<PermissionStatus> {
    if (!nativeCamera()) return 'granted'
    try {
      const r = await TtCamera.requestPermission({ kind })
      return r.status
    } catch {
      return 'denied'
    }
  },

  /** rect 是取景区在页面里的位置：原生预览叠在这块上方；delay 后才淡入（等页面推入动画走完） */
  async start(position: 'back' | 'front', rect: { x: number; y: number; width: number; height: number }, delay = 0, scan = false) {
    if (!nativeCamera()) {
      await webStart(position)
      if (scan) webScanStart()
      return
    }
    await TtCamera.start({ position, ...rect, delay, scan })
  },

  /** 扫码模式下每识别到一个二维码回调一次；返回取消函数 */
  onScan(fn: (text: string) => void): () => void {
    if (!nativeCamera()) {
      webScanHandlers.push(fn)
      return () => { webScanHandlers = webScanHandlers.filter((f) => f !== fn) }
    }
    const h = TtCamera.addListener('scan', (e) => fn(e.text))
    return () => { void h.then((x) => x.remove()) }
  },

  /** 浏览器里能否识别二维码；原生端总是可以 */
  canScan(): boolean {
    return nativeCamera() || typeof BarcodeDetector !== 'undefined'
  },

  /**
   * 定格：预览立刻静止，最后一帧以 data URL 返回，页面填在取景框里；
   * 原生层还在，等页面画好后再 stop()，接缝上不会露出空洞。
   */
  async freeze(): Promise<string | null> {
    if (!nativeCamera()) {
      const still = canvasStill(720, 0.8)
      if (!still) return null
      webStop()
      return still.data
    }
    const r = await TtCamera.freeze()
    return r?.frozen ?? null
  },

  /** 撤掉预览层 */
  async stop(): Promise<void> {
    if (!nativeCamera()) {
      webStop()
      return
    }
    await TtCamera.stop()
  },

  async switchCamera(): Promise<'back' | 'front'> {
    if (!nativeCamera()) {
      const next = webFacing === 'back' ? 'front' : 'back'
      await webStart(next)
      return next
    }
    const r = await TtCamera.switchCamera()
    return r.position
  },

  async torch(on: boolean) {
    if (!nativeCamera()) return
    await TtCamera.setTorch({ on })
  },

  /** 双指缩放：返回实际生效的倍率（浏览器里用 CSS 放大预览顶上，最大 4x） */
  async zoom(ratio: number): Promise<number> {
    if (!nativeCamera()) {
      const r = Math.max(1, Math.min(4, ratio))
      if (webVideo) webVideo.style.transform = `scale(${r})`
      return r
    }
    const r = await TtCamera.setZoom({ ratio })
    return r.ratio
  },

  async capture(): Promise<CapturedPhoto> {
    if (!nativeCamera()) return webCapture()
    return TtCamera.capture()
  },

  /** 浏览器里返回空列表，由 pick() 走系统文件选择 */
  async listRecent(page = 0, limit = 60): Promise<GalleryItem[]> {
    if (!nativeCamera()) return []
    try {
      const r = await TtCamera.listRecent({ limit, page })
      return r.items
    } catch {
      return []
    }
  },

  async importPicked(ids: string[]): Promise<CapturedPhoto[]> {
    if (!nativeCamera()) return webPick()
    const r = await TtCamera.importPicked({ ids })
    return r.items
  },

  /** 系统选择器；原生下选出的图落盘到私有目录，否则只活在内存里，重启就没了 */
  async pick(): Promise<CapturedPhoto[]> {
    const picked = await webPick()
    if (!nativeCamera()) return picked
    const out: CapturedPhoto[] = []
    for (const p of picked) {
      try {
        out.push(await TtCamera.importData({ data: p.uri }))
      } catch {
        // 写不进去的这张跳过
      }
      webPhotos.delete(p.path)
    }
    return out
  },

  /** 浏览器降级时的预览元素：相机页把它挂进取景框 */
  webPreview(): HTMLVideoElement | null {
    return webVideo
  },

  /** 存到系统相册；浏览器里直接下载 */
  async save(path: string): Promise<boolean> {
    if (!nativeCamera()) {
      const src = photoSrc(path)
      if (!src) return false
      const a = document.createElement('a')
      a.href = src
      a.download = `${path.split('/').pop() ?? 'photo'}`
      a.click()
      return true
    }
    try {
      await TtCamera.saveToGallery({ path })
      return true
    } catch {
      return false
    }
  },

  async remove(paths: string[]) {
    for (const p of paths) webPhotos.delete(p)
    if (!nativeCamera()) return
    try {
      await TtCamera.deleteFiles({ paths })
    } catch {
      // 文件可能已经不在，忽略
    }
  },
}


import { photoSrc } from './photo-src'
