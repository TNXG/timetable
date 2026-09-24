/** 编辑课程：名称、老师、电话、分类、颜色与上课时间 */
import { useEffect, useRef, useState } from 'react'
import type { Course } from '../../domain/types'
import { COURSE_COLORS } from '../../domain/palette'
import { store, useStore } from '../store'
import { Chevron, Field, Page, PrimaryButton, TextInput, TopBar, WD, tint } from '../ui'
import { PageBody, PageFooter, ruleClock, sortRules } from './shared'

/* ---------------- 编辑课程（内页） ---------------- */

export function CourseEditPage({ course, onBack, onEditSession }: { course: Course; onBack: () => void; onEditSession: (ruleId: string) => void }) {
  const state = useStore()
  const cur = state.courses.find((c) => c.id === course.id) ?? course
  const [name, setName] = useState(cur.name)
  const [teacher, setTeacher] = useState(cur.teacher ?? '')
  const [teacherPhone, setTeacherPhone] = useState(cur.teacherPhone ?? '')
  const [category, setCategory] = useState(cur.category ?? '')
  const [color, setColor] = useState(cur.color)
  const colorRow = useRef<HTMLDivElement>(null)
  /* 老数据里不在色板上的颜色放在最前面，让当前颜色总有一个被选中 */
  const COLORS = COURSE_COLORS.includes(cur.color) ? COURSE_COLORS : [cur.color, ...COURSE_COLORS]
  useEffect(() => {
    const el = colorRow.current
    const i = COLORS.indexOf(cur.color)
    if (el && i >= 0) el.scrollLeft = Math.max(0, i * 32 - 140)
  }, [cur.color])
  const rules = state.rules.filter((r) => r.courseId === cur.id)

  const dirty =
    name.trim() !== cur.name ||
    teacher.trim() !== (cur.teacher ?? '') ||
    teacherPhone.trim() !== (cur.teacherPhone ?? '') ||
    category.trim() !== (cur.category ?? '') ||
    color !== cur.color

  const save = () => {
    const cleanPhone = teacherPhone.replace(/[\s\-]/g, '').replace(/^\+?86/, '') || undefined
    store.editCourse(cur.id, {
      name: name.trim() || cur.name,
      teacher: teacher.trim() || undefined,
      teacherPhone: cleanPhone && /^1[3-9]\d{9}$/.test(cleanPhone) ? cleanPhone : undefined,
      category: category.trim() || undefined,
      color,
    })
    onBack()
  }

  return (
    <Page>
      <PageBody>
        <TopBar title="编辑课程" onBack={onBack} />

        <div className="mt-5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
          <Field k="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field k="老师"><TextInput value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="可选" /></Field>
          <Field k="教师电话"><TextInput value={teacherPhone} inputMode="tel" onChange={(e) => setTeacherPhone(e.target.value)} placeholder="可选，用于一键拨号" /></Field>
          <Field k="分类"><TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="必修、选修等，可选" /></Field>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <span className="flex-none text-[12.5px] font-medium whitespace-nowrap text-(--c-ink4)">颜色</span>
          <div
            className="flex w-[196px] flex-none items-center gap-2.5 overflow-x-auto px-[7px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maskImage: 'linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent)' }}
            ref={colorRow}
          >
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full transition-transform duration-150 active:scale-[.9]"
                style={{ background: tint(c, 22), boxShadow: color === c ? `inset 0 0 0 1.6px ${c}` : undefined }}
              >
                <i className="h-[8px] w-[8px] rounded-full" style={{ background: c }} />
              </button>
            ))}
          </div>
        </div>

        {rules.length > 0 && (
          <>
            <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">上课时间</div>
            <div className="mt-2.5 divide-y divide-(--c-surface2) overflow-hidden rounded-[16px] bg-(--c-surface)">
              {sortRules(rules).map((r) => (
                <button key={r.id} onClick={() => onEditSession(r.id)} className="flex w-full items-center px-4 py-3 text-left active:bg-(--c-surface2)">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tabular-nums text-(--c-ink)">{WD[r.weekday]} {ruleClock(state.semester?.timeGrid, r)}</div>
                    {r.location && <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{r.location}</div>}
                  </div>
                  <Chevron size={14} />
                </button>
              ))}
            </div>
          </>
        )}

      </PageBody>

      <PageFooter>
        <PrimaryButton disabled={!dirty} onClick={save}>保存</PrimaryButton>
      </PageFooter>
    </Page>
  )
}
