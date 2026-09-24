/** 头像 / 背景：自选照片先用直接路径再换成可显示的，没选则用内置图 */
import { useEffect, useState } from 'react'
import { loadPhotoSrc, photoSrc } from '../photo-src'

/* 头像 / 背景：自选照片先用直接路径再换成可显示的，没选则用内置图 */
export function usePhotoSrc(path: string, fallback: string): string {
  const [src, setSrc] = useState(() => (path ? photoSrc(path) : ''))
  useEffect(() => {
    if (!path) {
      setSrc('')
      return
    }
    let alive = true
    setSrc(photoSrc(path))
    void loadPhotoSrc(path).then((s) => alive && setSrc(s))
    return () => {
      alive = false
    }
  }, [path])
  return src || fallback
}
