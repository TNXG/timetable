import type { EduCookieJar, EduHttp, EduHttpRequest, EduHttpResult, EduKbFetch, EduLoginBegin, EduLoginFlow, EduPlugin } from '../plugin'
import { applySetCookie, casErrorText, cookieHeaderValue, describeCasError, encryptCasPassword, extractExecution, isCaptchaError, parseCookieHeader } from '../cas'
import { guessTerm, parseZfKbList, termLabel, zfTimeGrid, type ZfTerm } from '../zhengfang'

/** 新疆理工职业大学：统一身份认证（CAS）直登 + 教务（正方新版）原生取课表。
 *  流程（docs/CAS_LOGIN.md 第 5-6 步，2026-09 实测）：CAS 表单登录拿 TGT →
 *  GET jw/sso/zfiotlogin?url=课表索引页（教务不认 CAS 跳转、表单也不吃 CAS 密码，
 *  唯它拿 TGT 换 ticket → 内部 ticketlogin 以 uid+timestamp+verify 签发已认证教务会话）→
 *  POST xskbcx_cxXsgrkb.html 拿课表 JSON。全程原生 HTTP 逐跳收 Cookie，不经 WebView；
 * 用户开启保存密码时，凭据由 Android Keystore 保护，仅用于后续会话失效时自动重建 Cookie。 */

const CAS_ORIGIN = 'https://qyrz.xjvut.edu.cn'
const CAS_LOGIN = `${CAS_ORIGIN}/cas/login`
const JW_ORIGIN = 'https://jw.xjvut.edu.cn:6082'
/** 教务 SSO 入口：portal「学生课表查询」服务的 fwdz 就是它；gnmkdm=N2151 = 学生个人课表 */
const SSO_JUMP = `${JW_ORIGIN}/sso/zfiotlogin?url=kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default`
/** 个人课表数据接口：GET 是页面，POST 是 JSON */
const KB_URL = `${JW_ORIGIN}/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151`
/** SSO 成功的落点：课表索引页（学期下拉在这里） */
const INDEX_RE = /xskbcx_cxXskbcxIndex\.html/
/** 作息接口：POST xnm/xqm → 每节 jcmc/qssj/jssj（"10:00 - 10:45"） */
const RJC_URL = `${JW_ORIGIN}/jwglxt/kbcx/xskbcx_cxRjc.html?gnmkdm=N2151`

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

/** 索引页里选中的学期：xnm/xqm 下拉的 selected 项；读不到给 null（调用方按月份猜） */
function termFromIndex(html: string): ZfTerm | null {
  const selectedIn = (id: string) => {
    const seg = new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`).exec(html)
    if (!seg) return null
    return /<option[^>]*value="([^"]*)"[^>]*selected/.exec(seg[0])?.[1] ?? null
  }
  const xnm = selectedIn('xnm')
  const xqm = selectedIn('xqm')
  return xnm && xqm ? { xnm, xqm } : null
}

/** 登录后原生拉课表（docs/CAS_LOGIN.md 第 5-6 步）：先走一遍 zfiotlogin 确保教务会话是活的
 *  （TGT 活着就能换到已认证会话；死了链子停在 CAS 登录表单），读索引页选中的学期，
 *  POST 拿 JSON 转规则输出。没接上或没有课给 null，页面退回浏览器兜底。 */
async function fetchTimetable(http: EduHttp): Promise<EduKbFetch | null> {
  const page = await follow(http, SSO_JUMP)
  if (hostOf(page.url) !== new URL(JW_ORIGIN).host || !INDEX_RE.test(page.url)) return null
  const term = termFromIndex(page.body) ?? guessTerm()
  const r = await call(http, {
    url: KB_URL,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: page.url, Accept: 'application/json, text/javascript, */*; q=0.01' },
    body: new URLSearchParams({ xnm: term.xnm, xqm: term.xqm, kzlx: 'ck', xsdm: '', kclbdm: '', kclxdm: '' }).toString(),
  })
  let json: unknown
  try {
    json = JSON.parse(r.body)
  } catch {
    return null
  }
  const out = { ...parseZfKbList(json), semester: { name: termLabel(term) } }
  if (out.courses.length === 0) return null
  out.timeGrid = zfTimeGrid(await rjc(http, term))
  const studentName = cleanXsxxName(json)
  return { out, term, pageUrl: page.url, studentName }
}

/** xsxx.XM = 学生姓名；没有或空串给空 */
function cleanXsxxName(json: unknown): string {
  if (!json || typeof json !== 'object' || !('xsxx' in json)) return ''
  const xsxx: unknown = json.xsxx
  if (!xsxx || typeof xsxx !== 'object' || !('XM' in xsxx)) return ''
  const xm: unknown = xsxx.XM
  return typeof xm === 'string' ? xm.trim() : ''
}

/** 作息：日课表接口按学期给每节的起止钟点；失败不阻断导入（应用默认作息兜底） */
async function rjc(http: EduHttp, term: ZfTerm): Promise<unknown> {
  try {
    const r = await call(http, {
      url: RJC_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/javascript, */*; q=0.01' },
      body: new URLSearchParams({ xnm: term.xnm, xqm: term.xqm }).toString(),
    })
    return JSON.parse(r.body)
  } catch {
    return undefined
  }
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
    /* TGT 活着：zfiotlogin 一趟直接换到已认证教务会话，落在课表索引页 */
    const ready = await follow(http, SSO_JUMP)
    if (hostOf(ready.url) === new URL(JW_ORIGIN).host && INDEX_RE.test(ready.url)) {
      return { kind: 'ready', url: ready.url, jars: jarsOut() }
    }
    reset()
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
    /* 还在登录页 = 失败，服务器已换掉 execution：整轮重来；只是验证码错时页面会换一张自动重试 */
    if (extractExecution(r.body)) {
      const raw = casErrorText(r.body)
      const message = describeCasError(raw)
      reset()
      return { kind: 'fail', message, captcha: isCaptchaError(raw) }
    }
    /* CAS 已登录：zfiotlogin 换已认证教务会话（JSESSIONID/route/rememberMe 都进瓶） */
    const page = await follow(http, SSO_JUMP)
    if (hostOf(page.url) !== new URL(JW_ORIGIN).host || !INDEX_RE.test(page.url)) {
      reset()
      return { kind: 'fail', message: '教务登录没接上，请重试' }
    }
    return { kind: 'ok', url: page.url, jars: jarsOut() }
  },

  /** 换一张验证码：同一会话的公钥/Cookie 不动 */
  async refreshCaptcha(http) {
    const img = await call(http, { url: `${CAS_ORIGIN}/cas/kaptcha?time=${Date.now()}`, binary: true })
    const mime = (pick(img.headers, 'content-type')[0] ?? 'image/png').split(';')[0].trim()
    return `data:${mime};base64,${img.body}`
  },

  fetchTimetable,
}

export const xjvut: EduPlugin = {
  id: 'xjvut',
  name: '新疆理工职业大学 统一身份认证（CAS）',
  url: CAS_LOGIN,
  system: 'zhengfang_new',
  auth: { kind: 'login', flow },
}
