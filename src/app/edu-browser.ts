import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { PAGE_CAPTURE_JS, PAGE_HTML_JS, PAGE_TEXT_JS, PROBE_JS, wrapRun, zfFetchJs, type PageCapture, type ProbeResult } from '../domain/edu/scripts'
import type { ZfKb } from '../domain/edu/zhengfang'
import { uid } from '../domain/store'

/**
 * 内置浏览器（原生 TtEdu 插件）的 TS 包装。
 * 页面由用户自己登录；这里只在用户点「导入」（以及到了课表页后探测课程数）时往页面里注入脚本读取结果。
 * 浏览器环境没有原生 WebView：open/close 等全部 no-op，run 直接拒绝。
 */

export interface EduNav {
  url: string
  title: string
  loading: boolean
  progress: number
  canGoBack: boolean
  /** 本次会话里学校页面已画出首帧 */
  painted: boolean
  /** 主文档加载失败；'ssl' 为证书错误 */
  error?: string
}

export interface EduRect {
  x: number
  y: number
  w: number
  h: number
}

/** 透明区：top 以上、bottom 以下是应用自己的界面；keep 里的矩形（悬浮胶囊）也留给应用 */
export interface EduFrame {
  top: number
  bottom: number
  keep: EduRect[]
  interactive: boolean
}

/** 不可见 WebView 的主文档结果 */
export interface EduBgNav {
  url: string
  title: string
  error?: string
}

/** 直登的原生 HTTP 响应：headers 保留服务端大小写与多值 */
export interface EduHttpResult {
  status: number
  url: string
  headers: Record<string, string[]>
  body: string
}

interface TtEduPlugin {
  open(o: { url: string; profile?: string; keep?: boolean }): Promise<{ persistent: boolean }>
  close(o: { keep?: boolean }): Promise<void>
  profiles(): Promise<{ supported: boolean }>
  clearProfile(o: { profile: string }): Promise<{ ok: boolean }>
  /** 直登用：一头一响应、不跟重定向（重定向由插件逐跳处理）；binary=true 时 body 为 base64 */
  http(o: { url: string; method?: string; headers?: Record<string, string>; body?: string; binary?: boolean }): Promise<EduHttpResult>
  /** 会话 Cookie 按网址种进学校 Profile */
  setCookies(o: { profile: string; url: string; cookies: string[] }): Promise<{ ok: boolean }>
  getCookies(o: { profile: string; url: string }): Promise<{ cookie: string | null }>
  bgOpen(o: { url: string; profile?: string }): Promise<void>
  bgEval(o: { js: string }): Promise<{ value: string }>
  bgClose(): Promise<void>
  navigate(o: { url: string }): Promise<void>
  reload(): Promise<void>
  stop(): Promise<void>
  back(): Promise<{ went: boolean }>
  frame(o: EduFrame): Promise<void>
  snapshot(): Promise<{ src: string }>
  eval(o: { js: string }): Promise<{ value: string }>
  state(): Promise<EduNav>
  addListener(event: 'nav', fn: (e: EduNav) => void): Promise<PluginListenerHandle>
  addListener(event: 'message', fn: (e: { data: string }) => void): Promise<PluginListenerHandle>
  addListener(event: 'bgNav', fn: (e: EduBgNav) => void): Promise<PluginListenerHandle>
}

const TtEdu = registerPlugin<TtEduPlugin>('TtEdu')

interface TtCredentialsPlugin {
  save(o: { username: string; password: string }): Promise<{ ok: boolean }>
  get(): Promise<{ ok: boolean; username?: string; password?: string }>
  clear(): Promise<{ ok: boolean }>
}

const TtCredentials = registerPlugin<TtCredentialsPlugin>('TtCredentials')

interface TtOcrPlugin {
  /** 图片以 data URI 或裸 base64 传入；view = 预处理视图；provider = nnapi / cpu */
  recognize(o: { image: string; view: number }): Promise<{ text: string; provider: string }>
  /** 调试入口用：推理后端与加速器实跑探测（原生侧新建会话各跑三次） */
  diagnose(): Promise<OcrDiagnostics>
}

const TtOcr = registerPlugin<TtOcrPlugin>('TtOcr')

/** 一条推理路径的探测结果：建会话 + 实跑 */
export interface OcrBench {
  ok: boolean
  /** 失败原因（成功时原生侧回 null） */
  error?: string | null
  /** 建会话耗时（毫秒） */
  createMs: number
  /** 首次推理耗时（NNAPI 的图上编译都在这里） */
  firstMs: number
  /** 后续两次里最快的一次 */
  bestMs: number
}

/** 关于页调试入口（图标三连点）读的推理自检 */
export interface OcrDiagnostics {
  /** 当前进程内会话实际落地的后端：nnapi / cpu */
  provider: string
  /** 推理内核里编译进来的执行后端 */
  providers: string[]
  /** ONNX Runtime 版本 */
  ort: string
  /** NNAPI 且禁止回退 CPU：算子必须全部落在加速器上 */
  strict: OcrBench
  /** NNAPI，允许算子回退 CPU */
  nnapi: OcrBench
  cpu: OcrBench
}

/** 存进 Android Keystore 保护的应用私有凭据（用户开启保存密码才有）。 */
export interface EduSavedCred {
  username: string
  password: string
}

/** Android Keystore 凭据读写；get 静默读取，供后台自动更新使用。 */
export const eduCredentials = {
  save: (username: string, password: string): Promise<boolean> =>
    nativeEdu() ? TtCredentials.save({ username, password }).then((r) => r.ok, () => false) : Promise.resolve(false),
  load: (): Promise<EduSavedCred | null> =>
    nativeEdu()
      ? TtCredentials.get().then((r) => (r.ok && r.username && r.password ? { username: r.username, password: r.password } : null), () => null)
      : Promise.resolve(null),
  clear: (): Promise<boolean> => nativeEdu() ? TtCredentials.clear().then((r) => r.ok, () => false) : Promise.resolve(false),
}

export const nativeEdu = () => Capacitor.getPlatform() === 'android'

/** 本地识别的预处理视图数，与 `OcrEngine.kt` 的 `VIEWS` 表一一对应（越界值原生侧夹取） */
export const CAPTCHA_OCR_VIEWS = 2

/**
 * 验证码本地识别：模型随包分发（ddddocr，MIT），推理在设备上跑，图片不出设备、不落盘。
 * 只在应用内可用（浏览器预览没有原生插件）。同一张图换视图重试不联网。
 */
export const eduOcr = {
  /** 失败/环境不支持时 reject，调用方按「没认出来」处理（换一张重试或交给人工） */
  recognize: (image: string, view: number): Promise<{ text: string; provider: string }> =>
    nativeEdu() ? TtOcr.recognize({ image, view }) : Promise.reject(new Error('本地识别仅在应用内可用')),
  /** 推理自检：失败/环境不支持时 reject */
  diagnose: (): Promise<OcrDiagnostics> =>
    nativeEdu() ? TtOcr.diagnose() : Promise.reject(new Error('本地识别仅在应用内可用')),
}

export const RUN_TIMEOUT = 20_000

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: number
}

const pending = new Map<string, Pending>()
let messageHandle: Promise<PluginListenerHandle> | null = null

/** 页面脚本的回传：{ id, ok, r | e } */
export function settleMessage(data: string): boolean {
  let msg: { id?: unknown; ok?: unknown; r?: unknown; e?: unknown }
  try {
    msg = JSON.parse(data) as typeof msg
  } catch {
    return false
  }
  if (typeof msg.id !== 'string') return false
  const p = pending.get(msg.id)
  if (!p) return false
  pending.delete(msg.id)
  window.clearTimeout(p.timer)
  if (msg.ok) p.resolve(msg.r ?? null)
  else p.reject(new Error(typeof msg.e === 'string' && msg.e ? msg.e : '脚本执行失败'))
  return true
}

function ensureMessageListener() {
  if (messageHandle) return
  messageHandle = TtEdu.addListener('message', (e) => {
    settleMessage(e.data)
  })
}

function rejectAll(reason: string) {
  for (const [, p] of pending) {
    window.clearTimeout(p.timer)
    p.reject(new Error(reason))
  }
  pending.clear()
}

/** 在学校页面里跑一段 async 函数体，等它经 TtBridge.post 回传的结果；bg 为自动更新的不可见页面 */
export function run<T>(body: string, timeout = RUN_TIMEOUT, bg = false): Promise<T> {
  if (!nativeEdu()) return Promise.reject(new Error('内置浏览器仅在应用内可用'))
  ensureMessageListener()
  const id = uid()
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('页面没有响应'))
    }, timeout)
    pending.set(id, { resolve: (v) => resolve(v as T), reject, timer })
    const js = wrapRun(id, body)
    ;(bg ? TtEdu.bgEval({ js }) : TtEdu.eval({ js })).catch((e: unknown) => {
      if (!pending.has(id)) return
      pending.delete(id)
      window.clearTimeout(timer)
      reject(e instanceof Error ? e : new Error(String(e)))
    })
  })
}

/** 每所学校一个 WebView Profile，按教务站的主机名区分 */
export function eduProfile(url: string): string {
  let host = url
  try {
    host = new URL(url).host
  } catch {
    host = url.replace(/^https?:\/\//, '').split('/')[0]
  }
  return `edu-${host.toLowerCase().replace(/[^a-z0-9.-]/g, '_')}`
}

export const edu = {
  /** keep：保留该学校的会话 Cookie（支持多 Profile 时跨会话保留，免得反复验证码）；返回本次会话是否落在独立 Profile 里 */
  open: (url: string, keep = false): Promise<boolean> =>
    nativeEdu() ? TtEdu.open({ url, profile: eduProfile(url), keep }).then((r) => r.persistent, () => false) : Promise.resolve(false),
  close: (keep = false) => {
    rejectAll('浏览器已关闭')
    return nativeEdu() ? TtEdu.close({ keep }) : Promise.resolve()
  },
  /** 系统 WebView 是否支持多 Profile（会话保留与自动更新的前提） */
  profiles: (): Promise<boolean> => (nativeEdu() ? TtEdu.profiles().then((r) => r.supported, () => false) : Promise.resolve(false)),
  clearProfile: (url: string): Promise<boolean> =>
    nativeEdu() ? TtEdu.clearProfile({ profile: eduProfile(url) }).then((r) => r.ok, () => false) : Promise.resolve(false),
  /** 直登 HTTP：profile 由调用方给定（学校 Profile，不按请求地址推导） */
  http: (req: { url: string; method?: string; headers?: Record<string, string>; body?: string; binary?: boolean }): Promise<EduHttpResult> =>
    nativeEdu() ? TtEdu.http(req) : Promise.reject(new Error('仅在应用内可用')),
  setCookies: (profile: string, url: string, cookies: string[]): Promise<boolean> =>
    nativeEdu() ? TtEdu.setCookies({ profile, url, cookies }).then((r) => r.ok, () => false) : Promise.resolve(false),
  getCookies: (profile: string, url: string): Promise<string | null> =>
    nativeEdu() ? TtEdu.getCookies({ profile, url }).then((r) => r.cookie, () => null) : Promise.resolve(null),
  bgOpen: (url: string) => (nativeEdu() ? TtEdu.bgOpen({ url, profile: eduProfile(url) }) : Promise.reject(new Error('仅在应用内可用'))),
  bgClose: () => (nativeEdu() ? TtEdu.bgClose() : Promise.resolve()),
  onBgNav: (fn: (e: EduBgNav) => void): (() => void) => {
    if (!nativeEdu()) return () => {}
    const h = TtEdu.addListener('bgNav', fn)
    return () => void h.then((x) => x.remove())
  },
  bgZfFetch: (xnm: string, xqm: string) => run<ZfKb[]>(zfFetchJs(xnm, xqm), RUN_TIMEOUT, true),
  bgPageHtml: () => run<string>(PAGE_HTML_JS, RUN_TIMEOUT, true),
  navigate: (url: string) => (nativeEdu() ? TtEdu.navigate({ url }) : Promise.resolve()),
  reload: () => (nativeEdu() ? TtEdu.reload() : Promise.resolve()),
  stop: () => (nativeEdu() ? TtEdu.stop() : Promise.resolve()),
  /** 当前学校页面的定格图（data URL）；退场时贴在透明洞里随页一起滑走 */
  snapshot: (): Promise<string | null> => (nativeEdu() ? TtEdu.snapshot().then((r) => r.src || null, () => null) : Promise.resolve(null)),
  back: () => (nativeEdu() ? TtEdu.back() : Promise.resolve({ went: false })),
  frame: (f: EduFrame) => (nativeEdu() ? TtEdu.frame(f) : Promise.resolve()),
  state: (): Promise<EduNav | null> => (nativeEdu() ? TtEdu.state() : Promise.resolve(null)),
  /** 订阅页面导航事件；返回取消函数 */
  onNav: (fn: (e: EduNav) => void): (() => void) => {
    if (!nativeEdu()) return () => {}
    const h = TtEdu.addListener('nav', fn)
    return () => void h.then((x) => x.remove())
  },
  probe: () => run<ProbeResult>(PROBE_JS),
  zfFetch: (xnm: string, xqm: string) => run<ZfKb[]>(zfFetchJs(xnm, xqm)),
  pageHtml: () => run<string>(PAGE_HTML_JS),
  pageText: () => run<string>(PAGE_TEXT_JS),
  /** 调试包：主文档与同源子框架的 HTML 及编码信息 */
  capture: () => run<PageCapture>(PAGE_CAPTURE_JS),
}

let profilesP: Promise<boolean> | null = null

/** 系统 WebView 是否支持多 Profile；只查一次，浏览器开关与自动更新开关共用 */
export function profilesSupported(): Promise<boolean> {
  profilesP ??= edu.profiles()
  return profilesP
}
