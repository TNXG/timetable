import { useIsPresent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import CloseLine from "~icons/mingcute/close-line";
import FlashFill from "~icons/mingcute/flash-fill";
import FlashLine from "~icons/mingcute/flash-line";
import { builtinRuleFor, resolveScan } from "../domain/importers/url";
import { camera } from "./camera";
import { cameraLeave, CircleBtn, layoutRect } from "./todo";
import { Page, SLIDE } from "./ui";
import { haptic, openAppSettings } from "./widgets";

/* ---------------- 扫码导入 ---------------- */

/**
 * 取景区复用相机页的原生预览层，识别到课表二维码（链接 / JSON / .ics）后
 * 先把预览定格收起，再把内容交给对应的内置规则进入导入预览。
 */
export function ScanPage({ onBack, onResult }: { onBack: () => void; onResult: (ruleId: string, text: string) => void }) {
  const [denied, setDenied] = useState<PermissionState | null>(null);
  const [granted, setGranted] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [frozen, setFrozen] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const previewOnRef = useRef(false);
  const previewGenRef = useRef(0);
  const frozenLoadedRef = useRef<(() => void) | null>(null);
  const hintTimerRef = useRef(0);
  const present = useIsPresent();
  const live = granted && present;

  useEffect(() => () => { mountedRef.current = false; window.clearTimeout(hintTimerRef.current); }, []);

  useEffect(() => {
    let alive = true;
    void camera.request("camera").then((s) => {
      if (!alive)
        return;
      if (s !== "granted")
        setDenied(s === "blocked" ? "blocked" : "denied");
      else setGranted(true);
    });
    return () => { alive = false; };
  }, []);

  const startPreview = async () => {
    if (!frameRef.current)
      return;
    const gen = ++previewGenRef.current;
    await camera.start("back", layoutRect(frameRef.current), SLIDE.duration * 1000, true);
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
    previewOnRef.current = true;
    void startPreview().catch(() => {
      if (previewOnRef.current)
        setDenied("denied");
    });
    return () => {
      if (previewOnRef.current)
        void leave();
    };
  }, [live]);

  useEffect(() => {
    cameraLeave.current = leave;
    return () => { cameraLeave.current = null; };
  }, []);

  const flash = (text: string) => {
    setHint(text);
    window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current)
        setHint("");
    }, 2200);
  };

  const busyRef = useRef(false);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  useEffect(() => {
    if (!live)
      return;
    return camera.onScan((text) => {
      if (busyRef.current || !previewOnRef.current)
        return;
      busyRef.current = true;
      setBusy(true);
      haptic("medium");
      void resolveScan(text)
        .then(async (r) => {
          if (!r) {
            flash("不是课表二维码");
            return;
          }
          await leave();
          onResultRef.current(builtinRuleFor(r.kind), r.text);
        })
        .catch((e: unknown) => flash(e instanceof Error ? e.message : "读取失败"))
        .finally(() => {
          busyRef.current = false;
          if (mountedRef.current)
            setBusy(false);
        });
    });
  }, [live]);

  const go = (next: () => void) => {
    if (busy)
      return;
    setBusy(true);
    void leave().then(() => {
      next(); if (mountedRef.current)
        setBusy(false);
    });
  };

  return (
    <Page className="bg-transparent">
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-none items-center justify-between bg-black px-4 pt-12 pb-4">
          <CircleBtn onClick={() => go(onBack)}>
            <CloseLine width="14" height="14" style={{ color: "#fff" }} />
          </CircleBtn>
          <div className="text-[15px] font-bold text-white">扫码导入</div>
          <CircleBtn onClick={() => { setTorch(v => !v); void camera.torch(!torch); }}>
            {torch ? <FlashFill width="15" height="15" style={{ color: "#fff" }} /> : <FlashLine width="15" height="15" style={{ color: "#fff" }} />}
          </CircleBtn>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={frameRef} className="absolute inset-y-0 inset-x-2 touch-none rounded-3xl">
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
                <div className="mt-2 text-[12.5px] font-medium text-white/60">在系统设置里允许相机，即可扫码导入</div>
                {denied === "blocked"
                  ? (
                      <button onClick={openAppSettings} className="mt-4 flex h-8.5 items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">去设置</button>
                    )
                  : (
                      <button
                        onClick={() => void camera.request("camera").then((s) => { if (s === "granted") { setDenied(null); setGranted(true); } })}
                        className="mt-4 flex h-8.5 items-center rounded-full bg-white px-4 text-[13px] font-bold text-black"
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
          <div className="h-5 text-[13px] font-semibold text-white">{busy ? "读取中" : hint}</div>
          <div className="mt-1 text-[12.5px] font-medium text-white/55">对准课表二维码（链接、JSON 或 .ics）</div>
        </div>
      </div>
    </Page>
  );
}

type PermissionState = "denied" | "blocked";
