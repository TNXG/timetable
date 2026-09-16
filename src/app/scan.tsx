import { useEffect, useRef, useState } from 'react'
import { useIsPresent } from 'motion/react'
import { builtinRuleFor, resolveScan } from '../domain/importers/url'
import { camera } from './camera'
import { haptic, openAppSettings } from './widgets'
import { Page, SLIDE } from './ui'
import { CircleBtn, cameraLeave, layoutRect } from './todo'

/* ---------------- 扫码导入 ---------------- */

/**
 * 取景区复用相机页的原生预览层，识别到课表二维码（链接 / JSON / .ics）后
 * 先把预览定格收起，再把内容交给对应的内置规则进入导入预览。
 */
export function ScanPage({ onBack, onResult }: { onBack: () => void; onResult: (ruleId: string, text: string) => void }) {
  const [denied, setDenied] = useState<PermissionState | null>(null)
  const [granted, setGranted] = useState(false)
  const [torch, setTorch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [frozen, setFrozen] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const previewOn = useRef(false)
  const previewGen = useRef(0)
  const frozenLoaded = useRef<(() => void) | null>(null)
  const hintTimer = useRef(0)
  const present = useIsPresent()
  const live = granted && present

  useEffect(() => () => { mounted.current = false; window.clearTimeout(hintTimer.current) }, [])

  useEffect(() => {
    let alive = true
    void camera.request('camera').then((s) => {
      if (!alive) return
      if (s !== 'granted') setDenied(s === 'blocked' ? 'blocked' : 'denied')
      else setGranted(true)
    })
    return () => { alive = false }
  }, [])

  const startPreview = async () => {
    if (!frame.current) return
    const gen = ++previewGen.current
    await camera.start('back', layoutRect(frame.current), SLIDE.duration * 1000, true)
    if (gen !== previewGen.current || !previewOn.current) {
      await camera.stop()
      return
    }
    const el = camera.webPreview()
    if (el && video.current) {
      el.className = 'h-full w-full object-cover'
      video.current.replaceChildren(el)
      setFrozen(null)
    }
  }

  const leave = async () => {
    if (!previewOn.current) return
    previewOn.current = false
    previewGen.current++
    const f = await camera.freeze()
    if (f && mounted.current) {
      await new Promise<void>((ok) => {
        const t = window.setTimeout(ok, 400)
        frozenLoaded.current = () => { window.clearTimeout(t); ok() }
        setFrozen(f)
      })
    }
    await camera.stop()
  }

  useEffect(() => {
    if (!live) {
      if (previewOn.current) void leave()
      else void camera.stop()
      return
    }
    previewOn.current = true
    void startPreview().catch(() => { if (previewOn.current) setDenied('denied') })
    return () => { if (previewOn.current) void leave() }
  }, [live])

  useEffect(() => {
    cameraLeave.current = leave
    return () => { cameraLeave.current = null }
  }, [])

  const flash = (text: string) => {
    setHint(text)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => { if (mounted.current) setHint('') }, 2200)
  }

  const busyRef = useRef(false)
  useEffect(() => {
    if (!live) return
    return camera.onScan((text) => {
      if (busyRef.current || !previewOn.current) return
      busyRef.current = true
      setBusy(true)
      haptic('medium')
      void resolveScan(text)
        .then(async (r) => {
          if (!r) {
            flash('不是课表二维码')
            return
          }
          await leave()
          onResult(builtinRuleFor(r.kind), r.text)
        })
        .catch((e: unknown) => flash(e instanceof Error ? e.message : '读取失败'))
        .finally(() => {
          busyRef.current = false
          if (mounted.current) setBusy(false)
        })
    })
  }, [live])

  const go = (next: () => void) => {
    if (busy) return
    setBusy(true)
    void leave().then(() => { next(); if (mounted.current) setBusy(false) })
  }

  return (
    <Page className="bg-transparent">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-none items-center justify-between bg-black px-4 pt-12 pb-4">
          <CircleBtn onClick={() => go(onBack)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </CircleBtn>
          <div className="text-[15px] font-bold text-white">扫码导入</div>
          <CircleBtn onClick={() => { setTorch((v) => !v); void camera.torch(!torch) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={torch ? '#fff' : 'none'} stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </CircleBtn>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={frame} className="absolute inset-y-0 inset-x-2 touch-none rounded-[24px]">
            <div ref={video} className="absolute inset-0 overflow-hidden rounded-[24px] bg-black [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
            {frozen && (
              <img
                src={frozen}
                alt=""
                onLoad={() => { frozenLoaded.current?.(); frozenLoaded.current = null }}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-[24px] object-cover"
              />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[24px]" style={{ boxShadow: '0 0 0 200vmax #000' }} />
            <div className="pointer-events-none absolute inset-0 rounded-[24px]" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.25), transparent 30%, transparent 75%, rgba(0,0,0,.35))' }} />
            {['left-5 top-5 border-l-2 border-t-2 rounded-tl-[8px]', 'right-5 top-5 border-r-2 border-t-2 rounded-tr-[8px]', 'left-5 bottom-5 border-l-2 border-b-2 rounded-bl-[8px]', 'right-5 bottom-5 border-r-2 border-b-2 rounded-br-[8px]'].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-6 w-6 border-white/80 ${c}`} />
            ))}
            {denied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[24px] bg-black px-8 text-center">
                <div className="text-[15px] font-bold text-white">相机未开启</div>
                <div className="mt-2 text-[12.5px] font-medium text-white/60">在系统设置里允许相机，即可扫码导入</div>
                {denied === 'blocked' ? (
                  <button onClick={openAppSettings} className="mt-4 flex h-[34px] items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">去设置</button>
                ) : (
                  <button
                    onClick={() => void camera.request('camera').then((s) => { if (s === 'granted') { setDenied(null); setGranted(true) } })}
                    className="mt-4 flex h-[34px] items-center rounded-full bg-white px-4 text-[13px] font-bold text-black"
                  >
                    重试
                  </button>
                )}
              </div>
            )}
            {granted && !camera.canScan() && (
              <div className="absolute inset-x-0 bottom-8 text-center text-[12.5px] font-medium text-white/70">当前环境不支持识别二维码</div>
            )}
          </div>
        </div>

        <div className="flex flex-none flex-col items-center bg-black px-9 pt-6 pb-12">
          <div className="h-[20px] text-[13px] font-semibold text-white">{busy ? '读取中' : hint}</div>
          <div className="mt-1 text-[12.5px] font-medium text-white/55">对准课表二维码（链接、JSON 或 .ics）</div>
        </div>
      </div>
    </Page>
  )
}

type PermissionState = 'denied' | 'blocked'
