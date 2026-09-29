import type { Snapshot } from "../../domain/engine";
import type { SemesterArchive } from "../../domain/store";
import type { ScheduleAdjustment, Semester } from "../../domain/types";
/** 学期：设置、新学期、往期、分享选学期、教务自动更新 */
import { useRef, useState } from "react";
import RefreshLine from "~icons/mingcute/refresh-1-line";
import RightLine from "~icons/mingcute/right-line";
import { weekdayOf } from "../../domain/dates";
import { termLabel } from "../../domain/edu/zhengfang";
import { holidaysBetween } from "../../domain/holidays";
import { uid } from "../../domain/store";
import { eduSyncing, logoutEduSync, outcomeText, setEduSyncEnabled, statusText, syncNow, useEduSync } from "../edu-sync";
import { shareIcs } from "../files";
import { currentWeek } from "../Onboarding";
import { guessSemesterName, mondayOf, semesterEnded, termEnd, todayStr } from "../semester";
import { store, useStore } from "../store";
import { DateInput, Field, Loader, md, Page, PrimaryButton, RadioRow, Row, Sheet, SheetClose, SheetHead, SubPage, Switch, TextInput, TopBar } from "../ui";
import { haptic, nativeConfirm, nativeToast, syncWidgets } from "../widgets";

const WEEKDAYS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const liveCount = (s: Snapshot) => s.courses.filter(c => !c.hidden && !c.removedByImport).length;

/* 选学期：和教务导入的「导入哪个学期？」同一套单选样式，第一项默认选中 */
export function SemesterPickSheet({ title, action, options, onPick, onClose }: {
  title: string;
  action: string;
  options: Snapshot[];
  onPick: (s: Snapshot) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(0);
  const dismissRef = useRef<(() => void) | null>(null);
  return (
    <Sheet
      onClose={onClose}
      dismissRef={dismissRef}
      className="px-5 pb-1"
      header={<SheetHead title={title} trail={<SheetClose onClick={() => dismissRef.current?.()} />} />}
      footer={<div className="px-5 pt-2"><PrimaryButton onClick={() => { onPick(options[sel]); dismissRef.current?.(); }}>{action}</PrimaryButton></div>}
    >
      <div className="space-y-2 pt-1">
        {options.map((s, i) => {
          const on = i === sel;
          return (
            <RadioRow
              key={s.semester.id}
              on={on}
              onClick={() => { haptic("selection"); setSel(i); }}
              right={i === 0 ? "当前" : `${liveCount(s)} 门课`}
            >
              {s.semester.name}
            </RadioRow>
          );
        })}
      </div>
    </Sheet>
  );
}

/* 往期学期：只读内页，课程列表、底部分享；删除走和规则页一样的红色行 */
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
      <div className="flex-none px-5 pt-2 pb-[max(22px,env(safe-area-inset-bottom))]">
        <PrimaryButton onClick={() => void shareIcs(a)}>分享课表</PrimaryButton>
      </div>
    </Page>
  );
}

/** 教务账号卡：点卡片检查课表，左滑退出；自动更新只控制后台检查。 */
export function EduSyncGroup({ onLogin, heading = true }: { onLogin: () => void; heading?: boolean }) {
  const s = useEduSync();
  const [busy, setBusy] = useState(eduSyncing);
  const [revealed, setRevealed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const touchXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  if (!s)
    return null;
  const status = statusText(s);
  const expired = s.lastResult === "expired";
  const update = async () => {
    if (busy || loggingOut)
      return;
    setBusy(true);
    try {
      const o = await syncNow();
      if (o.result === "expired") {
        onLogin();
        return;
      }
      haptic(o.result === "ok" || o.result === "nochange" ? "success" : "error");
      nativeToast(outcomeText(o));
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (loggingOut)
      return;
    const ok = await nativeConfirm({ title: "退出登录", message: `清除${s.school.name}的登录会话及保存的密码`, ok: "退出" });
    if (!ok)
      return;
    setLoggingOut(true);
    try {
      await logoutEduSync();
      haptic("warning");
      nativeToast("已退出登录");
    } catch (e) {
      nativeToast(e instanceof Error ? e.message : "退出登录失败");
    } finally {
      setLoggingOut(false);
    }
  };
  return (
    <div className={heading ? "mt-7" : "mt-6"}>
      {heading && <div className="mb-2 px-1 text-[12.5px] font-semibold text-(--c-ink4)">教务账号</div>}
      <div className="relative overflow-hidden rounded-[18px] bg-(--c-surface)">
        <button
          type="button"
          onClick={() => void logout()}
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-(--c-danger) text-[13px] font-bold text-white"
        >
          退出登录
        </button>
        <div
          className="relative bg-(--c-surface) transition-transform duration-200"
          style={{ transform: revealed ? "translateX(-96px)" : "translateX(0)" }}
          onTouchStart={(e) => { touchXRef.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchXRef.current === null)
              return;
            const dx = e.changedTouches[0].clientX - touchXRef.current;
            touchXRef.current = null;
            if (Math.abs(dx) > 35) {
              suppressClickRef.current = true;
              setRevealed(dx < 0);
            }
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              if (revealed) { setRevealed(false); return; }
              if (expired)
                onLogin();
              else void update();
            }}
            aria-label={`${s.school.name}，${status.text}，${expired ? "重新登录" : "检查课表"}`}
            className="flex w-full items-start gap-3 px-4 pt-4 pb-3 text-left transition-colors active:bg-(--c-surface2)"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-(--c-ink)">{s.school.name}</div>
              {s.term && <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">{termLabel(s.term)}</div>}
              <div className={`mt-2 text-[12.5px] font-medium ${status.danger || s.lastResult === "error" ? "text-(--c-danger)" : "text-(--c-ink3)"}`}>{status.text}</div>
              {(s.lastResult === "error" || expired) && s.lastMessage && <div className="mt-1 text-[11.5px] font-medium text-(--c-danger)">{s.lastMessage}</div>}
            </div>
            <div className="flex flex-none items-center gap-1 pt-0.5 text-[12px] font-semibold text-(--c-accent)">
              {busy
                ? <Loader size={17} />
                : expired
                  ? (
                      <>
                        重新登录
                        <RightLine width={15} height={15} />
                      </>
                    )
                  : (
                      <>
                        检查课表
                        <RefreshLine width={15} height={15} />
                      </>
                    )}
            </div>
          </button>
          <div className="mx-4 flex items-center border-t border-(--c-surface2) py-3">
            <span className="min-w-0 flex-1 text-[12.5px] font-medium text-(--c-ink3)">{busy ? "正在更新课表" : "自动更新课表"}</span>
            <Switch on={s.enabled} onChange={setEduSyncEnabled} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SemesterSettings({ sem, onBack, onNew, onArchive, onLogin, onAdjustments }: { sem: Semester; onBack: () => void; onNew: () => void; onArchive: (id: string) => void; onLogin: () => void; onAdjustments: () => void }) {
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
      <EduSyncGroup onLogin={onLogin} />
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
