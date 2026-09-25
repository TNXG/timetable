/**
 * 新疆理工职业大学统一身份认证（CAS）的登录件：纯函数 + 密码加密。
 * 流程与易错点见 docs/CAS_LOGIN.md：读 execution → 拿公钥（同时种下 _pv0CAS）→ 验证码 → 提交登录。
 * HTTP 由插件借软件的原生能力逐跳发出，这里只做解析、加密和 Cookie 瓶；凭证不落库、不上传。
 */

/** 从登录页 HTML 里拿 execution（隐藏域），没有就是 null（未渲染登录表单） */
export function extractExecution(html: string): string | null {
  const m = /name=["']execution["']\s+value=["']([^"']+)["']/.exec(html)
  return m ? m[1] : null
}

/** 登录失败时页面重渲染，原因在 class 带 error 的元素的文字里 */
export function casErrorText(html: string): string {
  const m = /class="[^"]*error[^"]*"[^>]*>\s*([^<]+)</.exec(html)
  return m ? m[1].trim() : ''
}

/** 这次失败只是验证码不对（凭据没错，可以换一张自动重试） */
export const isCaptchaError = (raw: string): boolean => /FailedAuthcodeException/i.test(raw)

/** CAS 失败原文 → 界面上的话；原文没有认出的就原样给出（截断） */
export function describeCasError(raw: string): string {
  if (isCaptchaError(raw)) return '验证码不对'
  if (/not recognized/i.test(raw)) return '账号或密码不对'
  if (/flow|execution/i.test(raw)) return '登录过期了，请重试'
  if (/没有响应|超时/.test(raw)) return '登录没有响应，请重试'
  const t = raw.trim()
  if (!t) return '登录失败，请重试'
  return t.length <= 60 ? t : '登录失败，请重试'
}

/* ---------------- Cookie 瓶：host 一个瓶，登录流程在内存里攒，结束交给软件 ---------------- */

/** 收下一组 Set-Cookie：只取 name=value（属性丢弃，软件按 url 种回 Profile） */
export function applySetCookie(jar: Map<string, string>, setCookies: string[]): void {
  for (const line of setCookies) {
    const pair = line.split(';', 1)[0]
    const at = pair.indexOf('=')
    if (at <= 0) continue
    jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
  }
}

/** 瓶里现有的 Cookie 拼成请求头；空瓶给 undefined（不发 Cookie 头） */
export function cookieHeaderValue(jar: Map<string, string>): string | undefined {
  if (jar.size === 0) return undefined
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

/** 把 CookieManager 读回来的 "k=v; k2=v2" 头拆回瓶（begin 探测已有会话用） */
export function parseCookieHeader(header: string): Map<string, string> {
  const jar = new Map<string, string>()
  for (const pair of header.split(';')) {
    const at = pair.indexOf('=')
    if (at <= 0) continue
    jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
  }
  return jar
}

function modPow(m: bigint, e: bigint, n: bigint): bigint {
  let r = 1n
  let base = m % n
  while (e > 0n) {
    if (e & 1n) r = (r * base) % n
    base = (base * base) % n
    e >>= 1n
  }
  return r
}

/**
 * CAS 的密码加密：RSA 但不做 PKCS#1 填充，就是 pow(m, e, n)。
 * 页面 JS 先把密码倒序、按块（512 位密钥每块 62 字节）打包，块内字节序又把倒序抵消——
 * 这里与 docs/cas_login.py 的 encrypt_password 逐行对应，入参是明文密码。
 */
export function encryptCasPassword(password: string, modulusHex: string, exponentHex: string): string {
  const n = BigInt(`0x${modulusHex}`)
  const e = BigInt(`0x${exponentHex}`)
  const chunk = 2 * (Math.floor(n.toString(2).length / 16) - 1)
  if (chunk <= 0) throw new Error('公钥不对')
  /* a[] 取 charCode（同页面 security.js）；先整串倒序 */
  const a: number[] = [...password].reverse().map((c) => c.charCodeAt(0))
  while (a.length % chunk !== 0) a.push(0)
  const out: string[] = []
  for (let i = 0; i < a.length; i += chunk) {
    /* 块内字节再倒序后按大端取整：等于页面 JS 的 16 位小端打包 */
    let m = 0n
    for (const b of a.slice(i, i + chunk).reverse()) m = (m << 8n) | BigInt(b)
    const h = modPow(m, e, n).toString(16)
    out.push('0'.repeat((4 - (h.length % 4)) % 4) + h)
  }
  return out.join(' ')
}
