import { beforeEach, describe, expect, it } from 'vitest'
import type { EduHttpRequest, EduHttpResult } from '../edu/plugin'
import { flow } from '../edu/plugins/xjvut'
import { encryptCasPassword } from '../edu/cas'

/* 固定 512 位奇数模数（f 开头 d 结尾），与 cas.test.ts 同一枚 */
const N_HEX = `f${'ab'.repeat(63)}d`

/* ---------------- 仿真学校：CAS + 教务（正方）两台主机 ---------------- */

const CAS = 'https://qyrz.xjvut.edu.cn'
const JW = 'https://jw.xjvut.edu.cn:6082'
const TIMETABLE = `${JW}/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151`

const loginPage = (error = '') =>
  `<html><form><input name="execution" value="e-token"><span class="error">${error}</span></form></html>`
const timetablePage = '<html><title>我的课表</title><table>星期一</table></html>'

interface Hop {
  url: string
  method: string
  cookie: string | null
  body: string | null
}

/** 按状态机回响应：Cookie 里有 TGC 就是已登录；教务没会话就踢去 CAS 换 ticket */
function makeServer(opts: { loginError?: string; kaptcha?: boolean } = {}) {
  const hops: Hop[] = []
  const respond = (req: EduHttpRequest): EduHttpResult => {
    const url = req.url
    const method = req.method ?? 'GET'
    const cookie = req.headers?.Cookie ?? null
    const withCookie = (name: string, value: string, body: string, status = 200, location?: string): EduHttpResult => ({
      status,
      url,
      headers: { 'Set-Cookie': [`${name}=${value}; Path=/`], ...(location ? { Location: [location] } : {}) },
      body,
    })
    hops.push({ url, method, cookie, body: req.body ?? null })

    if (url === `${CAS}/cas/login`) {
      /* 有 TGT 就是已登录（初始没有，登录 POST 之后才有）；无效/没有：登录表单（失败时带错误） */
      if (method === 'POST') {
        if (opts.loginError) return withCookie('TGC', 'tgt2', loginPage(opts.loginError), 401)
        return withCookie('TGC', 'tgt1', 'ok', 302, `${CAS}/cas/success`)
      }
      if (cookie?.includes('TGC=tgt1')) return withCookie('SESSION', 's1', '已登录')
      return withCookie('route', 'cas-route', loginPage(opts.loginError ?? ''))
    }
    if (url === `${CAS}/cas/v1/getPubKey`) return withCookie('_pv0CAS', 'pk1', JSON.stringify({ modulus: N_HEX, exponent: '10001' }))
    if (url === `${CAS}/cas/getKaptchaStatus`) return withCookie('SESSION', 's1', opts.kaptcha === true ? 'true' : 'false')
    if (url.startsWith(`${CAS}/cas/kaptcha?time=`)) return withCookie('SESSION', 's1', 'aGFoYQ==')
    if (url === `${CAS}/cas/success`) return withCookie('SESSION', 's1', '登录成功')

    if (url === TIMETABLE) {
      if (cookie?.includes('JSESSIONID=js1')) return withCookie('SESSION', 's2', timetablePage)
      /* 教务没会话：先发 route，再踢去 CAS 换 ticket */
      return withCookie('route', 'jw-route', '', 302, `${CAS}/cas/login?service=${encodeURIComponent(TIMETABLE)}`)
    }
    if (url.startsWith(`${TIMETABLE}&ticket=`)) return withCookie('JSESSIONID', 'js1', '', 302, TIMETABLE)
    /* CAS 带 TGT 换 ticket 回教务：302 回课表页 */
    if (url.startsWith(`${CAS}/cas/login?service=`)) {
      if (!cookie?.includes('TGC=tgt1')) return withCookie('route', 'cas-route', loginPage())
      return withCookie('SESSION', 's1', '', 302, `${TIMETABLE}&ticket=ST-1`)
    }
    throw new Error(`仿真学校不认识 ${method} ${url}`)
  }
  return {
    hops,
    http: async (req: EduHttpRequest) => respond(req),
  }
}

const noCookies = async () => null

beforeEach(() => {
  /* flow 的瓶是模块级状态：每个用例从干净会话开始（用一次带空 Cookie 的 begin 顺带重置） */
  return flow.begin(makeServer().http, noCookies).then(() => undefined)
})

describe('xjvut 直登流程', () => {
  it('未登录：begin 出表单，这次不要验证码；login 换到两台主机的会话 Cookie 并落在课表页', async () => {
    const server = makeServer()
    const b = await flow.begin(server.http, noCookies)
    expect(b).toEqual({ kind: 'form', captcha: null })

    const out = await flow.login(server.http, { username: '202312345', password: 'pw', captcha: '' })
    expect(out.kind).toBe('ok')
    if (out.kind !== 'ok') return
    expect(out.url).toBe(TIMETABLE)
    expect(out.jars).toContainEqual({ url: CAS, cookies: expect.arrayContaining(['TGC=tgt1', '_pv0CAS=pk1']) })
    expect(out.jars).toContainEqual({ url: JW, cookies: expect.arrayContaining(['JSESSIONID=js1', 'route=jw-route']) })

    /* 登录 POST 带 _pv0CAS；课表 SSO 带 TGC；最终课表请求带 JSESSIONID + route */
    const post = server.hops.find((h) => h.method === 'POST' && h.url === `${CAS}/cas/login`)
    expect(post?.cookie).toContain('_pv0CAS=pk1')
    const postBody = Object.fromEntries(new URLSearchParams(post?.body ?? ''))
    expect(postBody.username).toBe('202312345')
    expect(postBody.password).toBe(encryptCasPassword('pw', N_HEX, '10001'))
    expect(postBody.authcode).toBe('')
    expect(postBody.execution).toBe('e-token')
    expect(postBody).toMatchObject({ code: '', _eventId: 'submit', type: 'zhmm' })
    const sso = server.hops.find((h) => h.url.startsWith(`${CAS}/cas/login?service=`))
    expect(sso?.cookie).toContain('TGC=tgt1')
    const last = server.hops.at(-1)
    expect(last?.cookie).toContain('JSESSIONID=js1')
    expect(last?.cookie).toContain('route=jw-route')
  })

  it('会话还有效（Profile 里有 TGC + JSESSIONID）：begin 直接 ready，不用表单', async () => {
    const server = makeServer()
    const b = await flow.begin(server.http, async (url) =>
      url.startsWith(CAS) ? 'TGC=tgt1' : 'JSESSIONID=js1; route=jw-route')
    expect(b).toEqual({ kind: 'ready', url: TIMETABLE, jars: expect.any(Array) })
    expect(server.hops.some((h) => h.method === 'POST')).toBe(false)
  })

  it('验证码不对：fail 带人话；重试时瓶里留着旧会话也会被服务端拒绝后重建', async () => {
    const server = makeServer({ loginError: 'authenticationFailure.FailedAuthcodeException' })
    await flow.begin(server.http, noCookies)
    const out = await flow.login(server.http, { username: 'x', password: 'pw', captcha: '9' })
    expect(out).toEqual({ kind: 'fail', message: '验证码不对' })
  })

  it('要验证码的学校：begin 带回验证码图片（base64 data URL），login 把答案带上', async () => {
    const server = makeServer({ kaptcha: true })
    const b = await flow.begin(server.http, noCookies)
    expect(b.kind).toBe('form')
    if (b.kind !== 'form') return
    expect(b.captcha).toMatch(/^data:image\/png;base64,aGFoYQ==$/)

    const out = await flow.login(server.http, { username: 'x', password: 'pw', captcha: '19' })
    expect(out.kind).toBe('ok')
    const post = server.hops.find((h) => h.method === 'POST' && h.url === `${CAS}/cas/login`)
    expect(Object.fromEntries(new URLSearchParams(post?.body ?? '')).authcode).toBe('19')
  })
})
