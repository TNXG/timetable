import type { Snapshot } from "../../domain/engine";
import type { SemesterArchive } from "../../domain/store";
import type { ScheduleAdjustment, Semester } from "../../domain/types";
/** 学期：设置、新学期、往期 */
import { useState } from "react";
import { weekdayOf } from "../../domain/dates";
import { holidaysBetween } from "../../domain/holidays";
import { uid } from "../../domain/store";
import { currentWeek } from "../Onboarding";
import { guessSemesterName, mondayOf, semesterEnded, termEnd, todayStr } from "../semester";
import { store, useStore } from "../store";
import { DateInput, Field, md, Page, PrimaryButton, Row, SubPage, Switch, TextInput, TopBar } from "../ui";
import { haptic, nativeConfirm, nativeToast, syncWidgets } from "../widgets";

const WEEKDAYS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const liveCount = (s: Snapshot) => s.courses.filter(c => !c.hidden && !c.removedByImport).length;


/* 往期学期：只读内页，课程列表与删除入口 */
export function ArchivePage({ a, onBack }: { a: SemesterArchive; onBack: () => void }) {
  const courses = a.courses.filter(c => !c.hidden && !c.removedByImport);
  const remove = async () => {
    const ok = await nativeConfirm({ title: `删除「${a.semester.name}」`, message: `${courses.length} 门课一起删除，不可恢复`, ok: "删除" });
    if (!ok)
      return;
    store.removeArchive(a.semester.id);
    haptic("warning");
    nativeToast("已删除");
    onBack();
  };
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 scrollbar-none">
        <TopBar title={a.semester.name} sub={`${md(a.semester.startDate)} 开学，${a.semester.totalWeeks} 周，${courses.length} 门课`} onBack={onBack} />
        <div className="mt-6 divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">
          {courses.map(c => <Row key={c.id} title={c.name} desc={c.teacher} right={<span />} />)}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl bg-(--c-surface)">
          <Row title="删除学期" danger onClick={() => void remove()} right={<span />} />
        </div>
      </div>
    </Page>
  );
}


export function SemesterSettings({ sem, onBack, onNew, onArchive, onAdjustments }: { sem: Semester; onBack: () => void; onNew: () => void; onArchive: (id: string) => void; onAdjustments: () => void }) {
  const state = useStore();
  const [name, setName] = useState(sem.name);
  const [date, setDate] = useState(sem.startDate);
  const [weeks, setWeeks] = useState(sem.totalWeeks);
  const [holidays, setHolidays] = useState(sem.holidays !== false);
  const start = mondayOf(date);
  const ended = semesterEnded({ startDate: start, totalWeeks: weeks });
  const archives = [...state.archives].reverse();
  const hols = holidaysBetween(start, termEnd({ startDate: start, totalWeeks: weeks }));

  return (
    <SubPage title="学期" sub={ended ? `已结束，共 ${weeks} 周` : `第 ${Math.max(1, currentWeek(start))} 周，共 ${weeks} 周`} onBack={onBack}>
      <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">
        <Field k="名称"><TextInput value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field k="开学周" sub={`${md(start)} 周一为第 1 周`}><DateInput value={start} onChange={d => setDate(mondayOf(d))} /></Field>
        <Field k="总周数"><TextInput type="number" min={1} max={64} value={weeks} onChange={e => setWeeks(Number(e.target.value))} /></Field>
        <div className="flex items-center px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">法定节假日不排课</div>
            <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{hols.length > 0 ? hols.map(h => `${h.name} ${md(h.start)}${h.start !== h.end ? `–${md(h.end)}` : ""}`).join("，") : "学期内无法定节假日"}</div>
          </div>
          <Switch on={holidays} onChange={setHolidays} />
        </div>
      </div>
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-(--c-surface)">
        <Row title="调休安排" desc={(sem.scheduleAdjustments ?? []).length ? (sem.scheduleAdjustments ?? []).map(a => `${md(a.date)} 上 ${md(a.teachingDate)} 的课`).join("，") : "未设置补课日期"} onClick={onAdjustments} right={<span />} />
      </div>
      <div className="mt-2.5 overflow-hidden rounded-2xl bg-(--c-surface)">
        <Row title="开始新学期" desc={ended ? "当前学期移入往期" : undefined} onClick={onNew} />
      </div>
      {archives.length > 0 && (
        <>
          <div className="mt-7 mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">往期学期</div>
          <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">
            {archives.map(a => <Row key={a.semester.id} title={a.semester.name} desc={`${md(a.semester.startDate)} 开学，${liveCount(a)} 门课`} onClick={() => onArchive(a.semester.id)} />)}
          </div>
        </>
      )}
      <div className="mt-8"><PrimaryButton onClick={() => { store.setSemester({ ...store.state.semester!, name: name.trim() || sem.name, startDate: start, totalWeeks: Math.min(64, Math.max(1, weeks)), holidays }); store.setPrefs({ dateSet: true }); onBack(); }}>保存</PrimaryButton></div>
    </SubPage>
  );
}

export function ScheduleAdjustmentPage({ sem, onBack }: { sem: Semester; onBack: () => void }) {
  const [items, setItems] = useState<ScheduleAdjustment[]>(sem.scheduleAdjustments ?? []);
  const [date, setDate] = useState(() => todayStr());
  const [teachingDate, setTeachingDate] = useState(() => todayStr());
  const duplicate = items.some(a => a.date === date);
  const valid = date !== teachingDate && !duplicate;
  return (
    <Page>
      <div className="flex-1 overflow-y-auto px-5 pb-6 scrollbar-none">
        <TopBar title="调休安排" onBack={onBack} />
        <div className="mt-5 rounded-2xl bg-(--c-amber-soft) px-4 py-4">
          <div className="text-[14px] font-bold text-(--c-ink)">补课日期 → 课表日期</div>
          <div className="mt-1 text-[12.5px] font-medium leading-relaxed text-(--c-ink3)">例：10月10日 补 10月7日的课，补课日期选 10月10日，课表日期选 10月7日。</div>
        </div>
        <div className="mt-6 mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">新增安排</div>
        <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">
          <Field k="补课日期" sub="原本休息，实际要上课"><DateInput value={date} onChange={setDate} /></Field>
          <Field k="课表日期" sub="要补哪一天的课"><DateInput value={teachingDate} onChange={setTeachingDate} /></Field>
        </div>
        <div className="mt-3 px-1 text-[12.5px] font-medium text-(--c-ink4)">{valid ? `${md(date)} 上 ${md(teachingDate)} ${WEEKDAYS[weekdayOf(teachingDate)]}的课` : duplicate ? "补课日期已有安排" : "选择两个不同的日期"}</div>
        <div className="mt-5"><PrimaryButton disabled={!valid} onClick={() => { setItems(xs => [...xs, { id: uid(), date, teachingDate, createdAt: Date.now() }].sort((a, b) => a.date.localeCompare(b.date))); }}>添加安排</PrimaryButton></div>
        {items.length > 0 && (
          <>
            <div className="mt-7 mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">已设置</div>
            <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">{items.map(a => <Row key={a.id} title={`${md(a.date)} 补课`} desc={`上 ${md(a.teachingDate)} ${WEEKDAYS[weekdayOf(a.teachingDate)]}的课`} onClick={() => setItems(xs => xs.filter(x => x.id !== a.id))} right={<span className="text-(--c-danger)">删除</span>} />)}</div>
          </>
        )}
      </div>
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]"><PrimaryButton onClick={() => { store.setSemester({ ...store.state.semester!, scheduleAdjustments: items }); onBack(); }}>保存</PrimaryButton></div>
    </Page>
  );
}

/* 新学期：当前学期连课表封存进往期，作息、待办、偏好带到新学期，完成后直接进导入 */
export function NewSemesterPage({ sem, onBack, onDone }: { sem: Semester; onBack: () => void; onDone: () => void }) {
  const state = useStore();
  const [date, setDate] = useState(() => mondayOf(todayStr()));
  const start = mondayOf(date);
  const [name, setName] = useState(() => guessSemesterName(start));
  const [named, setNamed] = useState(false);
  const [weeks, setWeeks] = useState(sem.totalWeeks);
  const shown = named ? name : guessSemesterName(start);
  const keep = state.courses.length > 0 || state.entries.length > 0;
  const live = liveCount({ ...state, semester: sem });

  return (
    <SubPage title="新学期" sub={keep ? `${sem.name} 移入往期，${live} 门课；作息与待办将会保留` : "作息与待办将会保留"} onBack={onBack}>
      <div className="divide-y divide-(--c-surface2) overflow-hidden rounded-2xl bg-(--c-surface)">
        <Field k="名称"><TextInput value={shown} onChange={(e) => { setNamed(true); setName(e.target.value); }} /></Field>
        <Field k="开学" sub={`第 1 周 ${md(start)} 周一`}><DateInput value={date} onChange={setDate} /></Field>
        <Field k="总周数"><TextInput type="number" min={1} max={64} value={weeks} onChange={e => setWeeks(Number(e.target.value))} /></Field>
      </div>

      <div className="mt-8">
        <PrimaryButton
          onClick={() => {
            store.startSemester({
              ...sem,
              id: uid(),
              name: shown.trim() || guessSemesterName(start),
              startDate: start,
              totalWeeks: Math.min(64, Math.max(1, weeks)),
              vacations: [],
              examWeeks: [],
            });
            store.setPrefs({ dateSet: true });
            void syncWidgets();
            onDone();
          }}
        >
          开始新学期
        </PrimaryButton>
      </div>
    </SubPage>
  );
}
