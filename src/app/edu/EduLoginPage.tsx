/** 教务直登：应用自己的登录页（学号/密码/验证码可选）。是否启用、验证码怎么取与登录方式，
    全部由学校插件声明与实现（auth.flow）：插件借原生 HTTP 逐跳登录，把各主机的会话 Cookie
    交给软件种进学校 Profile，成功后原生拉一次课表 JSON 直接进导入预览；拉不到才退回
    内置浏览器（此时已登录）。凭证只在当次登录的内存里用一次；用户开「保存密码」才写入 Android Keystore 保护的应用私有凭据。
    会话 Cookie 种进学校 Profile 后默认保留，会话活着时再进免验证码。
    验证码默认不显示，登录时在设备本地 OCR；识别或提交失败后提供手动输入。 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EduCookieJar, EduHttp, EduKbFetch, EduPlugin } from '../../domain/edu/plugin'
import { captchaAnswer } from '../../domain/edu/captcha'
import { CAPTCHA_OCR_VIEWS, edu, eduCredentials, eduOcr, eduProfile, nativeEdu } from '../edu-browser'
import { setEduBrowserOpen } from '../edu-sync'
import { store } from '../store'
import { haptic } from '../widgets'
import { Field, Loader, Page, PrimaryButton, Switch, TextInput, TopBar } from '../ui'
import { PageBody } from '../course/shared'

type Phase = 'connect' | 'form' | 'submit' | 'fetch'

/** 自动登录最多换这么多张验证码：一次 begin 就是一次对教务系统的请求，次数要压住 */
const MAX_CAPTCHA_ROUNDS = 3

/** 网络/环境类错误给一句人话，其余原样 */
const netMsg = (e: unknown): string => {
  const m = e instanceof Error ? e.message : ''
  if (/resolve|timeout|timed out|Network|connect/i.test(m)) return '网络不通，请重试'
  return m || '登录失败，请重试'
}

export function EduLoginPage({ plugin, onBack, onDone }: {
  plugin: EduPlugin
  onBack: () => void
  /** 登录成功（或会话还有效）：带原生拉到的课表交给预览页；kb=null 时退回内置浏览器兜底 */
  onDone: (kb: EduKbFetch | null, url: string) => void
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
  /** 保存密码：开了就在登录成功后写入 Android Keystore；从本地密钥串回填时默认开着 */
  const [save, setSave] = useState(false)
  /** Android Keystore 回填的凭据：拿到就自动登录，不用再手填 */
  const [saved, setSaved] = useState<{ username: string; password: string } | null>(null)
  /** 默认完全隐藏验证码；自动识别多轮失败后才显示人工输入 */
  const [manual, setManual] = useState(false)

  const doneRef = useRef(false)
  /** 当前这张验证码原图：自动识别与换图重试都从它取 */
  const captchaRef = useRef<string | null>(null)
  /** 自动登录只跑一轮，轮内的验证码重试自己管 */
  const autoRanRef = useRef(false)
  /** onDone 每次渲染都是新闭包，钉进 ref：登录流程挂载一次，不能被 30s 的全局重渲染打断 */
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  const finish = useCallback((kb: EduKbFetch | null, url: string) => {
    doneRef.current = true
    onDoneRef.current(kb, url)
  }, [])

  const http: EduHttp = (req) => edu.http(req)

  /** 会话就绪后的收尾：原生拉一次课表 JSON，成了直接进预览；没拉到退回浏览器（已登录）。
      直连路径没有浏览器，先把「浏览器开着」的闸松开，后台同步不受影响 */
  const finishWithKb = useCallback(async (url: string) => {
    setPhase('fetch')
    setEduBrowserOpen(false)
    let kb: EduKbFetch | null = null
    try {
      kb = flow && flow.fetchTimetable ? await flow.fetchTimetable(http) : null
    } catch {
      kb = null
    }
    /* 教务认得的名字替换默认称呼；之后在「我的」头像页可改 */
    if (kb?.studentName) store.setPrefs({ name: kb.studentName })
    haptic('success')
    finish(kb, url)
  }, [flow, http, finish])

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
        captchaRef.current = null
        await seed(b.jars)
        await finishWithKb(b.url)
        return false
      }
      captchaRef.current = b.captcha
      setAuthcode('')
      setCaptcha(b.captcha)
      setPhase('form')
      return true
    } catch (e) {
      setFatal(netMsg(e))
      return false
    }
  }, [flow, profile, seed, finishWithKb])

  /** 提交一次登录；成功就收尾。失败带上「是不是验证码不对」，由调用方决定要不要换一张重试 */
  const attempt = useCallback(async (name: string, pass: string, code: string) => {
    if (!flow) return { ok: false, captcha: false, message: '登录还没准备好' }
    try {
      const out = await flow.login(http, { username: name, password: pass, captcha: code })
      if (out.kind === 'ok') {
        /* 保存密码只控制本地 Keystore 密文；关闭时不能继续用旧凭据自动更新。 */
        if (save) void eduCredentials.save(name, pass)
        else void eduCredentials.clear()
        await seed(out.jars)
        await finishWithKb(out.url)
        return { ok: true, captcha: false, message: '' }
      }
      return { ok: false, captcha: out.captcha === true, message: out.message }
    } catch (e) {
      return { ok: false, captcha: false, message: netMsg(e) }
    }
  }, [flow, http, save, seed, finishWithKb])

  /** 本地识别一张验证码：主视图读不出就换裁切视图，都在设备上跑、不联网。
      判不出合法算式给 null——上层换一张重试，而不是拿不准的答案去提交。 */
  const solveCaptcha = useCallback(async (image: string): Promise<string | null> => {
    for (let view = 0; view < CAPTCHA_OCR_VIEWS; view++) {
      const text = await eduOcr.recognize(image, view).then((r) => r.text, () => '')
      const answer = captchaAnswer(text)
      if (answer) return answer
    }
    return null
  }, [])


  /** 两种凭据来源共用同一套本地识别与最多三张图的重试流程。 */
  const autoLogin = useCallback(async (name: string, pass: string) => {
    let stale = false
    for (let round = 0; round < MAX_CAPTCHA_ROUNDS; round++) {
      if (doneRef.current) return
      stale = false
      const image = captchaRef.current
      let code = ''
      if (image) {
        setPhase('connect')
        code = (await solveCaptcha(image)) ?? ''
      }
      if (code || !image) {
        setPhase('submit')
        const r = await attempt(name, pass, code)
        if (r.ok || doneRef.current) return
        setError(r.message)
        stale = true
        if (!r.captcha) {
          /* 非验证码错误立即停手；下一次登录重新获取表单，验证码仍由本地识别。 */
          await begin(true)
          return
        }
      }
      if (round < MAX_CAPTCHA_ROUNDS - 1) {
        if (!await begin(true)) return
        stale = false
      }
    }
    if (stale && !await begin(true)) return
    if (!doneRef.current) {
      setManual(true)
      setError('验证码识别失败，请手动填写')
      setPhase('form')
    }
  }, [attempt, begin, solveCaptcha])
  const submit = useCallback(async () => {
    if (!flow || phase !== 'form') return
    const name = username.trim()
    if (!name || !password) return
    setError('')
    if (!manual) {
      setPhase('connect')
      void autoLogin(name, password)
      return
    }
    const code = captcha != null ? authcode.trim() : ''
    if (captcha != null && !code) return
    setPhase('submit')
    const r = await attempt(name, password, code)
    if (r.ok) return
    setError(r.message)
    await begin(true)

  }, [flow, phase, username, password, manual, captcha, authcode, autoLogin, attempt, begin])
  const refreshCaptcha = useCallback(async () => {
    if (capBusy || !flow) return
    setCapBusy(true)
    try {
      if (flow.refreshCaptcha) {
        const next = await flow.refreshCaptcha(http)
        captchaRef.current = next
        setCaptcha(next)
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
    /* Android Keystore 里的凭据：静默回填，接着自动登录 */
    void eduCredentials.load().then((c) => {
      if (!c || doneRef.current) return
      setUsername(c.username)
      setPassword(c.password)
      setSave(true)
      setSaved(c)
    })
    return () => {
      /* 登录中途退出：没种过 Cookie，Profile 不用清；成了会话已种进 Profile，交给浏览器接管 */
      if (!doneRef.current) setEduBrowserOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 凭据和表单都就绪（可能不用验证码）就自动试一轮 */
  useEffect(() => {
    if (!saved || autoRanRef.current || phase !== 'form') return
    autoRanRef.current = true
    void autoLogin(saved.username, saved.password)
  }, [saved, phase, autoLogin])

  const canSubmit = !!username.trim() && !!password && (captcha == null || !manual || !!authcode.trim())

  return (
    <Page>
      <PageBody className="flex min-h-0 flex-col !pb-[max(22px,env(safe-area-inset-bottom))]">
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
        ) : phase === 'connect' || phase === 'fetch' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24">
            <Loader size={20} />
            <div className="text-[12.5px] font-medium text-(--c-ink4)">{phase === 'fetch' ? '正在读取课表' : '正在连接统一身份认证'}</div>
          </div>
        ) : (
          <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            <div className="mt-5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
              <Field k="学号">
                <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              </Field>
              <Field k="密码">
                <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              {captcha != null && manual && (
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
              <div className="flex items-center px-4 py-3">
                <span className="min-w-0 flex-1 text-[12.5px] font-medium text-(--c-ink4)">保存密码</span>
                <Switch
                  on={save}
                  onChange={(v) => {
                    setSave(v)
                    if (!v) void eduCredentials.clear()
                  }}
                />
              </div>
            </div>
            {error && <div className="mt-2.5 px-1 text-[12.5px] font-medium text-(--c-danger)">{error}</div>}
            <div className="mt-auto pt-6">
              <PrimaryButton busy={phase === 'submit'} disabled={!canSubmit}>
                登录
              </PrimaryButton>
            </div>
          </form>
        )}
      </PageBody>

    </Page>
  )
}
