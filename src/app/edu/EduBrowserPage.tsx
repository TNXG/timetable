/** 内置浏览器：直登成功后从这里进（已带学校会话），到课表页浮出导入胶囊。
    会话按学校独立，支持多 Profile 的 WebView 默认保留（免得反复验证码），老 WebView 离开时清掉；
    只在用户点「导入」后读取当前页面。 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useIsPresent, useMotionValue, useTransform } from 'motion/react'
import type { RuleOutput } from '../../domain/importer'
import type { EduPlugin } from '../../domain/edu/plugin'
import { detectSystem, hostOf, isTimetablePage } from '../../domain/edu/systems'
import type { PageCapture, ProbeResult } from '../../domain/edu/scripts'
import { parseZfKbList, termLabel, type ZfTerm } from '../../domain/edu/zhengfang'
import { issueUrl } from '../../domain/edu/release'
import { parseHtml } from '../../domain/importers/html'
import { edu, nativeEdu, profilesSupported, type EduNav } from '../edu-browser'
import { setEduBrowserOpen, type EduSyncSource } from '../edu-sync'
import { haptic, nativeToast } from '../widgets'
import { ActionSheet, FADE, Loader, Page, SLIDE, dockStyle } from '../ui'
import { appVersion, openExternal, shareDebug } from './share'
import { EduBrowserBar } from './EduBrowserBar'
import { EduTermSheet } from './EduTermSheet'
import type { EduFailInfo } from './EduFailPage'

/* ---------------- 内置浏览器 ---------------- */

/** 系统返回键：先让页面自己后退，退不了再离开 */
export const eduBack: { current: (() => Promise<void>) | null } = { current: null }

type Ready =
  | { kind: 'none' }
  | { kind: 'table' }
  | { kind: 'zf'; zf: NonNullable<ProbeResult['zf']>; count: number | null }

const HTML_CLASS = 'tt-edu'

export function EduBrowserPage({ plugin, startUrl, active, onBack, onImport, onFail, onOther }: {
  plugin: EduPlugin
  /** 直登成功后的落点：从它打开，且保住刚建立的会话 */
  startUrl?: string
  /** 预览页盖在上方时为 false：应用恢复不透明、触摸不再透给学校页面，会话保留以便退回 */
  active: boolean
  /** 其他导入方式：定格学校页面后交回调用方，换成导入方式列表 */
  onOther: () => void
  onBack: () => void
  /** src：自动更新时的抓取来源 */
  onImport: (out: RuleOutput, src: EduSyncSource) => void
  onFail: (info: EduFailInfo) => void
}) {
  const native = nativeEdu()
  const url = startUrl ?? plugin.url
  const [nav, setNav] = useState<EduNav>({ url, title: '', loading: native, progress: 0, canGoBack: false, painted: false })
  const [ready, setReady] = useState<Ready>({ kind: 'none' })
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  /** 离场时学校页面的定格图；'' 表示已离场但没拿到图 */
  const [shot, setShot] = useState<string | null>(null)
  const hole = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const left = useRef(false)
  const present = useIsPresent()

  const sys = detectSystem(nav.url, plugin.system)
  const onPage = !nav.loading && !nav.error && isTimetablePage(sys, nav.url, nav.title)
  const can = !nav.error && ready.kind !== 'none'
  const showPill = can || !!nav.error

  /*
   * 原生页面在推入动画期间就开始加载（此时应用仍不透明，看不到它）；
   * 动画结束后再把应用切透明，洞里的幕布等页面画出首帧才淡去。原生会话在页面卸载（退场动画结束）时才关：
   * 支持多 Profile 的 WebView 会话保留，下次进来不用重新登录；老 WebView 打开和关闭都清。
   */
  useEffect(() => {
    const off = edu.onNav(setNav)
    setEduBrowserOpen(true)
    /* startUrl = 直登刚建立的会话：老 WebView 没有独立 Profile，这一场也必须保住 */
    let alive = true
    let keep = false
    void profilesSupported().then((ok) => {
      if (!alive) return
      keep = ok
      void edu.open(url, ok || !!startUrl)
    })
    const t = window.setTimeout(() => {
      if (left.current) return
      document.documentElement.classList.add(HTML_CLASS)
      setOpened(true)
    }, SLIDE.duration * 1000 + 40)
    return () => {
      window.clearTimeout(t)
      alive = false
      off()
      document.documentElement.classList.remove(HTML_CLASS)
      setEduBrowserOpen(false)
      void edu.close(keep)
    }
  }, [url])

  /* 被上层直接出栈（导入完成回课表、深链接）：退场一开始就恢复不透明 */
  useEffect(() => {
    if (present || left.current) return
    left.current = true
    document.documentElement.classList.remove(HTML_CLASS)
  }, [present])

  /* 定格图上屏的同一帧恢复不透明，洞里由图接替真页面，随后的退场动画看不出接缝 */
  useLayoutEffect(() => {
    if (shot !== null) document.documentElement.classList.remove(HTML_CLASS)
  }, [shot])

  /* 透明洞与悬浮胶囊的矩形交给原生：洞里触摸给学校页面，胶囊留给自己；抽屉打开、预览页盖住、离场中整页不透传 */
  const departed = shot !== null
  useEffect(() => {
    const h = hole.current
    const p = pill.current
    if (!h) return
    const send = () => {
      const a = h.getBoundingClientRect()
      const b = p?.getBoundingClientRect()
      void edu.frame({
        top: a.top,
        bottom: Math.max(0, window.innerHeight - a.bottom),
        keep: b ? [{ x: b.left, y: b.top, w: b.width, h: b.height }] : [],
        interactive: opened && !sheet && !menu && active && !departed,
      })
    }
    send()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(send)
    ro.observe(h)
    if (p) ro.observe(p)
    return () => ro.disconnect()
  }, [opened, sheet, menu, showPill, active, departed])

  /* 还没到课表页时不摆胶囊，首次加载完成后用一条 toast 提示去向 */
  const hinted = useRef(false)
  useEffect(() => {
    if (hinted.current || !opened || nav.loading || nav.error || onPage) return
    hinted.current = true
    nativeToast('登录后打开课表页')
  }, [opened, nav.loading, nav.error, onPage])

  /* 到了课表页：探测页面结构；正方再按当前学期取一次课程数给胶囊 */
  const probed = useRef('')
  useEffect(() => {
    if (!onPage) {
      probed.current = ''
      setReady({ kind: 'none' })
      return
    }
    if (probed.current === nav.url) return
    probed.current = nav.url
    let alive = true
    void (async () => {
      try {
        const p = await edu.probe()
        if (!alive) return
        if (p.zf && sys === 'zhengfang_new') {
          setReady({ kind: 'zf', zf: p.zf, count: null })
          const list = await edu.zfFetch(p.zf.sel.xnm, p.zf.sel.xqm)
          if (alive) setReady({ kind: 'zf', zf: p.zf, count: parseZfKbList(list).courses.length })
        } else {
          setReady(p.table ? { kind: 'table' } : { kind: 'none' })
        }
      } catch {
        if (alive) setReady({ kind: 'none' })
      }
    })()
    return () => {
      alive = false
    }
  }, [onPage, nav.url, sys])

  /* 离场：先把学校页面定格贴进洞里，再交给调用方出栈；图解码好了才上屏，避免露一帧底色 */
  const leave = useCallback(async () => {
    if (left.current) return
    left.current = true
    let src = opened ? await edu.snapshot() : null
    if (src) {
      try {
        const img = new Image()
        img.src = src
        await img.decode()
      } catch {
        src = null
      }
    }
    setShot(src ?? '')
  }, [opened])
  const goBack = useCallback(async () => {
    await leave()
    onBack()
  }, [leave, onBack])

  useEffect(() => {
    eduBack.current = async () => {
      const { went } = await edu.back()
      if (!went) await goBack()
    }
    return () => {
      eduBack.current = null
    }
  }, [goBack])

  const fail = async () => {
    const [text, capture, probe] = await Promise.all([
      edu.pageText().catch(() => ''),
      edu.capture().catch(() => null),
      edu.probe().catch(() => null),
    ])
    await leave()
    onFail({ url: nav.url, system: sys, text, capture, probe })
  }

  /* 预览页自带底色盖在上方，学校页面继续留在下面：预览页退回时从它上面滑开 */
  const finish = async (out: RuleOutput, term?: ZfTerm) => {
    if (out.courses.length === 0) return fail()
    haptic('success')
    setSheet(false)
    onImport(out, { school: plugin, pageUrl: nav.url, term })
  }

  const importGeneric = async () => {
    setBusy(true)
    try {
      const html = await edu.pageHtml()
      await finish(parseHtml(html, { mode: 'grid' }))
    } catch {
      await fail()
    } finally {
      setBusy(false)
    }
  }

  const importZf = async (t: ZfTerm) => {
    setBusy(true)
    try {
      const list = await edu.zfFetch(t.xnm, t.xqm)
      await finish({ ...parseZfKbList(list), semester: { name: termLabel(t) } }, t)
    } catch {
      await fail()
    } finally {
      setBusy(false)
    }
  }

  const exportDebug = async () => {
    try {
      const [capture, probe] = await Promise.all([edu.capture(), edu.probe().catch(() => null)])
      await shareDebug(capture, sys, probe)
    } catch (e) {
      nativeToast(e instanceof Error && e.message ? e.message : '页面读不到')
    }
  }

  const onImportTap = () => {
    if (busy || ready.kind === 'none') return
    if (ready.kind === 'zf') setSheet(true)
    else void importGeneric()
  }

  const label = nav.error === 'ssl'
    ? '证书错误，无法打开'
    : nav.error
      ? '页面打不开'
      : ready.kind === 'zf' && ready.count !== null
        ? `导入 ${ready.count} 门课`
        : '导入课表'
  /* 洞上的幕布：应用底色，等学校页面画出首帧才淡去，不露白块 */
  const veil = native && !(opened && (nav.painted || !!nav.error))

  return (
    <Page keep>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <EduBrowserBar nav={nav} onBack={() => void goBack()} onMenu={() => setMenu(true)} />

        {/* 透明洞：原生 WebView 在下面显示学校页面；离场时换成它的定格图 */}
        <div ref={hole} className="relative flex flex-1 items-center justify-center">
          {!native && (
            <div className="rounded-[14px] bg-(--c-surface) px-4 py-2.5 text-[12.5px] font-medium text-(--c-ink4)">内置浏览器仅在应用内可用</div>
          )}
          <motion.div aria-hidden initial={false} animate={{ opacity: veil ? 1 : 0 }} transition={FADE} className="pointer-events-none absolute inset-0 bg-(--c-bg)" />
          {shot && <img src={shot} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />}
        </div>

        {showPill && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(36px,calc(env(safe-area-inset-bottom)+20px))] z-[9] flex justify-center">
          <button
            ref={pill}
            onClick={onImportTap}
            disabled={!can || busy}
            className={`pointer-events-auto flex h-[36px] items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-transform duration-150 active:scale-[.97] ${can ? 'text-(--c-accent)' : 'text-(--c-ink3)'}`}
            style={dockStyle}
          >
            {busy && <Loader size={13} />}
            {label}
          </button>
        </div>
        )}

        {sheet && ready.kind === 'zf' && (
          <EduTermSheet zf={ready.zf} onClose={() => setSheet(false)} onPick={(t) => void importZf(t)} />
        )}
        {menu && (
          <ActionSheet
            title={hostOf(nav.url)}
            onClose={() => setMenu(false)}
            groups={[[
              {
                title: '其他导入方式',
                icon: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
                onClick: () => { void leave().then(onOther) },
              },
              {
                title: '导出页面调试包',
                value: '.html',
                icon: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
                onClick: () => void exportDebug(),
              },
              {
                title: '反馈这个页面',
                icon: <><path d="M4 21V5a2 2 0 0 1 2-2h13l-3 4 3 4H6" /></>,
                onClick: () => void appVersion().then((version) => openExternal(issueUrl({ url: nav.url, system: sys, version }))),
              },
            ]]}
          />
        )}
      </div>
    </Page>
  )
}
