/** 调试 · 推理：本地 OCR 的加速方式与运行耗时 */
import { useCallback, useEffect, useState } from 'react'
import { eduOcr, type OcrBench, type OcrDiagnostics } from '../edu-browser'
import { Failed, Group, KV, Pending } from './kit'
import { Page, Row, TopBar } from '../ui'

/** 一条推理路径：显示结果与耗时，失败显示原因 */
function BenchRow({ k, note, b }: { k: string; note: string; b: OcrBench }) {
  return (
    <KV
      k={k}
      v={b.ok ? '可用' : '不可用'}
      sub={b.ok ? `${note} · 建立 ${b.createMs} ms · 首次 ${b.firstMs} ms · 最快 ${b.bestMs} ms` : (b.error ?? '未知错误').trim()}
      tone={b.ok ? 'ok' : 'bad'}
    />
  )
}

export function OcrPage({ onBack }: { onBack: () => void }) {
  const [info, setInfo] = useState<OcrDiagnostics | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = useCallback(() => {
    setBusy(true)
    setError('')
    eduOcr.diagnose().then(
      (d) => {
        setInfo(d)
        setBusy(false)
      },
      (e: unknown) => {
        setInfo(null)
        setError(e instanceof Error ? e.message : '探测失败')
        setBusy(false)
      },
    )
  }, [])

  useEffect(() => {
    run()
  }, [run])

  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-10 [scrollbar-width:none]">
        <TopBar title="推理" sub="本地 OCR" onBack={onBack} />
        {error ? <Failed text={error} /> : !info ? <Pending text="正在检测" /> : null}
        {info && (
          <>
            <Group title="当前状态">
              <KV
                k="加速器"
                v={info.strict.ok ? '可用' : '不可用'}
                sub={info.strict.ok ? 'NNAPI 可独立运行' : 'NNAPI 不可用，使用 CPU'}
                tone={info.strict.ok ? 'ok' : 'bad'}
              />
              <KV k="当前会话" v={info.provider === 'nnapi' ? 'NNAPI' : 'CPU'} sub={info.provider === 'nnapi' ? '登录识别正在使用 NNAPI' : '登录识别正在使用 CPU'} />
            </Group>
            <Group title="运行测试">
              <BenchRow k="NNAPI 独占" note="不使用 CPU" b={info.strict} />
              <BenchRow k="NNAPI 优先" note="不支持的算子使用 CPU" b={info.nnapi} />
              <BenchRow k="CPU" note="仅使用 CPU" b={info.cpu} />
            </Group>
            <Group title="运行环境">
              <KV
                k="执行后端"
                v={info.providers.map((p) => p.replace(/ExecutionProvider$/, '')).join(' · ') || '无'}
                sub={info.providers.some((p) => /nnapi/i.test(p)) ? '包含 NNAPI' : '仅 CPU'}
              />
              <KV k="运行时" v={`ONNX Runtime ${info.ort}`} />
            </Group>
            <div className="mt-5 rounded-[18px] bg-(--c-surface) px-4">
              <Row title="重新检测" onClick={busy ? undefined : run} right={busy ? <span className="text-[12px] font-medium text-(--c-ink4)">检测中</span> : undefined} />
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
