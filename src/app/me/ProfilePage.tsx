/** 个人资料：顶部是「我」页头图的缩影，点背景换背景、点头像换头像 */
import { useState } from 'react'
import { store, useStore } from '../store'
import { camera } from '../camera'
import { haptic } from '../widgets'
import { ActionSheet, Field, ICON, SubPage, TextInput } from '../ui'
import { usePhotoSrc } from './photo'

export type PhotoTarget = 'avatar' | 'wall'

function CameraBadge({ className }: { className: string }) {
  return (
    <span className={`grid place-items-center rounded-full ${className}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{ICON.camera}</svg>
    </span>
  )
}

/* 个人资料：顶部就是「我」页头图的缩影，点背景换背景、点头像换头像；已自定义时弹出「从相册选择 / 恢复默认」 */
export function ProfilePage({ onBack, onPick }: { onBack: () => void; onPick: (t: PhotoTarget) => void }) {
  const state = useStore()
  const avatar = usePhotoSrc(state.prefs.avatar, '/avatar.jpg')
  const wall = usePhotoSrc(state.prefs.wall, '/wall.jpg')
  const [menu, setMenu] = useState<PhotoTarget | null>(null)
  const tap = (t: PhotoTarget) => (state.prefs[t] ? setMenu(t) : onPick(t))
  const reset = (t: PhotoTarget) => {
    void camera.remove([state.prefs[t]])
    store.setPrefs(t === 'avatar' ? { avatar: '' } : { wall: '' })
  }
  return (
    <SubPage title="个人资料" onBack={onBack}>
      <div className="relative h-[172px] overflow-hidden rounded-[18px] bg-[#5d6d55]">
        <button onClick={() => tap('wall')} className="absolute inset-0 transition-opacity active:opacity-80">
          <img src={wall} alt="" className="h-full w-full object-cover object-[50%_32%]" />
          <div className="absolute inset-x-0 bottom-0 h-[96px] bg-gradient-to-t from-black/50 to-transparent" />
          <CameraBadge className="absolute top-3 right-3 h-[28px] w-[28px] bg-black/35 text-white backdrop-blur-md" />
        </button>
        <button onClick={() => tap('avatar')} className="absolute bottom-4 left-4 h-[64px] w-[64px] transition-transform duration-150 active:scale-[.95]">
          <img src={avatar} alt="" className="h-full w-full rounded-full border-2 border-white/90 object-cover" />
          <CameraBadge className="absolute -right-0.5 -bottom-0.5 h-[24px] w-[24px] bg-(--c-ink) text-(--c-bg) ring-2 ring-white" />
        </button>
      </div>
      {menu && (
        <ActionSheet
          title={menu === 'avatar' ? '头像' : '背景'}
          groups={[[
            { title: '从相册选择', icon: ICON.image, onClick: () => onPick(menu) },
            { title: '恢复默认', icon: ICON.undo, onClick: () => { reset(menu); haptic('light') } },
          ]]}
          onClose={() => setMenu(null)}
        />
      )}
      <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
        <Field k="名称">
          <TextInput
            value={state.prefs.name}
            maxLength={20}
            placeholder={state.semester?.name ?? '我的课表'}
            onChange={(e) => store.setPrefs({ name: e.target.value })}
            onBlur={(e) => store.setPrefs({ name: e.target.value.trim() })}
          />
        </Field>
      </div>
    </SubPage>
  )
}
