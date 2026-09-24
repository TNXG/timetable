/** 教务直登：应用自己的登录页（学号/密码/验证码可选）。是否启用、验证码要不要、怎么登，
    全部由学校插件声明与实现（auth.flow）：插件借原生 HTTP 逐跳登录，把各主机的会话 Cookie
    交给软件种进学校 Profile，成功后浏览器直接落在课表页。凭证不落库，会话 Cookie 也不留在此页。 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EduCookieJar, EduHttp, EduPlugin } from '../../domain/edu/plugin'
import { edu, eduProfile, nativeEdu } from '../edu-browser'
import { setEduBrowserOpen } from '../edu-sync'
import { haptic } from '../widgets'
import { Field, Loader, Page, PrimaryButton, TextInput, TopBar } from '../ui'
import { PageBody, PageFooter } from '../course/shared'

type Phase = 'connect' | 'form' | 'submit'

/** 网络/环境类错误给一句人话，其余原样 */
const netMsg = (e: unknown): string => {
  const m = e instanceof Error ? e.message : ''
  if (/resolve|timeout|timed out|Network|connect/i.test(m)) return '网络不通，请重试'
  return m || '登录失败，请重试'
}

export function EduLoginPage({ plugin, onBack, onDone }: {
  plugin: EduPlugin
  onBack: () => void
  /** 登录成功（或会话还有效）：带上落点地址，交给内置浏览器接着用 */
  onDone: (url: string) => void
}) {
  const flow = plugin.auth.kind === 'login' ? plugin.auth.flow : null
  const native = nativeEdu()
  const profile = eduProfile(plugin.url)
  const [phase, setPhase] = useState<Phase>('connect')
  const [fatal, setFatal] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authcode, setAuthcode] = useState('')
  /** null = 这次不用验证码，整行不出现 */
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [capBusy, setCapBusy] = useState(false)

  const doneRef = useRef(false)
  /** onDone 每次渲染都是新闭包，钉进 ref：登录流程挂载一次，不能被 30s 的全局重渲染打断 */
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  const finish = useCallback((url: string) => {
    doneRef.current = true
    onDoneRef.current(url)
  }, [])

  const http: EduHttp = (req) => edu.http(req)

  /** 插件交回的会话 Cookie 种进学校 Profile：CAS 的 TGT、教务的 JSESSIONID/route 都在这里 */
  const seed = useCallback(async (jars: EduCookieJar[]) => {
    for (const j of jars) await edu.setCookies(profile, j.url, j.cookies)
  }, [profile])

  /** 先拿 Profile 里的已有会话探一轮：活着直接进浏览器；没活拿验证码出表单。
      keepError：失败重试时错误话要留住，别被这里清掉 */
  const begin = useCallback(async (keepError = false) => {
    setPhase('connect')
    setFatal(null)
    if (!keepError) setError('')
    try {
      const b = await flow!.begin(http, (url) => edu.getCookies(profile, url))
      if (b.kind === 'ready') {
        await seed(b.jars)
        haptic('success')
        finish(b.url)
        return
      }
      setCaptcha(b.captcha)
      setPhase('form')
    } catch (e) {
      setFatal(netMsg(e))
    }
  }, [flow, profile, seed, finish])

  const submit = useCallback(async () => {
    if (!flow || phase === 'submit') return
    const name = username.trim()
    const code = captcha != null ? authcode.trim() : ''
    if (!name || !password || (captcha != null && !code)) return
    setPhase('submit')
    setError('')
    try {
      const out = await flow.login(http, { username: name, password, captcha: code })
      if (out.kind === 'ok') {
        await seed(out.jars)
        haptic('success')
        finish(out.url)
        return
      }
      /* 服务器已换掉 execution/公钥：整轮重来，验证码必换新 */
      setError(out.message)
      setAuthcode('')
      await begin(true)
    } catch (e) {
      setError(netMsg(e))
      setAuthcode('')
      await begin(true)
    } finally {
      setPhase((cur) => (cur === 'submit' ? 'form' : cur))
    }
  }, [flow, phase, username, password, authcode, captcha, begin, seed, finish])

  const refreshCaptcha = useCallback(async () => {
    if (capBusy || !flow) return
    setCapBusy(true)
    try {
      if (flow.refreshCaptcha) {
        setCaptcha(await flow.refreshCaptcha(http))
        setError('')
      } else {
        await begin()
      }
    } catch {
      setError('验证码没刷出来，再点一次')
    } finally {
      setCapBusy(false)
    }
  }, [capBusy, flow, begin])

  useEffect(() => {
    if (!native || !flow) {
      setFatal('仅在应用内可用')
      return
    }
    setEduBrowserOpen(true)
    void begin()
    return () => {
      /* 登录中途退出：没种过 Cookie，Profile 不用清；成了就交给浏览器按保持登录的规矩管 */
      if (!doneRef.current) setEduBrowserOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = !!username.trim() && !!password && (captcha == null || !!authcode.trim())

  return (
    <Page>
      <PageBody>
        <TopBar title="登录" sub={plugin.name} onBack={onBack} />

        {fatal ? (
          <div className="mt-6 rounded-[16px] bg-(--c-surface) px-4 py-6 text-center">
            <div className="text-[13.5px] font-bold text-(--c-ink)">{fatal}</div>
            {native && flow && (
              <button className="mt-3 text-[13px] font-bold text-(--c-accent) transition-opacity active:opacity-60" onClick={() => void begin()}>
                重试
              </button>
            )}
          </div>
        ) : phase === 'connect' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24">
            <Loader size={20} />
            <div className="text-[12.5px] font-medium text-(--c-ink4)">正在连接统一身份认证</div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
            <div className="mt-5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
              <Field k="学号">
                <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              </Field>
              <Field k="密码">
                <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              {captcha != null && (
                <Field k="验证码" sub="图片里算式的得数，点图换一张">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void refreshCaptcha()}
                      aria-label="换一张验证码"
                      className="flex-none transition-transform duration-150 active:scale-[.95]"
                    >
                      {captcha && !capBusy ? (
                        <img src={captcha} alt="验证码" className="block h-[40px] rounded-[8px] bg-white" />
                      ) : (
                        <span className="flex h-[40px] w-[92px] items-center justify-center rounded-[8px] bg-(--c-bg)"><Loader size={12} /></span>
                      )}
                    </button>
                    <TextInput value={authcode} onChange={(e) => setAuthcode(e.target.value)} inputMode="numeric" placeholder="得数" className="flex-1" />
                  </div>
                </Field>
              )}
            </div>
            {error && <div className="mt-2.5 px-1 text-[12.5px] font-medium text-(--c-danger)">{error}</div>}
          </form>
        )}
      </PageBody>

      {!fatal && phase !== 'connect' && (
        <PageFooter>
          <PrimaryButton busy={phase === 'submit'} disabled={!canSubmit} onClick={() => void submit()}>
            登录
          </PrimaryButton>
        </PageFooter>
      )}
    </Page>
  )
}
