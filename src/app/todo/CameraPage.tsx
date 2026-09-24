import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsPresent } from 'motion/react'
import type { Snapshot } from '../../domain/engine'
import { captureContext } from '../../domain/next-class'
import { nowMinutes, todayStr } from '../semester'
import { useStore } from '../store'
import { camera, type CapturedPhoto, type GalleryItem } from '../camera'
import { haptic } from '../widgets'
import { Page, SLIDE, clipText } from '../ui'
import { CircleBtn, CourseSheet, cameraLeave, layoutRect } from './shared'

export function CameraPage({
  snap, courseId, active = true, onBack, onPicker, onShot,
}: {
  snap: Snapshot | null
  courseId?: string
  /** 上面压了别的页（如相册）时为 false：收起原生预览，回来再开 */
  active?: boolean
  onBack: () => void
  onPicker: () => void
  onShot: (photos: CapturedPhoto[], cid?: string) => void
}) {
  const state = useStore()
  const today = todayStr()
  const now = nowMinutes()
  const ctx = useMemo(() => (snap ? captureContext(snap, today, now) : null), [snap, today, now])
  const [cid, setCid] = useState(courseId ?? ctx?.courseId ?? '')
  const [denied, setDenied] = useState(false)
  const [granted, setGranted] = useState(false)
  const [torch, setTorch] = useState(false)
  const [thumb, setThumb] = useState<GalleryItem | null>(null)
  const [busy, setBusy] = useState(false)
  /** 原生预览收起时的定格帧：填在取景框里，切页动画期间画面不断 */
  const [frozen, setFrozen] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLDivElement>(null)
  const course = state.courses.find((c) => c.id === cid)

  /** 每次开预览递增；start 返回时若已被 leave 抢先，立刻撤掉这次开出来的原生层 */
  const previewGen = useRef(0)
  const startPreview = async () => {
    if (!frame.current) return
    zoom.current = 1
    const gen = ++previewGen.current
    await camera.start('back', layoutRect(frame.current), SLIDE.duration * 1000)
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

  useEffect(() => {
    let alive = true
    void (async () => {
      const status = await camera.request('camera')
      if (!alive) return
      if (status !== 'granted') {
        setDenied(true)
        return
      }
      setGranted(true)
      const items = await camera.listRecent(0, 1)
      if (alive) setThumb(items[0] ?? null)
    })()
    return () => {
      alive = false
    }
  }, [])

  /*
   * 原生预览层叠在 WebView 上方，不跟页面一起动：任何切页之前都要先把它换成页面内的定格图。
   * leave(): 原生定格 → 拿到最后一帧 → <img> 解码完成 → 撤掉原生层，然后才开始推/退页。
   */
  /* 选课程的抽屉在 WebView 里，而原生预览叠在 WebView 上：开卡期间同样换成定格帧 */
  const [pickingCourse, setPickingCourse] = useState(false)
  const present = useIsPresent()
  const live = granted && active && present && !pickingCourse
  const mounted = useRef(true)
  const previewOn = useRef(false)
  const frozenLoaded = useRef<(() => void) | null>(null)
  useEffect(() => () => { mounted.current = false }, [])

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
    let alive = true
    previewOn.current = true
    setBusy(false)
    void startPreview().catch(() => { if (alive && previewOn.current) setDenied(true) })
    return () => {
      alive = false
      if (previewOn.current) void leave()
    }
  }, [live])

  useEffect(() => {
    cameraLeave.current = leave
    return () => { cameraLeave.current = null }
  }, [])

  const go = (next: () => void) => {
    if (busy) return
    setBusy(true)
    void leave().then(() => { next(); if (mounted.current) setBusy(false) })
  }

  const shoot = async () => {
    if (busy) return
    setBusy(true)
    haptic('medium')
    try {
      const photo = await camera.capture()
      await leave()
      onShot([photo], cid || undefined)
    } catch {
      if (mounted.current) setBusy(false)
    }
  }

  /* 双指缩放：以抓住时的倍率为基准，按两指距离变化成比例调整 */
  const zoom = useRef(1)
  const pinch = useRef<{ base: number; dist: number; pending: boolean } | null>(null)
  const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    pinch.current = { base: zoom.current, dist: touchDist(e.touches), pending: false }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pinch.current
    if (!p || e.touches.length !== 2) return
    const want = p.base * (touchDist(e.touches) / p.dist)
    if (p.pending || Math.abs(want - zoom.current) < 0.01) return
    p.pending = true
    void camera.zoom(want).then((r) => {
      zoom.current = r
      if (pinch.current) pinch.current.pending = false
    })
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null
  }

  return (
    <Page className="bg-transparent">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-none items-center justify-between bg-black px-4 pt-12 pb-4">
          <CircleBtn onClick={() => go(onBack)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </CircleBtn>
          <button
            onClick={() => go(() => setPickingCourse(true))}
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-bold text-white transition-transform duration-150 active:scale-[.96]"
          >
            {course && <span className="h-[7px] w-[7px] rounded-full" style={{ background: course.color }} />}
            {course ? clipText(course.name) : '课程'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <CircleBtn onClick={() => { setTorch((v) => !v); void camera.torch(!torch) }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={torch ? '#fff' : 'none'} stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </CircleBtn>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={frame}
            className="absolute inset-y-0 inset-x-2 touch-none rounded-[24px]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
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
                <div className="mt-2 text-[12.5px] font-medium text-white/60">在系统设置里允许相机，即可拍下板书</div>
                <button
                  onClick={() => void camera.request('camera').then((s) => { if (s === 'granted') { setDenied(false); setGranted(true) } })}
                  className="mt-4 flex h-[34px] items-center rounded-full bg-white px-4 text-[13px] font-bold text-black"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center justify-between bg-black px-9 pt-6 pb-10">
          <button onClick={() => go(onPicker)} className="h-[46px] w-[46px] overflow-hidden rounded-[12px] ring-2 ring-white/25 transition-transform duration-150 active:scale-[.94]">
            {thumb ? (
              <img src={thumb.thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-white/12">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 16 5-4 4 3 3-2 6 4" /></svg>
              </span>
            )}
          </button>
          <button
            onClick={() => void shoot()}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3.5px] border-white transition-transform duration-150 active:scale-[.94]"
          >
            <span className="h-[62px] w-[62px] rounded-full bg-white" />
          </button>
          <CircleBtn size={46} onClick={() => void camera.switchCamera()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" /><path d="M4 20v-5h5M20 4v5h-5" /></svg>
          </CircleBtn>
        </div>
      </div>
      {pickingCourse && (
        <CourseSheet courses={state.courses.filter((c) => !c.removedByImport)} cid={cid} onPick={setCid} onClose={() => setPickingCourse(false)} />
      )}
    </Page>
  )
}
