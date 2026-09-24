import type { EduCookieJar, EduHttp, EduHttpRequest, EduHttpResult, EduLoginBegin, EduLoginFlow, EduPlugin } from '../plugin'
import { applySetCookie, casErrorText, cookieHeaderValue, describeCasError, encryptCasPassword, extractExecution, parseCookieHeader } from '../cas'

/** 新疆理工职业大学：统一身份认证（CAS）直登 + 教务（正方新版）SSO。
 *  流程（docs/CAS_LOGIN.md）：CAS 表单登录拿 TGT → 带 TGT 访问课表页走一次 SSO，
 *  教务主机会发会话 Cookie（JSESSIONID、route）——连同 CAS 的 TGT 一起交给软件种进 Profile，
 *  浏览器打开就是课表页。全程原生 HTTP，不经 WebView；凭证只在当次登录的内存里用。 */

const CAS_ORIGIN = 'https://qyrz.xjvut.edu.cn'
const CAS_LOGIN = `${CAS_ORIGIN}/cas/login`
const JW_ORIGIN = 'https://jw.xjvut.edu.cn:6082'
/** 带上会话 Cookie 就能访问的个人课表页；gnmkdm=N2151 = 学生个人课表 */
const TIMETABLE_URL = `${JW_ORIGIN}/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151`

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const HOST_ORIGIN: Record<string, string> = { [new URL(CAS_ORIGIN).host]: CAS_ORIGIN, [new URL(JW_ORIGIN).host]: JW_ORIGIN }

/** 同一次登录的瓶：CAS 放 TGT，教务放 JSESSIONID/route；begin 时重建 */
const jar = new Map<string, Map<string, string>>()
let key: { execution: string; modulus: string; exponent: string } | null = null

const hostOf = (url: string): string => new URL(url).host

function jarFor(host: string): Map<string, string> {
  let m = jar.get(host)
  if (!m) {
    m = new Map()
    jar.set(host, m)
  }
  return m
}

function reset(): void {
  jar.clear()
  key = null
}

/** 瓶里只有已知两台主机的会话；其它主机（SSO 跳过去的业务页）的会话由浏览器 SSO 自建 */
function ownHost(url: string): boolean {
  return hostOf(url) in HOST_ORIGIN
}

function pick(headers: Record<string, string[]>, name: string): string[] {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name)
  return key ? headers[key] : []
}

/** 单请求：带上瓶里这台主机的 Cookie，收 Set-Cookie（只收自己两台主机的）；UA 对齐手机浏览器 */
async function call(http: EduHttp, req: EduHttpRequest): Promise<EduHttpResult> {
  const cookie = cookieHeaderValue(jarFor(hostOf(req.url)))
  const r = await http({ ...req, headers: { 'User-Agent': UA, ...(cookie ? { Cookie: cookie } : {}), ...req.headers } })
  if (ownHost(r.url)) applySetCookie(jarFor(hostOf(r.url)), pick(r.headers, 'set-cookie'))
  return r
}

/** 逐跳跟随重定向：第一跳带 init（可能 POST），之后一律 GET；一头一响应才收得到每跳的 Cookie */
async function follow(http: EduHttp, url: string, init?: Omit<EduHttpRequest, 'url'>): Promise<EduHttpResult> {
  let cur = url
  for (let hop = 0; ; hop++) {
    const r = await call(http, hop === 0 && init ? { ...init, url: cur } : { url: cur })
    if (r.status < 300 || r.status >= 400) return r
    const loc = pick(r.headers, 'location')[0]
    if (!loc || hop >= 6) return r
    cur = new URL(loc, cur).toString()
  }
}

/** 把瓶交成软件要的形态：每台主机一组 */
function jarsOut(): EduCookieJar[] {
  const out: EduCookieJar[] = []
  for (const [host, m] of jar) {
    if (m.size === 0) continue
    out.push({ url: HOST_ORIGIN[host], cookies: [...m].map(([k, v]) => `${k}=${v}`) })
  }
  return out
}

/** CAS 会话活着的前提下，访问课表页完成教务 SSO；没接上（被踢回登录表单）给 null */
async function reachTimetable(http: EduHttp): Promise<{ url: string } | null> {
  const r = await follow(http, TIMETABLE_URL)
  if (hostOf(r.url) !== new URL(JW_ORIGIN).host) return null
  if (extractExecution(r.body)) return null
  /* ticket 已被这次 SSO 用掉：去掉参数，浏览器带着会话 Cookie 打开干净地址 */
  const u = new URL(r.url)
  u.searchParams.delete('ticket')
  return { url: u.toString() }
}

/** 未登录：拿公钥（种下 _pv0CAS）并按需取验证码 */
async function beginForm(http: EduHttp): Promise<EduLoginBegin> {
  const page = await follow(http, CAS_LOGIN)
  const execution = extractExecution(page.body)
  if (!execution) throw new Error('登录页没有就绪')
  const kr = await call(http, {
    url: `${CAS_ORIGIN}/cas/v1/getPubKey`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: '{}',
  })
  const keyJson = JSON.parse(kr.body) as { modulus?: string; exponent?: string }
  if (!keyJson.modulus) throw new Error('拿不到登录公钥')
  const status = await call(http, { url: `${CAS_ORIGIN}/cas/getKaptchaStatus` })
  const need = /true/i.test(status.body)
  let captcha: string | null = null
  if (need) {
    const img = await call(http, { url: `${CAS_ORIGIN}/cas/kaptcha?time=${Date.now()}`, binary: true })
    const mime = (pick(img.headers, 'content-type')[0] ?? 'image/png').split(';')[0].trim()
    captcha = `data:${mime};base64,${img.body}`
  }
  key = { execution, modulus: keyJson.modulus, exponent: keyJson.exponent || '10001' }
  return { kind: 'form', captcha }
}

export const flow: EduLoginFlow = {
  async begin(http, cookie) {
    reset()
    /* Profile 里两台主机的会话都拿来试：CAS 的 TGT、教务的 JSESSIONID/route */
    for (const [origin, host] of [[CAS_ORIGIN, new URL(CAS_ORIGIN).host], [JW_ORIGIN, new URL(JW_ORIGIN).host]] as const) {
      const had = parseCookieHeader((await cookie(origin)) ?? '')
      applySetCookie(jarFor(host), [...had].map(([k, v]) => `${k}=${v}`))
    }
    const page = await follow(http, CAS_LOGIN)
    if (!extractExecution(page.body)) {
      /* CAS 还认得我们：走一次教务 SSO，活着就直进 */
      const t = await reachTimetable(http)
      if (t) return { kind: 'ready', url: t.url, jars: jarsOut() }
      reset()
    }
    return beginForm(http)
  },

  async login(http, c) {
    if (!key) throw new Error('登录还没准备好')
    const enc = encryptCasPassword(c.password, key.modulus, key.exponent)
    const form = new URLSearchParams({
      username: c.username,
      password: enc,
      code: '',
      authcode: c.captcha,
      execution: key.execution,
      _eventId: 'submit',
      type: 'zhmm',
    })
    const r = await follow(http, CAS_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: CAS_LOGIN },
      body: form.toString(),
    })
    /* 还在登录页 = 失败，服务器已换掉 execution：整轮重来 */
    if (extractExecution(r.body)) {
      const message = describeCasError(casErrorText(r.body))
      reset()
      return { kind: 'fail', message }
    }
    const t = await reachTimetable(http)
    if (!t) {
      reset()
      return { kind: 'fail', message: '教务登录没接上，请重试' }
    }
    return { kind: 'ok', url: t.url, jars: jarsOut() }
  },

  /** 换一张验证码：同一会话的公钥/Cookie 不动 */
  async refreshCaptcha(http) {
    const img = await call(http, { url: `${CAS_ORIGIN}/cas/kaptcha?time=${Date.now()}`, binary: true })
    const mime = (pick(img.headers, 'content-type')[0] ?? 'image/png').split(';')[0].trim()
    return `data:${mime};base64,${img.body}`
  },
}

export const xjvut: EduPlugin = {
  id: 'xjvut',
  name: '新疆理工职业大学',
  url: CAS_LOGIN,
  system: 'zhengfang_new',
  auth: { kind: 'login', flow },
}
