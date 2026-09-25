import { beforeEach, describe, expect, it } from 'vitest'
import type { EduHttpRequest, EduHttpResult } from '../edu/plugin'
import { flow } from '../edu/plugins/xjvut'
import { encryptCasPassword } from '../edu/cas'

/* 固定 512 位奇数模数（f 开头 d 结尾），与 cas.test.ts 同一枚 */
const N_HEX = `f${'ab'.repeat(63)}d`

/* ---------------- 仿真学校：CAS + 教务（正方）两台主机，协议按 2026-09 实测 ---------------- */

const CAS = 'https://qyrz.xjvut.edu.cn'
const JW = 'https://jw.xjvut.edu.cn:6082'
/** 教务 SSO 入口（portal 服务记录里的 fwdz）：TGT 在这里换 ticket，ticketlogin 签发会话 */
const SSO_JUMP = `${JW}/sso/zfiotlogin?url=kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default`
const INDEX_URL = `${JW}/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default`
const KB_URL = `${JW}/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151`
const RJC_URL = `${JW}/jwglxt/kbcx/xskbcx_cxRjc.html?gnmkdm=N2151`
/* 作息：qssj/jssj 形如 "10:00 - 10:45" */
const rjcJson = JSON.stringify([
  { jcmc: '1', qssj: '10:00 - 10:45', jssj: '', rsdmc: '上午' },
  { jcmc: '2', qssj: '10:55', jssj: '11:40', rsdmc: '上午' },
])

const loginPage = (error = '') =>
  `<html><form><input name="execution" value="e-token"><span class="error">${error}</span></form></html>`
const indexPage =
  '<html><select name="xnm" id="xnm"><option value="2025">2025</option><option value="2026" selected>2026</option></select>' +
  '<select name="xqm" id="xqm"><option value="3" selected>第1学期</option><option value="12">第2学期</option></select></html>'
const kbJson = JSON.stringify({
  xsxx: { XH: '202312345', XM: '张三' },
  kbList: [
    { kcmc: '高等数学A1', xm: '张哲', cdmc: '综合教学楼513', xqj: '1', jcs: '3-4', zcd: '5-13周(单),14-16周' },
    { kcmc: '大学英语Ⅰ', xm: '陶俊', cdmc: '综合教学楼511', xqj: '2', jcs: '3-4', zcd: '5-16周' },
  ],
})

interface Hop {
  url: string
  method: string
  cookie: string | null
  body: string | null
}

/**
 * 会话模型：CAS 有 TGC=tgt1 即已登录；教务未认证会话 JSESSIONID=js0（zfiotlogin 换 ticket 时种下），
 * ticketlogin 把它升级成 js2+rememberMe。教务普通页面没会话只跳自己的登录页，zfiotlogin 才去 CAS。
 */
function makeServer(opts: { loginError?: string; kaptcha?: boolean } = {}) {
  const hops: Hop[] = []
  const respond = (req: EduHttpRequest): EduHttpResult => {
    const url = req.url
    const method = req.method ?? 'GET'
    const cookie = req.headers?.Cookie ?? null
    const out = (body: string, status = 200, location?: string, cookies: string[] = []): EduHttpResult => ({
      status,
      url,
      headers: { ...(cookies.length ? { 'Set-Cookie': cookies } : {}), ...(location ? { Location: [location] } : {}) },
      body,
    })
    hops.push({ url, method, cookie, body: req.body ?? null })

    if (url === `${CAS}/cas/login`) {
      if (method === 'POST') {
        if (opts.loginError) return out(loginPage(opts.loginError), 401)
        return out('ok', 302, `${CAS}/cas/success`, ['TGC=tgt1; Path=/'])
      }
      return out(loginPage(opts.loginError ?? ''))
    }
    if (url.startsWith(`${CAS}/cas/login?service=`)) {
      if (!cookie?.includes('TGC=tgt1')) return out(loginPage())
      return out('', 302, `${SSO_JUMP}&ticket=ST-1`)
    }
    if (url === `${CAS}/cas/v1/getPubKey`) return out(JSON.stringify({ modulus: N_HEX, exponent: '10001' }), 200, undefined, ['_pv0CAS=pk1; Path=/'])
    if (url === `${CAS}/cas/getKaptchaStatus`) return out(opts.kaptcha === true ? 'true' : 'false')
    if (url.startsWith(`${CAS}/cas/kaptcha?time=`)) return out('aGFoYQ==')
    if (url === `${CAS}/cas/success`) return out('登录成功')

    if (url.startsWith(`${JW}/sso/zfiotlogin`)) {
      if (url.includes('&ticket=')) return out('', 302, SSO_JUMP, ['JSESSIONID=js0; Path=/'])
      if (cookie?.includes('JSESSIONID=js0')) return out('', 302, `${JW}/jwglxt/ticketlogin?uid=202312345&timestamp=1790264217&verify=c6815060b217e55ff9fa23bd4f4e4236&url=kbcx%2Fxskbcx_cxXskbcxIndex.html`)
      return out('', 302, `${CAS}/cas/login?service=${encodeURIComponent(SSO_JUMP)}`, ['route=jw-route; Path=/'])
    }
    if (url.startsWith(`${JW}/jwglxt/ticketlogin?`)) {
      return out('', 302, 'kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default', ['JSESSIONID=js2; Path=/jwglxt', 'rememberMe=r1; Path=/'])
    }
    if (url === INDEX_URL) return out(indexPage)
    if (url === KB_URL) {
      if (method === 'POST') {
        if (cookie?.includes('JSESSIONID=js2')) return out(kbJson, 200, undefined, [])
        return out('', 901)
      }
      return out('', 302, '/jwglxt/xtgl/login_slogin.html')
    }
    if (url === RJC_URL) return out(rjcJson)
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
  it('未登录：begin 出表单；login 后走 zfiotlogin 签发教务会话，落在课表索引页', async () => {
    const server = makeServer()
    const b = await flow.begin(server.http, noCookies)
    expect(b).toEqual({ kind: 'form', captcha: null })

    const out = await flow.login(server.http, { username: '202312345', password: 'pw', captcha: '' })
    expect(out.kind).toBe('ok')
    if (out.kind !== 'ok') return
    expect(out.url).toBe(INDEX_URL)
    expect(out.jars).toContainEqual({ url: CAS, cookies: expect.arrayContaining(['TGC=tgt1', '_pv0CAS=pk1']) })
    expect(out.jars).toContainEqual({ url: JW, cookies: expect.arrayContaining(['JSESSIONID=js2', 'route=jw-route', 'rememberMe=r1']) })

    /* 登录 POST 带 _pv0CAS；zfiotlogin 换 ticket 带 TGC；最终索引页请求带签发好的 JSESSIONID+route */
    const post = server.hops.find((h) => h.method === 'POST' && h.url === `${CAS}/cas/login`)
    expect(post?.cookie).toContain('_pv0CAS=pk1')
    const postBody = Object.fromEntries(new URLSearchParams(post?.body ?? ''))
    expect(postBody.username).toBe('202312345')
    expect(postBody.password).toBe(encryptCasPassword('pw', N_HEX, '10001'))
    expect(postBody.authcode).toBe('')
    expect(postBody.execution).toBe('e-token')
    expect(postBody).toMatchObject({ code: '', _eventId: 'submit', type: 'zhmm' })
    const sso = server.hops.filter((h) => h.url.startsWith(`${CAS}/cas/login?service=`)).at(-1)
    expect(sso?.cookie).toContain('TGC=tgt1')
    const last = server.hops.at(-1)
    expect(last?.url).toBe(INDEX_URL)
    expect(last?.cookie).toContain('JSESSIONID=js2')
    expect(last?.cookie).toContain('route=jw-route')
  })

  it('fetchTimetable：读索引页选中的学期，POST 拿 kbList 转规则输出', async () => {
    const server = makeServer()
    await flow.begin(server.http, noCookies)
    await flow.login(server.http, { username: '202312345', password: 'pw', captcha: '' })
    const kb = await flow.fetchTimetable!(server.http)
    expect(kb).not.toBeNull()
    if (!kb) return
    expect(kb.term).toEqual({ xnm: '2026', xqm: '3' })
    expect(kb.pageUrl).toBe(INDEX_URL)
    expect(kb.out.semester).toEqual({ name: '2026–2027 学年 第 1 学期' })
    expect(kb.out.courses.map((c) => c.name)).toEqual(['高等数学A1', '大学英语Ⅰ'])
    expect(kb.out.timeGrid).toEqual([
      { index: 1, start: 600, end: 645 },
      { index: 2, start: 655, end: 700 },
    ])
    const kbPost = server.hops.find((h) => h.method === 'POST' && h.url === KB_URL)
    expect(kbPost?.cookie).toContain('JSESSIONID=js2')
    expect(kbPost?.body).toBe('xnm=2026&xqm=3&kzlx=ck&xsdm=&kclbdm=&kclxdm=')
    const rjcPost = server.hops.find((h) => h.method === 'POST' && h.url === RJC_URL)
    expect(rjcPost?.body).toBe('xnm=2026&xqm=3')
  })

  it('fetchTimetable：CAS TGT 死了给 null（链子停在 CAS 登录表单），不炸', async () => {
    const server = makeServer()
    await expect(flow.fetchTimetable!(server.http)).resolves.toBeNull()
  })

  it('会话还有效（Profile 里有 TGC + 教务会话）：begin 直接 ready，不用表单', async () => {
    const server = makeServer()
    const b = await flow.begin(server.http, async (url) =>
      url.startsWith(CAS) ? 'TGC=tgt1' : 'JSESSIONID=js2; route=jw-route')
    expect(b).toEqual({ kind: 'ready', url: INDEX_URL, jars: expect.any(Array) })
    expect(server.hops.some((h) => h.method === 'POST')).toBe(false)
  })

  it('验证码不对：fail 带人话且标记 captcha，页面据此换一张自动重试', async () => {
    const server = makeServer({ loginError: 'authenticationFailure.FailedAuthcodeException' })
    await flow.begin(server.http, noCookies)
    const out = await flow.login(server.http, { username: 'x', password: 'pw', captcha: '9' })
    expect(out).toEqual({ kind: 'fail', message: '验证码不对', captcha: true })
  })

  it('账号密码不对：fail 不带 captcha 标记（不许拿错凭据反复试）', async () => {
    const server = makeServer({ loginError: 'authenticationFailure.AccountNotFoundException: 用户名或密码无效 not recognized' })
    await flow.begin(server.http, noCookies)
    const out = await flow.login(server.http, { username: 'x', password: 'pw', captcha: '9' })
    expect(out).toEqual({ kind: 'fail', message: '账号或密码不对', captcha: false })
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
