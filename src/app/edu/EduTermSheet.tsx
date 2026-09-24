/** 选学期：正方课表页下拉给出的学年学期，最新的排前 */
import { useMemo, useRef, useState } from 'react'
import { zfTermOptions, type ProbeResult } from '../../domain/edu/scripts'
import { termLabel, type ZfTerm } from '../../domain/edu/zhengfang'
import { haptic } from '../widgets'
import { PrimaryButton, RadioRow, Sheet, SheetClose, SheetHead } from '../ui'

export function EduTermSheet({ zf, onClose, onPick }: { zf: NonNullable<ProbeResult['zf']>; onClose: () => void; onPick: (t: ZfTerm) => void }) {
  const dismiss = useRef<(() => void) | null>(null)
  const options = useMemo(() => zfTermOptions(zf), [zf])
  const [sel, setSel] = useState<ZfTerm>(() => options.find((t) => t.xnm === zf.sel.xnm && t.xqm === zf.sel.xqm) ?? options[0] ?? zf.sel)
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismiss}
      className="px-5 pb-1"
      header={<SheetHead title="导入哪个学期？" trail={<SheetClose onClick={() => dismiss.current?.()} />} />}
      footer={
        <div className="px-5 pt-2">
          <PrimaryButton onClick={() => { onPick(sel); dismiss.current?.() }}>继续</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-2 pt-1">
        {options.map((t) => (
          <RadioRow
            key={`${t.xnm}-${t.xqm}`}
            on={t.xnm === sel.xnm && t.xqm === sel.xqm}
            onClick={() => { haptic('selection'); setSel(t) }}
          >
            {termLabel(t)}
          </RadioRow>
        ))}
      </div>
    </Sheet>
  )
}
