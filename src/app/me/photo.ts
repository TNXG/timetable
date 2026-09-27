/** 头像 / 背景：自选照片先用直接路径再换成可显示的，没选则用内置图 */
import { useEffect, useState } from "react";
import { loadPhotoSrc, photoSrc } from "../photo-src";

/* 头像 / 背景：自选照片先用直接路径再换成可显示的，没选则用内置图 */
export function usePhotoSrc(path: string, fallback: string): string {
  const [loaded, setLoaded] = useState<{ path: string; src: string } | null>(null);
  /* 即时地址在渲染期直接算，不进 effect：省掉挂载/换图后的同步重渲染 */
  const src = loaded?.path === path ? loaded.src : path ? photoSrc(path) : "";
  useEffect(() => {
    if (!path)
      return;
    let alive = true;
    void loadPhotoSrc(path).then(s => alive && setLoaded({ path, src: s }));
    return () => {
      alive = false;
    };
  }, [path]);
  return src || fallback;
}
