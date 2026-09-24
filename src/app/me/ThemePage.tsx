/** 主题选择：三块小预览用各主题色板渲染，选项同提醒设置页 */
import { useDynamic, useTheme, resolve, setDynamic, setTheme, THEME_LABEL, type ThemePref } from '../theme'
import { setStickersOn, useStickersOn } from '../Sticker'
import { Page, TopBar } from '../ui'

const THEME_ORDER: ThemePref[] = ['system', 'light', 'dark', 'black']

/* 主题选择：选项列表同提醒设置页，上方三块小预览直接用各主题的色板渲染 */
export function ThemePage({ onBack }: { onBack: () => void }) {
  const theme = useTheme()
  const [dyn, dynOk] = useDynamic()
  const stickers = useStickersOn()
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-[130px] [scrollbar-width:none]">
        <TopBar title="主题" onBack={onBack} />
        <div className="mt-6 flex gap-3">
          {(['light', 'dark', 'black'] as const).map((r) => {
            const on = theme === r || (theme === 'system' && resolve() === r)
            return (
              <button
                key={r}
                onClick={() => setTheme(r)}
                data-theme={r}
                className={`flex-1 overflow-hidden rounded-[16px] bg-(--c-bg) p-2.5 ring-[1.5px] transition-transform duration-150 active:scale-[.97] ${on ? 'ring-(--c-accent)' : 'ring-(--c-line)'}`}
              >
                <div className="rounded-[10px] bg-(--c-surface) p-2">
                  <div className="h-[6px] w-2/3 rounded-full bg-(--c-ink)" />
                  <div className="mt-1.5 h-[5px] w-1/2 rounded-full bg-(--c-ink4)" />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-[14px] flex-1 rounded-[5px] bg-(--c-accent)" />
                  <div className="h-[14px] flex-1 rounded-[5px] bg-(--c-surface)" />
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-5 rounded-[18px] bg-(--c-surface) px-4">
          {THEME_ORDER.map((t, i) => {
            const on = theme === t
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}
              >
                <span className={`flex-1 text-[14px] font-semibold ${on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{THEME_LABEL[t]}</span>
                {on && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-accent)' }} strokeWidth="2.6"><path d="m5 13 4.5 4.5L19 7" /></svg>
                )}
              </button>
            )
          })}
        </div>
        {dynOk && (
          <>
            <div className="mt-6 px-1 text-[12px] font-bold text-(--c-ink4)">主题色</div>
            <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
              {([[false, '默认'], [true, '跟随系统配色']] as const).map(([v, label], i) => {
                const on = dyn === v
                return (
                  <button
                    key={label}
                    onClick={() => setDynamic(v)}
                    className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}
                  >
                    <span className={`flex-1 text-[14px] font-semibold ${on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{label}</span>
                    {on && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-accent)' }} strokeWidth="2.6"><path d="m5 13 4.5 4.5L19 7" /></svg>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <div className="mt-6 px-1 text-[12px] font-bold text-(--c-ink4)">课程贴纸</div>
        <div className="mt-2 rounded-[18px] bg-(--c-surface) px-4">
          {([[true, '显示'], [false, '隐藏']] as const).map(([v, label], i) => {
            const on = stickers === v
            return (
              <button
                key={label}
                onClick={() => setStickersOn(v)}
                className={`flex w-full items-center py-3.5 text-left transition-opacity active:opacity-60 ${i ? 'border-t border-(--c-surface2)' : ''}`}
              >
                <span className={`flex-1 text-[14px] font-semibold ${on ? 'text-(--c-accent)' : 'text-(--c-ink)'}`}>{label}</span>
                {on && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--c-accent)' }} strokeWidth="2.6"><path d="m5 13 4.5 4.5L19 7" /></svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Page>
  )
}
