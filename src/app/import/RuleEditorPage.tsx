/** 自定义规则：命名、选输入类型、写脚本，存进规则库 */
import { useState } from 'react'
import { DEFAULT_CSV_MAPPING, type RuleInputKind, type RuleManifest } from '../../domain/rules'
import { uid } from '../../domain/store'
import { store } from '../store'
import { Chips, Field, Page, PrimaryButton, Row, TextInput, TopBar } from '../ui'
import { KIND_LABEL } from './kinds'

const SCRIPT_TEMPLATE = `// 输入整段文本，返回课程数组
function parse(input) {
  return { courses: input.split('\\n').filter(Boolean).map(line => {
    const [name, teacher, location, weekday, sp, ep, weeks] = line.split(',')
    return { name, teacher, location, weekday: Number(weekday), startPeriod: Number(sp), endPeriod: Number(ep), weeks }
  }), diagnostics: [] }
}`

function bumpVersion(v: string): string {
  const [a, b] = v.split('.').map((n) => parseInt(n, 10) || 0)
  return `${a}.${b + 1}`
}

export function RuleEditorPage({ rule, onBack }: { rule: RuleManifest | null; onBack: () => void }) {
  const KINDS: RuleInputKind[] = ['csv', 'json', 'html', 'xlsx', 'ics', 'script']
  const [name, setName] = useState(rule?.name ?? '')
  const [input, setInput] = useState<RuleInputKind>(rule?.input ?? 'csv')
  const [script, setScript] = useState(rule?.script ?? SCRIPT_TEMPLATE)
  const builtin = !!rule?.id.startsWith('builtin-')

  const save = () => {
    const next: RuleManifest = {
      id: rule?.id ?? uid(),
      name: name.trim() || KIND_LABEL[input],
      version: rule ? bumpVersion(rule.version) : '1.0',
      input,
      csv: input === 'csv' || input === 'xlsx' ? (rule?.csv ?? DEFAULT_CSV_MAPPING) : undefined,
      html: input === 'html' ? (rule?.html ?? { mode: 'grid' }) : undefined,
      script: input === 'script' ? script : undefined,
      samples: rule?.samples,
      createdAt: rule?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    store.saveRule(next)
    onBack()
  }

  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title={rule ? '编辑规则' : '添加规则'} onBack={onBack} />

        <div className="mt-6 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Field k="规则名"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={KIND_LABEL[input]} /></Field>
        </div>

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">输入类型</div>
        <div className="mt-2.5">
          <Chips items={KINDS.map((k) => KIND_LABEL[k])} active={KINDS.indexOf(input)} onPick={(i) => setInput(KINDS[i])} />
        </div>

        {input === 'script' && (
          <>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              spellCheck={false}
              className="mt-4 h-56 w-full rounded-[16px] bg-(--c-surface) p-3.5 font-mono text-[11.5px] leading-relaxed outline-none focus:ring-1 focus:ring-(--c-accent-line)"
            />
          </>
        )}

        {rule && !builtin && (
          <div className="mt-5 overflow-hidden rounded-[16px] bg-(--c-surface)">
            <Row title="删除规则" danger onClick={() => { store.removeRule(rule.id); onBack() }} right={<span />} />
          </div>
        )}
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={save}>保存</PrimaryButton>
      </div>
    </Page>
  )
}
