import { useCallback, useEffect, useState } from 'react'
import { camera, type CapturedPhoto, type GalleryItem, type PermissionStatus } from '../camera'
import { openAppSettings } from '../widgets'
import { Page, PrimaryButton } from '../ui'
import { CircleBtn } from './shared'

/* ---------------- 相册 ---------------- */

export function PickerPage({ onBack, onDone, single }: { onBack: () => void; onDone: (photos: CapturedPhoto[]) => void; single?: boolean }) {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [page, setPage] = useState(0)
  const [more, setMore] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState<PermissionStatus>('prompt')

  const load = useCallback(async () => {
    const status = await camera.request('photos')
    setPerm(status)
    if (status !== 'granted') return
    const list = await camera.listRecent(0)
    setItems(list)
    setPage(0)
    setMore(list.length > 0)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /* 去系统设置放开权限后回来，直接重新拉列表 */
  useEffect(() => {
    if (perm === 'granted') return
    const onShow = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [perm, load])

  const loadMore = async () => {
    if (!more) return
    const next = page + 1
    const list = await camera.listRecent(next)
    setPage(next)
    setItems((cur) => [...cur, ...list])
    if (list.length === 0) setMore(false)
  }

  const add = async () => {
    if (busy) return
    setBusy(true)
    try {
      onDone(await camera.importPicked(picked))
    } catch {
      setBusy(false)
    }
  }

  return (
    <Page className="bg-black">
      <div className="flex flex-none items-center justify-between px-4 pt-12">
        <CircleBtn onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </CircleBtn>
        <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-bold text-white">最近项目</span>
        <span className="w-9" />
      </div>

      <div
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollTop + el.clientHeight > el.scrollHeight - 400) void loadMore()
        }}
        className="mt-4 min-h-0 flex-1 overflow-y-auto px-[3px] [scrollbar-width:none]"
      >
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="text-[15px] font-bold text-white">{perm === 'granted' ? '没有照片' : '未允许访问照片'}</div>
            <div className="mt-2 text-[12.5px] font-medium text-white/60">
              {perm === 'granted' ? '相册里还没有图片' : perm === 'blocked' ? '在系统设置里允许读取照片' : '允许后才能在这里挑选'}
            </div>
            <div className="mt-4 flex gap-2.5">
              {perm === 'blocked' ? (
                <button onClick={openAppSettings} className="flex h-[34px] items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">去设置</button>
              ) : perm !== 'granted' ? (
                <button onClick={() => void load()} className="flex h-[34px] items-center rounded-full bg-white px-4 text-[13px] font-bold text-black">允许访问</button>
              ) : null}
              <button
                onClick={() => void camera.pick().then((ps) => ps.length > 0 && onDone(ps))}
                className={`flex h-[34px] items-center rounded-full px-4 text-[13px] font-bold ${perm === 'granted' ? 'bg-white text-black' : 'bg-white/12 text-white'}`}
              >
                从文件选择
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 content-start gap-[3px]">
            {items.map((it) => {
              const n = picked.indexOf(it.id)
              return (
                <button
                  key={it.id}
                  onClick={() => setPicked((cur) => (n >= 0 ? cur.filter((x) => x !== it.id) : single ? [it.id] : [...cur, it.id]))}
                  className="relative aspect-square overflow-hidden rounded-[6px]"
                >
                  <img src={it.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {n >= 0 ? (
                    <>
                      <span className="absolute inset-0 rounded-[6px] ring-[2.5px] ring-inset ring-(--c-accent)" style={{ background: 'color-mix(in srgb, var(--c-accent) 18%, transparent)' }} />
                      <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--c-accent) text-[11px] font-extrabold text-white">
                        {single ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg> : n + 1}
                      </span>
                    </>
                  ) : (
                    <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full border-[1.5px] border-white/80" style={{ background: 'rgba(0,0,0,.25)' }} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-none px-5 pt-3 pb-8">
        <PrimaryButton onDark disabled={picked.length === 0} busy={busy} onClick={() => void add()}>{single ? '使用这张' : `添加 ${picked.length} 张`}</PrimaryButton>
      </div>
    </Page>
  )
}
