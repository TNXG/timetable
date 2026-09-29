import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import CloseLine from "~icons/mingcute/close-line";
import Delete2Line from "~icons/mingcute/delete-2-line";
import Download2Line from "~icons/mingcute/download-2-line";
import PicLine from "~icons/mingcute/pic-line";
import { camera } from "./camera";
import { loadPhotoSrc, photoSrc } from "./photo-src";
import { ActionSheet, FADE, useBackClose } from "./ui";
import { haptic, nativeToast } from "./widgets";

/** 待办照片：路径异步转成可显示的地址，文件不在时留占位 */
export function TaskPhotoImg({ path, className = "", alt = "", fit = "cover" }: { path: string; className?: string; alt?: string; fit?: "cover" | "contain" }) {
  const [loaded, setLoaded] = useState<{ path: string; src: string; failed: boolean } | null>(null);
  /* 即时地址在渲染期直接算；换图后失败标记跟着复位 */
  const src = loaded?.path === path ? loaded.src : photoSrc(path);
  const failed = loaded?.path === path ? loaded.failed : false;

  useEffect(() => {
    let alive = true;
    void loadPhotoSrc(path).then((s) => {
      if (!alive)
        return;
      setLoaded({ path, src: s || photoSrc(path), failed: !s });
    });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!src || failed) {
    return (
      <span className={`flex items-center justify-center bg-(--c-surface2) ${className}`}>
        <PicLine className="h-4.5 w-4.5" style={{ color: "var(--c-ink5)" }} />
      </span>
    );
  }
  return <img src={src} alt={alt} draggable={false} onError={() => setLoaded({ path, src, failed: true })} className={`${fit === "cover" ? "object-cover" : "object-contain"} ${className}`} />;
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 8;

/**
 * 全屏看图：黑底淡入，点一下或左上角关闭；长按弹出保存/删除。
 * 页面里 absolute 铺满，动作表就叠在它自己上面。
 */
export function PhotoViewer({ path, onClose, onDelete }: { path: string; onClose: () => void; onDelete?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [menu, setMenu] = useState(false);

  const close = () => {
    if (closingRef.current)
      return;
    closingRef.current = true;
    const el = rootRef.current;
    if (!el)
      return onClose();
    void animate(el, { opacity: 0 }, FADE).then(onClose);
  };
  useBackClose(() => (menu ? setMenu(false) : close()));

  useEffect(() => {
    const el = rootRef.current;
    if (!el)
      return;
    el.style.opacity = "0";
    void animate(el, { opacity: 1 }, FADE);
  }, []);

  /* 长按：按下计时，移动超过阈值或提前抬起就取消；短按关闭 */
  const pressRef = useRef<{ x: number; y: number; timer: number; fired: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (menu)
      return;
    const timer = window.setTimeout(() => {
      if (pressRef.current)
        pressRef.current.fired = true;
      haptic("medium");
      setMenu(true);
    }, LONG_PRESS_MS);
    pressRef.current = { x: e.clientX, y: e.clientY, timer, fired: false };
  };
  const cancel = () => {
    if (pressRef.current)
      window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p)
      return;
    if (Math.abs(e.clientX - p.x) > MOVE_TOLERANCE || Math.abs(e.clientY - p.y) > MOVE_TOLERANCE)
      cancel();
  };
  const onUp = () => {
    const p = pressRef.current;
    cancel();
    if (p && !p.fired)
      close();
  };

  const save = async () => {
    const ok = await camera.save(path);
    haptic(ok ? "success" : "error");
    nativeToast(ok ? "已保存到相册" : "保存失败");
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-80 bg-black select-none"
      style={{ WebkitTouchCallout: "none", opacity: 0 }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={cancel}
      >
        <TaskPhotoImg path={path} fit="contain" className="max-h-full max-w-full" />
      </div>
      <button
        onClick={close}
        className="absolute top-12 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 transition-transform duration-150 active:scale-[.92]"
      >
        <CloseLine width="15" height="15" style={{ color: "#fff" }} />
      </button>
      {menu && (
        <ActionSheet
          title="照片"
          groups={[
            [{ title: "保存到相册", icon: <Download2Line />, onClick: () => void save() }],
            onDelete ? [{ title: "删除这张", icon: <Delete2Line />, danger: true, onClick: () => { onDelete(); haptic("warning"); nativeToast("已删除"); close(); } }] : [],
          ]}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  );
}
