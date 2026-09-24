/** 登录导入后补全：缺什么补什么（目前是开学日期、称呼；教务拿不到的才在这里问） */
import { useState } from 'react'
import { store } from '../store'
import { mondayOf, todayStr } from '../semester'
import { StartDateField } from '../Onboarding'
import { Field, Page, PrimaryButton, TextInput, TopBar } from '../ui'
import { PageBody, PageFooter } from '../course/shared'

/** 还缺哪些要用户给的信息；一项都不缺就不用跳这一页 */
export function missingInfo(p: { dateSet?: boolean; name?: string }): boolean {
  return !p.dateSet || !p.name
}

export function CompleteInfoPage({ onDone }: { onDone: () => void }) {
  const prefs = store.state.prefs
  const needDate = !prefs.dateSet
  const needName = !prefs.name
  const [date, setDate] = useState(() => mondayOf(todayStr()))
  const [name, setName] = useState('')

  const save = () => {
    const sem = store.state.semester
    if (needDate && sem) store.setSemester({ ...sem, startDate: mondayOf(date) })
    const patch: { dateSet?: boolean; name?: string } = { dateSet: true }
    if (needName && name.trim()) patch.name = name.trim()
    store.setPrefs(patch)
    onDone()
  }

  return (
    <Page>
      <PageBody>
        <TopBar title="补全信息" onBack={onDone} />
        <div className="mt-6 space-y-5">
          {needDate && <StartDateField value={date} onChange={setDate} />}
          {needName && (
            <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
              <Field k="姓名">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" />
              </Field>
            </div>
          )}
        </div>
      </PageBody>
      <PageFooter>
        <PrimaryButton onClick={save}>保存</PrimaryButton>
      </PageFooter>
    </Page>
  )
}
