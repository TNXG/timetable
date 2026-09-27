import CloseLine from "~icons/mingcute/close-line";
import DownLine from "~icons/mingcute/down-line";
import FlashLine from "~icons/mingcute/flash-line";
import FlashFill from "~icons/mingcute/flash-fill";
import PicLine from "~icons/mingcute/pic-line";
import CameraRotateLine from "~icons/mingcute/camera-rotate-line";
import type { Snapshot } from "../../domain/engine";
import type { CapturedPhoto, GalleryItem } from "../camera";
import { useIsPresent } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { captureContext } from "../../domain/next-class";
import { camera } from "../camera";
import { nowMinutes, todayStr } from "../semester";
import { useStore } from "../store";
import { clipText, Page, SLIDE } from "../ui";
import { haptic } from "../widgets";
import { cameraLeave, CircleBtn, CourseSheet, layoutRect } from "./shared";

export function CameraPage({
  snap,
  courseId,
  active = true,
  onBack,
  onPicker,
  onShot,
}: {
  snap: Snapshot | null;
  courseId?: string;
  /** 上面压了别的页（如相册）时为 false：收起原生预览，回来再开 */
  active?: boolean;
  onBack: () => void;
  onPicker: () => void;
  onShot: (photos: CapturedPhoto[], cid?: string) => void;
}) {
  const state = useStore();
  const today = todayStr();
  const now = nowMinutes();
  const ctx = useMemo(() => (snap ? captureContext(snap, today, now) : null), [snap, today, now]);
  const [cid, setCid] = useState(courseId ?? ctx?.courseId ?? "");
  const [denied, setDenied] = useState(false);
  const [granted, setGranted] = useState(false);
  const [torch, setTorch] = useState(false);
  const [thumb, setThumb] = useState<GalleryItem | null>(null);
  /* 只做重入保护、不参与渲染：用 ref，省掉无谓的重渲染 */
  const busyRef = useRef(false);
  /** 原生预览收起时的定格帧：填在取景框里，切页动画期间画面不断 */
  const [frozen, setFrozen] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const course = state.courses.find(c => c.id === cid);

  /** 每次开预览递增；start 返回时若已被 leave 抢先，立刻撤掉这次开出来的原生层 */
  const previewGenRef = useRef(0);
  const zoomRef = useRef(1);
  const previewOnRef = useRef(false);
  const startPreview = async () => {
    if (!frameRef.current)
      return;
    zoomRef.current = 1;
    const gen = ++previewGenRef.current;
    await camera.start("back", layoutRect(frameRef.current), SLIDE.duration * 1000);
    if (gen !== previewGenRef.current || !previewOnRef.current) {
      await camera.stop();
      return;
    }
    const el = camera.webPreview();
    if (el && videoRef.current) {
      el.className = "h-full w-full object-cover";
      videoRef.current.replaceChildren(el);
      setFrozen(null);
    }
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      const status = await camera.request("camera");
      if (!alive)
        return;
      if (status !== "granted") {
        setDenied(true);
        return;
      }
      setGranted(true);
      const items = await camera.listRecent(0, 1);
      if (alive)
        setThumb(items[0] ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /*
   * 原生预览层叠在 WebView 上方，不跟页面一起动：任何切页之前都要先把它换成页面内的定格图。
   * leave(): 原生定格 → 拿到最后一帧 → <img> 解码完成 → 撤掉原生层，然后才开始推/退页。
   */
  /* 选课程的抽屉在 WebView 里，而原生预览叠在 WebView 上：开卡期间同样换成定格帧 */
  const [pickingCourse, setPickingCourse] = useState(false);
  const present = useIsPresent();
  const live = granted && active && present && !pickingCourse;
  const mountedRef = useRef(true);
  const frozenLoadedRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const leave = async () => {
    if (!previewOnRef.current)
      return;
    previewOnRef.current = false;
    previewGenRef.current++;
    const f = await camera.freeze();
    if (f && mountedRef.current) {
      await new Promise<void>((ok) => {
        const t = window.setTimeout(ok, 400);
        frozenLoadedRef.current = () => { window.clearTimeout(t); ok(); };
        setFrozen(f);
      });
    }
    await camera.stop();
  };

  useEffect(() => {
    if (!live) {
      if (previewOnRef.current)
        void leave();
      else void camera.stop();
      return;
    }
    let alive = true;
    previewOnRef.current = true;
    busyRef.current = false;
    void startPreview().catch(() => {
      if (alive && previewOnRef.current)
        setDenied(true);
    });
    return () => {
      alive = false;
      if (previewOnRef.current)
        void leave();
    };
  }, [live]);

  useEffect(() => {
    cameraLeave.current = leave;
    return () => { cameraLeave.current = null; };
  }, []);

  const go = (next: () => void) => {
    if (busyRef.current)
      return;
    busyRef.current = true;
    void leave().then(() => {
      next(); if (mountedRef.current)
        busyRef.current = false;
    });
  };

  const shoot = async () => {
    if (busyRef.current)
      return;
    busyRef.current = true;
    haptic("medium");
    try {
      const photo = await camera.capture();
      await leave();
      onShot([photo], cid || undefined);
    } catch {
      if (mountedRef.current)
        busyRef.current = false;
    }
  };

  /* 双指缩放：以抓住时的倍率为基准，按两指距离变化成比例调整 */
  const pinchRef = useRef<{ base: number; dist: number; pending: boolean } | null>(null);
  const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2)
      return;
    pinchRef.current = { base: zoomRef.current, dist: touchDist(e.touches), pending: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pinchRef.current;
    if (!p || e.touches.length !== 2)
      return;
    const want = p.base * (touchDist(e.touches) / p.dist);
    if (p.pending || Math.abs(want - zoomRef.current) < 0.01)
      return;
    p.pending = true;
    void camera.zoom(want).then((r) => {
      zoomRef.current = r;
      if (pinchRef.current)
        pinchRef.current.pending = false;
    });
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2)
      pinchRef.current = null;
  };

  return (
    <Page className="bg-transparent">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-none items-center justify-between bg-black px-4 pt-12 pb-4">
          <CircleBtn onClick={() => go(onBack)}>
            <CloseLine width="14" height="14" style={{ color: "#fff" }} />
          </CircleBtn>
          <button
            onClick={() => go(() => setPickingCourse(true))}
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-bold text-white transition-transform duration-150 active:scale-[.96]"
          >
            {course && <span className="h-1.75 w-1.75 rounded-full" style={{ background: course.color }} />}
            {course ? clipText(course.name) : "课程"}
            <DownLine width="10" height="10" style={{ color: "rgba(255,255,255,.6)" }} />
          </button>
          <CircleBtn onClick={() => { setTorch(v => !v); void camera.torch(!torch); }}>
            {torch ? <FlashFill width="15" height="15" style={{ color: "#fff" }} /> : <FlashLine width="15" height="15" style={{ color: "#fff" }} />}
          </CircleBtn>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={frameRef}
            className="absolute inset-y-0 inset-x-2 touch-none rounded-3xl"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            <div ref={videoRef} className="absolute inset-0 overflow-hidden rounded-3xl bg-black [&>video]:h-full [&>video]:w-full [&>video]:object-cover" />
            {frozen && (
              <img
                src={frozen}
                alt=""
                onLoad={() => { frozenLoadedRef.current?.(); frozenLoadedRef.current = null; }}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-3xl object-cover"
              />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl" style={{ boxShadow: "0 0 0 200vmax #000" }} />
            <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.25), transparent 30%, transparent 75%, rgba(0,0,0,.35))" }} />
            {["left-5 top-5 border-l-2 border-t-2 rounded-tl-lg", "right-5 top-5 border-r-2 border-t-2 rounded-tr-lg", "left-5 bottom-5 border-l-2 border-b-2 rounded-bl-lg", "right-5 bottom-5 border-r-2 border-b-2 rounded-br-lg"].map(c => (
              <span key={c} className={`pointer-events-none absolute h-6 w-6 border-white/80 ${c}`} />
            ))}
            {denied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-black px-8 text-center">
                <div className="text-[15px] font-bold text-white">相机未开启</div>
                <div className="mt-2 text-[12.5px] font-medium text-white/60">在系统设置里允许相机，即可拍下板书</div>
                <button
                  onClick={() => void camera.request("camera").then((s) => { if (s === "granted") { setDenied(false); setGranted(true); } })}
                  className="mt-4 flex h-8.5 items-center rounded-full bg-white px-4 text-[13px] font-bold text-black"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center justify-between bg-black px-9 pt-6 pb-10">
          <button onClick={() => go(onPicker)} className="h-11.5 w-11.5 overflow-hidden rounded-xl ring-2 ring-white/25 transition-transform duration-150 active:scale-[.94]">
            {thumb
              ? (
                  <img src={thumb.thumb} alt="" className="h-full w-full object-cover" />
                )
              : (
                  <span className="flex h-full w-full items-center justify-center bg-white/12">
                    <PicLine width="18" height="18" style={{ color: "#fff" }} />
                  </span>
                )}
          </button>
          <button
            onClick={() => void shoot()}
            className="flex h-19 w-19 items-center justify-center rounded-full border-[3.5px] border-white transition-transform duration-150 active:scale-[.94]"
          >
            <span className="h-15.5 w-15.5 rounded-full bg-white" />
          </button>
          <CircleBtn size={46} onClick={() => void camera.switchCamera()}>
            <CameraRotateLine width="20" height="20" style={{ color: "#fff" }} />
          </CircleBtn>
        </div>
      </div>
      {pickingCourse && (
        <CourseSheet courses={state.courses.filter(c => !c.removedByImport)} cid={cid} onPick={setCid} onClose={() => setPickingCourse(false)} />
      )}
    </Page>
  );
}
