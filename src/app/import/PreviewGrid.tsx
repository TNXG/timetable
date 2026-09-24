/** 一周课表缩略图：按节次比例放色块，只看分布不看字 */
import type { NormalizedCourse } from '../../domain/importer'
import { tint } from '../ui'

const GRID_H = 152

/** 一周课表缩略图：按节次比例放色块，只看分布不看字 */
export function PreviewGrid({ courses, periods }: { courses: NormalizedCourse[]; periods: number }) {
  const days = courses.some((c) => c.rules.some((r) => r.weekday === 7)) ? 7 : courses.some((c) => c.rules.some((r) => r.weekday === 6)) ? 6 : 5
  const n = Math.max(1, periods)
  const cols = Array.from({ length: days }, (_, i) => i + 1)
  const marks = [0.25, 0.5, 0.75].map((f) => Math.round(GRID_H * f))
  return (
    <div className="rounded-[16px] bg-(--c-surface) px-3 pt-2.5 pb-3">
      <div className="flex gap-[4px]">
        {cols.map((d) => <div key={d} className="flex-1 text-center text-[9.5px] font-semibold text-(--c-ink4)">{'一二三四五六日'[d - 1]}</div>)}
      </div>
      <div className="relative mt-1.5 flex gap-[4px]" style={{ height: GRID_H }}>
        {marks.map((t) => <div key={t} className="absolute inset-x-0 h-px bg-(--c-line2)" style={{ top: t }} />)}
        {cols.map((d) => (
          <div key={d} className="relative flex-1">
            {courses.flatMap((c) =>
              c.rules.filter((r) => r.weekday === d).map((r, i) => (
                <div
                  key={`${c.course.identityKey}-${i}`}
                  className="absolute inset-x-0 overflow-hidden rounded-[5px] px-1 py-[3px] text-[7.5px] leading-[1.25] font-bold"
                  style={{
                    top: ((r.startPeriod - 1) / n) * GRID_H,
                    height: Math.max(6, ((r.endPeriod - r.startPeriod + 1) / n) * GRID_H - 1),
                    background: tint(c.course.color, 14),
                    color: `color-mix(in srgb, ${c.course.color} 88%, var(--c-ink-mix))`,
                  }}
                >
                  {c.course.name}
                </div>
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
