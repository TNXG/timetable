import { createPublicKey, publicEncrypt, constants } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { applySetCookie, casErrorText, cookieHeaderValue, describeCasError, encryptCasPassword, extractExecution, parseCookieHeader } from '../edu/cas'

/* 固定 512 位奇数模数（f 开头 d 结尾），指数 65537，与真实接口同规格 */
const N_HEX = `f${'ab'.repeat(63)}d`
const E_HEX = '10001'

/** 独立参照物：node:crypto 的 RSA_NO_PADDING 就是朴素 pow(m, e, n)；
 *  输入须补零到模数定长（64 字节），输出同为定长大端。e=65537 → base64 'AQAB' */
function powRef(m: Buffer): string {
  const key = createPublicKey({
    key: { kty: 'RSA', n: Buffer.from(N_HEX, 'hex').toString('base64url'), e: 'AQAB' },
    format: 'jwk',
  })
  const full = Buffer.concat([Buffer.alloc(64 - m.length), m])
  return publicEncrypt({ key, padding: constants.RSA_NO_PADDING }, full).toString('hex')
}

describe('CAS 密码加密', () => {
  /* python 参照实现按「4 的倍数」补零，openssl 定宽输出：两者按整数比对，格式另测 */
  const toInt = (hex: string) => BigInt(`0x${hex.replace(/^0+/, '') || '0'}`)

  it('单块密码 = 文档公式的 pow(m,e,n)，与 node RSA_NO_PADDING 一致', () => {
    for (const pwd of ['S3cret!pass', '202312345', 'a', 'x'.repeat(62)]) {
      const got = encryptCasPassword(pwd, N_HEX, E_HEX)
      expect(got).not.toContain(' ')
      expect(toInt(got)).toBe(toInt(powRef(Buffer.from(pwd, 'utf8'))))
    }
  })

  it('多块密码按 62 字节切块，块间空格相连，每块 4 的倍数位十六进制', () => {
    const long = 'p'.repeat(63) + 'Q9'.repeat(31) // 125 字节 → 3 块
    const chunk = 62 // 512 位模数：2 * (biHighIndex - 1)
    expect(2 * (BigInt(`0x${N_HEX}`).toString(2).length / 16 - 1)).toBe(chunk)
    const rev = [...long].reverse().map((c) => c.charCodeAt(0))
    while (rev.length % chunk) rev.push(0)
    const blocks: string[] = []
    for (let i = 0; i < rev.length; i += chunk) {
      blocks.push(powRef(Buffer.from(rev.slice(i, i + chunk).reverse())))
    }
    const got = encryptCasPassword(long, N_HEX, E_HEX).split(' ')
    expect(got.map(toInt)).toEqual(blocks.map(toInt))
    expect(got.map((b) => b.length % 4)).toEqual([0, 0, 0])
  })

  it('512 位密钥单块输出 128 位以内、4 的倍数位十六进制', () => {
    const got = encryptCasPassword('abc123', N_HEX, E_HEX)
    expect(got).toMatch(/^[0-9a-f]{100,128}$/)
    expect(got.length % 4).toBe(0)
  })
})

describe('登录页解析', () => {
  it('execution：双引号单引号都认，没有表单给 null', () => {
    expect(extractExecution('<input type="hidden" name="execution" value="e1f2a3!_">')).toBe('e1f2a3!_')
    expect(extractExecution("<input name='execution' value='e2'>")).toBe('e2')
    expect(extractExecution('<html><body>登录成功</body></html>')).toBeNull()
  })

  it('错误原因在 class 带 error 的元素里', () => {
    expect(casErrorText('<span class="errors error">authenticationFailure.FailedAuthcodeException</span>')).toBe('authenticationFailure.FailedAuthcodeException')
    expect(casErrorText('<div class="alert"><h2 class="error">Your account is not recognized</h2></div>')).toBe('Your account is not recognized')
    expect(casErrorText('<p>没有错误元素</p>')).toBe('')
  })

  it('CAS 失败文案认得出验证码、账号密码、会话过期', () => {
    expect(describeCasError('authenticationFailure.FailedAuthcodeException')).toBe('验证码不对')
    expect(describeCasError('Your account is not recognized and cannot login at this time.')).toBe('账号或密码不对')
    expect(describeCasError('Invalid authentication flow')).toBe('登录过期了，请重试')
    expect(describeCasError('')).toBe('登录失败，请重试')
    expect(describeCasError('x'.repeat(61))).toBe('登录失败，请重试')
    expect(describeCasError('密钥已停用')).toBe('密钥已停用')
  })
})

describe('Cookie 瓶', () => {
  it('Set-Cookie 只取 name=value，属性丢弃，同值覆盖', () => {
    const jar = new Map<string, string>()
    applySetCookie(jar, ['JSESSIONID=abc123; Path=/; HttpOnly', 'route=2f4a', '没有等号的垃圾', '=空名字'])
    expect([...jar]).toEqual([['JSESSIONID', 'abc123'], ['route', '2f4a']])
    applySetCookie(jar, ['JSESSIONID=def456'])
    expect(jar.get('JSESSIONID')).toBe('def456')
  })

  it('值里允许出现等号', () => {
    const jar = new Map<string, string>()
    applySetCookie(jar, ['TGC=a=b==c; Path=/cas'])
    expect(jar.get('TGC')).toBe('a=b==c')
  })

  it('请求头拼装与回拆往返一致；空瓶不发头', () => {
    const jar = new Map<string, string>()
    expect(cookieHeaderValue(jar)).toBeUndefined()
    applySetCookie(jar, ['JSESSIONID=x', 'route=r'])
    const header = cookieHeaderValue(jar)
    expect(header).toBe('JSESSIONID=x; route=r')
    expect([...parseCookieHeader(header ?? '')]).toEqual([...jar])
  })

  it('parseCookieHeader 忽略空段', () => {
    expect([...parseCookieHeader('a=1;  ; b=2')]).toEqual([['a', '1'], ['b', '2']])
  })
})
