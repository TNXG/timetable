import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { AnimatePresence } from 'motion/react'
import { diffDays } from '../domain/dates'
import { store } from './store'
import { defaultSemester, mondayOf, todayStr } from './semester'
import { DateInput, Field, Page, PrimaryButton, Row, TextAction, TopBar, md } from './ui'
import { DEFAULT_PLUGIN } from '../domain/edu/plugin'

const WEEKS = 20

/** 开学日期，落到所在周的周一 */
export function StartDateField({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
      <Field k="开学" sub={value ? `第 1 周 ${md(mondayOf(value))} 周一` : undefined}>
        <DateInput value={value} onChange={onChange} />
      </Field>
    </div>
  )
}

export function currentWeek(startDate: string): number {
  return Math.floor(diffDays(todayStr(), startDate) / 7) + 1
}

function Step({ title, sub, onBack, footer, children }: { title: string; sub?: string; onBack?: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page onBack={onBack} root={!onBack}>
      <div className="flex-1 overflow-y-auto px-5 [scrollbar-width:none]">
        <TopBar title={title} sub={sub} onBack={onBack} />
        <div className="mt-6">{children}</div>
      </div>
      <div className="flex-none px-5 pb-[max(22px,env(safe-area-inset-bottom))]">{footer}</div>
    </Page>
  )
}

/** 首次进入：登录（默认学校，作息/姓名随导入自动带出；开学日期在导入后补全），同一套推入 */
export default function Onboarding({ onDone, initialStep = 0, backRef }: { onDone: (ruleId: string | null) => void; initialStep?: number; backRef?: MutableRefObject<() => boolean> }) {
  const [step, setStep] = useState(initialStep)
  if (backRef) {
    backRef.current = () => {
      if (step <= 0) return false
      setStep(step - 1)
      return true
    }
  }

  return (
    <div className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-(--c-bg) font-sans text-(--c-ink)">
      <Page root className="intro-hero">
        <div className="flex flex-1 flex-col px-7 pt-[max(64px,calc(env(safe-area-inset-top)+34px))]">
          <img src="/mascot.png" alt="" className="h-[200px] w-[200px] self-center object-contain" />
          <div className="mt-auto pb-14">
            <div className="text-[17px] font-bold tracking-[.02em] text-(--c-ink3)">嘎嘎课程表</div>
            <h1 className="mt-3 text-[44px] leading-[1.15] font-extrabold tracking-[-.04em]">
              <span className="block text-(--c-ink)">你的课表，</span>
              <span className="block text-(--c-ink4)">理应如此。</span>
            </h1>
          </div>
        </div>
        <div className="flex-none px-5 pb-[max(22px,env(safe-area-inset-bottom))]">
          <PrimaryButton onClick={() => setStep(1)}>开始</PrimaryButton>
        </div>
      </Page>

      <AnimatePresence>
        {step >= 1 && (
          <Step
            key="login"
            title="登录"
            sub={DEFAULT_PLUGIN.name}
            onBack={() => setStep(0)}
            footer={
              <div className="flex justify-center gap-8">
                <TextAction tone="mute" onClick={() => onDone('manual')}>手动添加</TextAction>
                <TextAction tone="mute" onClick={() => onDone(null)}>稍后</TextAction>
              </div>
            }
          >
            <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
              <Row title={DEFAULT_PLUGIN.name} badge="默认" onClick={() => onDone('edu')} />
            </div>
          </Step>
        )}
      </AnimatePresence>
    </div>
  )
}
