/**
 * 学校登录插件：一家学校一个插件，只声明「从哪进、怎么登录」。
 * 直登（auth.kind = 'login'）时软件出通用登录页（学号/密码/验证码可选），登录执行归插件：
 * 插件用注入的 http 能力逐跳完成登录（不跟重定向，才能收到每一跳的 Set-Cookie），
 * 把各主机的会话 Cookie（jars）连同落点地址交给软件，软件种进学校 Profile 后进内置浏览器。
 * 页面识别与抓取脚本按教务系统区分（systems.ts / scripts.ts / zhengfang.ts），与学校无关；
 * 新学校加一个 plugins/<id>.ts 并登记进 EDU_PLUGINS 即可。
 */
import type { EduSystemId } from './systems'
import type { RuleOutput } from '../importer'
import type { ZfTerm } from './zhengfang'
import { xjvut } from './plugins/xjvut'

/** 教务站入口与学校标识；保持登录、自动更新等记录也按这三项存 */
export interface School {
  name: string
  url: string
  system: EduSystemId | null
}

/** 单次 HTTP 请求；binary=true 时 body 返回 base64（验证码图片用） */
export interface EduHttpRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  binary?: boolean
}

/** 一头一响应：headers 保留服务端大小写与多值（Set-Cookie 一组多个） */
export interface EduHttpResult {
  status: number
  url: string
  headers: Record<string, string[]>
  body: string
}

export type EduHttp = (req: EduHttpRequest) => Promise<EduHttpResult>

/** 一组同源 Cookie（name=value 串），软件按 url 种进学校 Profile 的 CookieManager */
export interface EduCookieJar {
  url: string
  cookies: string[]
}

export interface EduCredentials {
  username: string
  password: string
  /** 验证码答案；begin 说不需要时传空串 */
  captcha: string
}

/** begin：先拿已有会话试一遍，活着直接 ready（带落点与 Cookie）；没活回 form，captcha=null 表示这次不用验证码 */
export type EduLoginBegin =
  | { kind: 'form'; captcha: string | null }
  | { kind: 'ready'; url: string; jars: EduCookieJar[] }

/** login：ok 带落点与 Cookie；fail 带给用户看的话（验证码/密码错、会话过期等），页面重新 begin */
export type EduLoginOutcome =
  | { kind: 'ok'; url: string; jars: EduCookieJar[] }
  | { kind: 'fail'; message: string }

/** 登录后原生拉到的课表：正方 JSON 转好的规则输出 + 当时选中的学期 + 落点页 */
export interface EduKbFetch {
  out: RuleOutput
  term: ZfTerm
  pageUrl: string
  /** 学生姓名（xsxx.XM），登录页拿来替换界面上的默认称呼 */
  studentName: string
}

/** 学校专属的登录执行；插件是软件的一部分，只是把「这家学校怎么登」收拢在一个文件里 */
export interface EduLoginFlow {
  begin(http: EduHttp, cookie: (url: string) => Promise<string | null>): Promise<EduLoginBegin>
  login(http: EduHttp, c: EduCredentials): Promise<EduLoginOutcome>
  /** 换一张验证码（同一会话的公钥/Cookie 不动）；没实现就整轮 begin */
  refreshCaptcha?(http: EduHttp): Promise<string | null>
  /** 登录成功后用会话原生拉课表 JSON（正方学校实现）；没接上给 null，页面退回内置浏览器兜底 */
  fetchTimetable?(http: EduHttp): Promise<EduKbFetch | null>
}

/** 登录方式：login = 应用内直登页（插件声明启用并给 flow）；webview = 内置浏览器里用户自己登录 */
export type EduAuth = { kind: 'webview' } | { kind: 'login'; flow: EduLoginFlow }

export interface EduPlugin extends School {
  id: string
  auth: EduAuth
}

/** 已接入的学校；当前只为新疆理工职业大学负责 */
export const EDU_PLUGINS: EduPlugin[] = [xjvut]

/** 默认学校：首页「导入课表」直达它的登录页 */
export const DEFAULT_PLUGIN: EduPlugin = EDU_PLUGINS[0]

/** 这家学校是否启用应用内直登页（否则仍走内置浏览器自己登录） */
export const hasDirectLogin = (p: EduPlugin): boolean => p.auth.kind === 'login'
