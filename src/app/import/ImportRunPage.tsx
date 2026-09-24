/** 导入预览：解析 → 差异 → 应用；教务导入在这一页可选「保持登录，自动更新」 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Semester } from '../../domain/types'
import { fmtMinutes } from '../../domain/dates'
import { maskToWeeks } from '../../domain/weeks'
import { diffImport, normalize, type NormalizedCourse, type RuleOutput } from '../../domain/importer'
import { runRule, type RuleManifest } from '../../domain/rules'
import { fetchUrl } from '../../domain/importers/url'
import { uid } from '../../domain/store'
import { store } from '../store'
import { defaultSemester, extendGrid, guessSemesterName, isDefaultGrid, mondayOf, semesterEnded, todayStr } from '../semester'
import { edu } from '../edu-browser'
import { enableEduSync, setEduSyncEnabled, useEduSync, type EduSyncSource } from '../edu-sync'
import { FADE, Page, PrimaryButton, Switch, TextAction, TextInput, TopBar, WD, md } from '../ui'
import { KIND_HINT, KIND_LABEL } from './kinds'
import { PreviewGrid } from './PreviewGrid'

type ImportStage = 'input' | 'preview'


/* 解析出来的课程卡片：与原型的课程行同一套视觉 */
function ParsedRow({ nc, sem }: { nc: NormalizedCourse; sem: Semester }) {
  const r = nc.rules[0]
  const weeks = r ? maskToWeeks(r.weeksMask) : []
  const span = weeks.length === 0
    ? ''
    : weeks.length === weeks[weeks.length - 1] - weeks[0] + 1
      ? `第 ${weeks[0]}–${weeks[weeks.length - 1]} 周`
      : weeks.every((w) => w % 2 === weeks[0] % 2)
        ? `第 ${weeks[0]}–${weeks[weeks.length - 1]} 周${weeks[0] % 2 === 1 ? '单' : '双'}`
        : `${weeks.length} 周`
  const slot = r ? `${WD[r.weekday]} ${r.startPeriod}–${r.endPeriod} 节` : '—'
  const time = r ? `${fmtMinutes(sem.timeGrid[r.startPeriod - 1]?.start ?? 0)}–${fmtMinutes(sem.timeGrid[r.endPeriod - 1]?.end ?? 0)}` : ''
  return (
    <div className="flex items-center px-4 py-3">
      <i className="mr-3 h-[26px] w-[3px] flex-none rounded-full" style={{ background: nc.course.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold">{nc.course.name}</div>
        <div className="mt-0.5 truncate text-[12px] font-medium text-(--c-ink4)">
          {[slot, time, span, r?.location, nc.course.teacher].filter(Boolean).join('，')}
        </div>
      </div>
      {nc.rules.length > 1 && <span className="ml-2 flex-none text-[11.5px] font-semibold text-(--c-ink5)">{nc.rules.length} 段</span>}
    </div>
  )
}

/* 导入流程（内页）：输入 → 解析结果 → 回到课表 */
export function ImportRunPage({ rule, initialText, initialOut, autoRun, overBrowser, syncSource, onBack, onDone }: { rule: RuleManifest; initialText?: string; initialOut?: RuleOutput; autoRun?: boolean; /** 盖在内置浏览器上：透明模式下仍保持可见且不透明，退回时从学校页面上滑走 */ overBrowser?: boolean; /** 教务导入：可选保持登录自动更新 */ syncSource?: EduSyncSource; onBack: () => void; onDone: () => void }) {
  const [stage, setStage] = useState<ImportStage>(initialOut ? 'preview' : 'input')
  const eduSync = useEduSync()
  const [keepLogin, setKeepLogin] = useState(!!eduSync?.enabled)
  /* 保持登录需要系统 WebView 支持多 Profile，不支持就不显示 */
  const [canKeep, setCanKeep] = useState(false)
  useEffect(() => {
    if (!syncSource) return
    let alive = true
    void edu.profiles().then((ok) => alive && setCanKeep(ok))
    return () => {
      alive = false
    }
  }, [syncSource])
  const [text, setText] = useState(initialText ?? '')
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'' | 'fetch' | 'parse'>('')
  const [error, setError] = useState('')
  const [out, setOut] = useState<RuleOutput | null>(initialOut ?? null)
  const [sem] = useState<Semester>(() => store.state.semester ?? defaultSemester(mondayOf(todayStr())))
  const [useFileGrid, setUseFileGrid] = useState(() => {
    /* 直登预览（initialOut）自带动作息：和当前不同且来源可信就默认采用 */
    const g = initialOut?.timeGrid
    if (!g || g.length === 0) return false
    return JSON.stringify(g) !== JSON.stringify(sem.timeGrid) && (!!initialOut.semester || isDefaultGrid(sem.timeGrid))
  })

  /* 文件里的节次表：和当前不同才算“带了作息” */
  const fileGrid = useMemo(() => {
    const g = out?.timeGrid
    if (!g || g.length === 0) return null
    return JSON.stringify(g) === JSON.stringify(sem.timeGrid) ? null : g
  }, [out, sem.timeGrid])

  /* 当前学期已结束且有内容：这次导入封存旧学期，开一个新学期，不和旧课合并 */
  const rollover = !!store.state.semester && semesterEnded(sem) && (store.state.courses.length > 0 || store.state.entries.length > 0)

  /* 导入后的学期：作息取文件或当前，课程超出节次表时往后补齐 */
  const target = useMemo<Semester>(() => {
    if (!out) return sem
    const meta = out.semester ?? {}
    const grid = useFileGrid && fileGrid ? fileGrid : sem.timeGrid
    const need = Math.min(20, Math.max(0, ...out.courses.map((c) => c.endPeriod)))
    if (!rollover) return { ...sem, ...meta, timeGrid: extendGrid(grid, need) }
    const startDate = meta.startDate ?? mondayOf(todayStr())
    return {
      ...sem,
      id: uid(),
      name: meta.name ?? guessSemesterName(startDate),
      startDate,
      totalWeeks: meta.totalWeeks ?? sem.totalWeeks,
      vacations: [],
      examWeeks: [],
      timeGrid: extendGrid(grid, need),
    }
  }, [out, sem, fileGrid, useFileGrid, rollover])
  const pending = useMemo(() => (out ? normalize(out, target) : null), [out, target])
  const preview = useMemo(() => (pending ? (rollover ? diffImport([], pending.courses, new Set()) : store.previewImport(pending.courses)) : null), [pending, rollover])

  const parse = async () => {
    setBusy('parse')
    setError('')
    try {
      const res: RuleOutput = await runRule(rule, { text, bytes: fileBytes ?? undefined }, sem)
      const g = res.timeGrid
      const differs = !!g && g.length > 0 && JSON.stringify(g) !== JSON.stringify(sem.timeGrid)
      // 当前作息还是出厂默认、或文件是课程表自己导出的：默认采用文件里的；用户改过的作息不自动覆盖
      setUseFileGrid(differs && (!!res.semester || isDefaultGrid(sem.timeGrid)))
      setOut(res)
      setStage('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败')
    } finally {
      setBusy('')
    }
  }

  const confirm = () => {
    if (!pending) return
    const t0 = performance.now()
    const failed = pending.diagnostics.filter((d) => d.level === 'error').length
    const hadCourses = store.state.courses.length > 0
    if (rollover) store.startSemester(target)
    else store.setSemester(target)
    store.applyImport(pending.courses, {
      id: uid(), semesterId: target.id,
      ruleId: rule.id, ruleName: rule.name, ruleVersion: rule.version,
      at: Date.now(), durationMs: Math.max(1, Math.round(performance.now() - t0)),
      failed, diagnostics: pending.diagnostics,
    })
    if (syncSource && canKeep) {
      if (keepLogin) enableEduSync(syncSource)
      else if (eduSync) setEduSyncEnabled(false)
    }
    onDone()
  }

  const grab = async () => {
    setBusy('fetch')
    setError('')
    try {
      const res = await fetchUrl(url.trim())
      setText(res.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : '抓取失败，可以改用复制粘贴')
    } finally {
      setBusy('')
    }
  }

  const errors = pending?.diagnostics.filter((d) => d.level === 'error') ?? []

  /* 文件是用课程表直接打开的（或在页内选了文件）：不经过粘贴页，直接给预览 */
  const auto = useRef(autoRun && !!initialText)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!auto.current) return
    auto.current = false
    void parse()
  }, [tick])

  return (
    <Page keep={overBrowser ? 'opaque' : undefined}>
      <div className="flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <TopBar
          title={stage === 'input' ? rule.name : `${pending?.courses.length ?? 0} 门课`}
          sub={stage === 'input' ? KIND_LABEL[rule.input] : undefined}
          onBack={stage === 'preview' && !initialOut ? () => setStage('input') : onBack}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
            {stage === 'input' && (
              <div className="mt-6">
                {rule.input === 'xlsx' ? (
                  <label className="flex w-full cursor-pointer items-center justify-center rounded-[16px] bg-(--c-surface) py-10 text-[13.5px] font-semibold text-(--c-ink2)">
                    {fileName || '选择 .xlsx 文件'}
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        setFileBytes(new Uint8Array(await f.arrayBuffer()))
                        setFileName(f.name)
                      }}
                    />
                  </label>
                ) : (
                  <>
                    {rule.input === 'ics' && (
                      <label className="mb-2.5 flex w-full cursor-pointer items-center justify-center rounded-[16px] bg-(--c-surface) py-10 text-[13.5px] font-semibold text-(--c-ink2)">
                        {fileName || '选择 .ics 文件'}
                        <input
                          type="file"
                          accept=".ics,text/calendar"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setFileName(f.name)
                            setText(await f.text())
                            auto.current = true
                            setTick((n) => n + 1)
                          }}
                        />
                      </label>
                    )}
                    <div className="flex items-center gap-3 rounded-[16px] bg-(--c-surface) px-4 py-2.5">
                      <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// 链接" className="min-w-0 flex-1 text-[13px]" />
                      <TextAction disabled={!url.trim() || busy !== ''} busy={busy === 'fetch'} onClick={grab}>抓取</TextAction>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={KIND_HINT[rule.input]}
                      className="mt-2.5 h-64 w-full rounded-[16px] bg-(--c-surface) p-3.5 font-mono text-[12px] leading-relaxed outline-none placeholder:text-(--c-ink5) focus:ring-1 focus:ring-(--c-accent-line)"
                    />
                  </>
                )}
                {error && <div className="mt-2.5 px-1 text-[12.5px] font-medium text-(--c-danger)">{error}</div>}
              </div>
            )}

            {stage === 'preview' && pending && preview && (
              <div className="mt-6">
                <div className="flex items-baseline gap-4 px-1 text-[12.5px] font-semibold tabular-nums">
                  {preview.added.length > 0 && <span className="text-(--c-accent)">新增 {preview.added.length}</span>}
                  {preview.changed.length > 0 && <span className="text-(--c-ink)">调整 {preview.changed.length}</span>}
                  {preview.unchanged > 0 && <span className="text-(--c-ink3)">不变 {preview.unchanged}</span>}
                  {preview.protectedKept.length > 0 && <span className="text-(--c-ink3)">保留改动 {preview.protectedKept.length}</span>}
                  {preview.removed.length > 0 && <span className="text-(--c-danger)">消失 {preview.removed.length}</span>}
                </div>
                {(out?.semester || rollover) && (
                  <div className="mt-1.5 px-1 text-[12.5px] font-semibold tabular-nums text-(--c-ink4)">{`${target.name}，${md(target.startDate)} 开学，共 ${target.totalWeeks} 周`}</div>
                )}
                {rollover && (
                  <div className="mt-2.5 rounded-[16px] bg-(--c-surface) px-4 py-3 text-[12.5px] font-medium text-(--c-ink3)">
                    <span className="font-bold text-(--c-ink)">开始新学期</span>　{sem.name}已结束，将移入往期学期
                  </div>
                )}

                {initialOut && pending.courses.length > 0 && (
                  <div className="mt-2.5">
                    <PreviewGrid courses={pending.courses} periods={target.timeGrid.length} />
                  </div>
                )}

                {fileGrid && (
                  <div className="mt-2.5 flex items-center rounded-[16px] bg-(--c-surface) px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold">采用文件里的作息时间</div>
                      <div className="mt-0.5 truncate text-[12px] font-medium tabular-nums text-(--c-ink4)">
                        {`${fileGrid.length} 节 ${fmtMinutes(fileGrid[0].start)}–${fmtMinutes(fileGrid[fileGrid.length - 1].end)}，当前 ${sem.timeGrid.length} 节`}
                      </div>
                    </div>
                    <Switch on={useFileGrid} onChange={setUseFileGrid} />
                  </div>
                )}

                {syncSource && canKeep && (
                  <div className="mt-2.5 flex items-center rounded-[16px] bg-(--c-surface) px-4 py-3">
                    <div className="min-w-0 flex-1 text-[14px] font-bold">保持登录，自动更新课表</div>
                    <Switch on={keepLogin} onChange={setKeepLogin} />
                  </div>
                )}

                <div className="mt-2.5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
                  {pending.courses.map((nc) => (
                    <ParsedRow key={nc.course.identityKey} nc={nc} sem={target} />
                  ))}
                  {pending.courses.length === 0 && (
                    <div className="px-4 py-8 text-center text-[13px] font-medium text-(--c-ink4)">没有解析出课程</div>
                  )}
                </div>

                {preview.removed.length > 0 && (
                  <div className="mt-4 rounded-[16px] bg-(--c-surface) px-4 py-3.5 text-[12.5px] font-medium text-(--c-ink3)">
                    <span className="font-bold text-(--c-danger)">进回收站</span>　{preview.removed.map((c) => c.name).join('、')}
                  </div>
                )}

                {errors.length > 0 && (
                  <>
                    <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">{errors.length} 条无法解析</div>
                    <div className="mt-2 space-y-2">
                      {errors.map((d, i) => (
                        <div key={i} className="rounded-[12px] bg-(--c-surface) px-3.5 py-2.5">
                          <div className="text-[12.5px] font-bold text-(--c-danger)">{d.message}</div>
                          {d.at?.snippet && <div className="mt-1 truncate font-mono text-[11px] text-(--c-ink4)">{d.at.snippet}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        {stage === 'input' ? (
          <PrimaryButton disabled={busy === 'fetch' || (rule.input === 'xlsx' ? !fileBytes : !text.trim())} busy={busy === 'parse'} onClick={parse}>解析</PrimaryButton>
        ) : (
          <PrimaryButton disabled={(pending?.courses.length ?? 0) === 0} onClick={confirm}>导入</PrimaryButton>
        )}
      </div>
    </Page>
  )
}
