import BookmarkFill from "~icons/mingcute/bookmark-fill";
import CopyLine from "~icons/mingcute/copy-line";
import LoadingLine from "~icons/mingcute/loading-3-line";
import PhoneLine from "~icons/mingcute/phone-line";
import LeftLine from "~icons/mingcute/left-line";
import RightLine from "~icons/mingcute/right-line";
import React from "react";
import { Sticker, stickerTilt } from "../../app/Sticker";
import { Board, C, CameraIcon, Card, Nav, Phone, tint, TopBar } from "../shared";
import { WEEK_COLS } from "./today-week";

/* ---------------- 03 detail ---------------- */

/** 出勤条：第 N 次课 + 状态（1 出勤 / 0 缺勤 / 2 未上） */
const ATTENDANCE = [1, 1, 1, 0, 1, 1, 1, 2, 2].map((v, i) => ({ id: i + 1, v }));

export function DetailScreen({ tall }: { tall?: boolean }) {
  const phoneLink = (
    <a key="p" href="tel:13845214521" className="inline-flex items-center gap-1 font-semibold text-(--c-accent)">
      138
      <span>****</span>
      {" "}
      4521
      <PhoneLine width="12" height="12" aria-hidden="true" />
    </a>
  );
  return (
    <Phone tall={tall}>
      <div className={`flex-1 space-y-3 px-4 pt-12 ${tall ? "" : "overflow-hidden"}`}>
        <div className="flex items-center justify-between px-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--c-surface)">
            <LeftLine width="15" height="15" style={{ color: "var(--c-ink)" }}  />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--c-surface)">
            <BookmarkFill width="16" height="16" style={{ color: "#6D78D6" }} />
          </div>
        </div>

        <Card className="relative">
          <Sticker id="math-calc" size={74} tilt={stickerTilt("高等数学（下）")} className="absolute -top-4.5 -right-1.5" />
          <div className="pr-16 text-[22px] font-extrabold tracking-[-.01em] text-(--c-ink)">高等数学（下）</div>
          <div className="mt-1.5 text-[12.5px] font-medium text-(--c-ink3)">必修课，5 学分，9月2日 – 12月18日</div>
          <div className="mt-5">
            {([
              ["下次上课", "后天 08:00 – 09:40"],
              ["地点", "教学三楼 302"],
              ["老师", "王立群，数学学院"],
              ["教师电话", phoneLink],
              ["考核", "期末 60%，平时 40%"],
              ["提醒", "上课前 20 分钟"],
            ] as [string, React.ReactNode][]).map(([k, v], i) => (
              <div key={k} className={`flex items-baseline ${i > 0 ? "mt-4" : ""}`}>
                <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">{k}</span>
                <span className="text-[14px] font-semibold text-(--c-ink)">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="grid grid-cols-7 gap-1">
              {["一", "二", "三", "四", "五", "六", "日"].map((d, i) => {
                const on = i === 1 || i === 3;
                return (
                  <div key={d} className="flex flex-col items-center">
                    <span className={`text-[11px] font-bold ${i === 1 ? "text-(--c-accent)" : "text-(--c-ink4)"}`}>{d}</span>
                    <div
                      className={`mt-1.5 flex w-full flex-col items-center justify-center rounded-[10px] py-2 ${on ? "" : "bg-(--c-bg)"}`}
                      style={on ? { background: "color-mix(in srgb, #5B6CFF 22%, var(--c-surface))", minHeight: 46 } : { minHeight: 46 }}
                    >
                      {on
                        ? (
                            <span className="flex flex-col items-center text-[10.5px] font-bold leading-[1.35] tabular-nums text-(--c-ink)">
                              <span>08:00</span>
                              <span className="text-(--c-ink4)">09:40</span>
                            </span>
                          )
                        : <span className="text-[11px] font-medium text-(--c-ink5)">–</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline">
            <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">学期进度</span>
            <span className="text-[14px] font-semibold tabular-nums text-(--c-ink)">13 / 64 课时</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-(--c-surface2)">
            <i className="block h-full w-[20.3%] rounded-full bg-(--c-accent)" />
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="w-18 flex-none text-[13px] font-medium text-(--c-ink4)">出勤</span>
            <span className="text-[14px] font-semibold tabular-nums text-(--c-ink)">6 / 7，出勤率 86%</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {ATTENDANCE.map(({ id, v }) => (
              <div key={id} className={`h-1 flex-1 rounded-full ${v === 1 ? "bg-(--c-accent)" : v === 0 ? "bg-(--c-ink5b)" : "bg-(--c-surface2)"}`} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-(--c-ink)">作业与备忘</span>
            <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">3 项</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center rounded-[14px] bg-(--c-bg) p-2.5">
              <div className="mr-3 h-11 w-14.5 flex-none overflow-hidden rounded-[9px]"><Board className="h-full w-full" zoom={0.28} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-(--c-ink)">板书</div>
                <div className="mt-0.75 text-[11.5px] font-medium text-(--c-ink4)">今天 09:38 拍下</div>
              </div>
              <span className="ml-2 flex h-6.5 flex-none items-center rounded-full bg-(--c-accent-soft) px-2.5 text-[11px] font-bold text-(--c-accent)">周四 课前</span>
            </div>
            <div className="flex items-center rounded-[14px] bg-(--c-bg) px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-(--c-ink)">习题册 P41–P45 第 3、5、7 题</div>
                <div className="mt-0.75 text-[11.5px] font-medium text-(--c-ink4)">作业，纸质提交</div>
              </div>
              <span className="ml-2 flex h-6.5 flex-none items-center rounded-full bg-(--c-accent-soft) px-2.5 text-[11px] font-bold text-(--c-accent)">今晚 23:00</span>
            </div>
            <div className="flex items-center rounded-[14px] bg-(--c-bg) px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-(--c-ink)">期中考试 1–5 章</div>
                <div className="mt-0.75 text-[11.5px] font-medium text-(--c-ink4)">考试，可带计算器</div>
              </div>
              <span className="ml-2 flex-none text-[11.5px] font-semibold text-(--c-ink4)">第 9 周</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-(--c-bg) p-1.25 pr-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--c-surface)">
              <CameraIcon size={16} />
            </span>
            <span className="flex-1 pl-1 text-[14px] font-medium text-(--c-ink4)">点击添加新待办</span>
          </div>
        </Card>
      </div>
    </Phone>
  );
}

/* ---------------- 04 add course ---------------- */

export interface Rule {
  name: string;
  meta: string;
  tag?: string;
  running?: boolean;
  progress?: string;
  pct?: number;
}

export const myRules: Rule[] = [
  { name: "正方教务 通用规则", meta: "v2.3，链接添加，上周更新", tag: "上次用", running: true, progress: "正在解析，已识别 18 门课", pct: 62 },
  { name: "教务导出 xlsx", meta: "v1.4，AI 生成，读取本地文件" },
  { name: "雨课堂 课程同步", meta: "v0.9，链接添加，需要登录一次" },
];

export const ruleSources: [string, string][] = [
  ["从链接添加", "粘贴规则链接或分享码"],
  ["让 AI 生成规则", "复制 Prompt，AI 写好后粘贴即可"],
];

export function AddScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <div className="flex items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--c-surface)">
            <LeftLine width="14" height="14" style={{ color: "var(--c-ink)" }}  />
          </div>
        </div>
        <h1 className="mt-4 text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">导入课表</h1>
        <div className="mt-1.5 text-[13px] font-medium text-(--c-ink4)">选一条规则，选中就开始解析导入</div>

        <div className="mt-6 text-[12.5px] font-semibold text-(--c-ink3)">我的规则</div>
        <div className="mt-2.5 overflow-hidden rounded-2xl bg-(--c-surface)">
          {myRules.map((r, i) => (
            <div key={r.name} className={`px-4 py-3.5 ${i > 0 ? "border-t border-(--c-surface2)" : ""}`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[14.5px] font-bold ${r.running ? "text-(--c-accent)" : "text-(--c-ink)"}`}>{r.name}</span>
                    {r.tag && !r.running && <span className="rounded-md bg-(--c-surface2) px-1.5 py-0.5 text-[10px] font-bold text-(--c-ink3)">{r.tag}</span>}
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-(--c-ink4)">{r.running ? r.progress : r.meta}</div>
                </div>
                {r.running
                  ? (
                      <LoadingLine className="ml-3 h-3.75 w-3.75 flex-none animate-spin text-[#4F5BD5]" />
                    )
                  : (
                      <RightLine width="13" height="13" style={{ color: "var(--c-ink5)" }} className="ml-3 flex-none" />
                    )}
              </div>
              {r.running && (
                <div className="mt-3 h-0.75 overflow-hidden rounded-full bg-(--c-accent-soft)">
                  <i className="block h-full rounded-full bg-(--c-accent)" style={{ width: `${r.pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 text-[12.5px] font-semibold text-(--c-ink3)">添加新规则</div>
        <div className="mt-2.5 overflow-hidden rounded-2xl bg-(--c-surface)">
          {ruleSources.map(([t, d], i) => (
            <div key={t} className={`flex items-center px-4 py-3.5 ${i > 0 ? "border-t border-(--c-surface2)" : ""}`}>
              <div className="flex-1">
                <div className="text-[14px] font-bold text-(--c-ink)">{t}</div>
                <div className="mt-0.5 text-[12px] font-medium text-(--c-ink4)">{d}</div>
              </div>
              <RightLine width="13" height="13" style={{ color: "var(--c-ink5)" }} className="flex-none" />
            </div>
          ))}
        </div>

        <div className="mt-5 px-1 text-[11.5px] leading-normal font-medium text-(--c-ink4b)">
          上次导入 21 门课，9月1日，用时 6 秒。
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  );
}

/* ---------------- 05 add rule from link ---------------- */

export const parsed = [
  { name: "高等数学（下）", when: "周二 3–4 节", loc: "教学三楼 302", teacher: "王立群", weeks: "1–16 周", color: C.math },
  { name: "大学英语（三）", when: "周一 1–2 节", loc: "外语楼 105", teacher: "陈晓", weeks: "1–16 周", color: C.eng },
  { name: "数据结构", when: "周二 5–6 节", loc: "教学一楼 201", teacher: "李慕华", weeks: "1–14 周", color: C.ds },
  { name: "大学物理", when: "周三 5–6 节", loc: "理科楼 A203", teacher: "周敏", weeks: "2–16 双周", color: C.phy },
  { name: "线性代数", when: "周四 5–6 节", loc: "教学三楼 110", teacher: "赵一鸣", weeks: "1–12 周", color: C.la },
];

export function LinkScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="从链接添加" sub="粘贴规则链接或分享码" />

        <div className="mt-6 rounded-2xl bg-(--c-surface) px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-(--c-ink4)">规则链接</span>
            <span className="text-[13px] font-bold text-(--c-accent)">粘贴</span>
          </div>
          <div className="mt-2 font-mono text-[12.5px] leading-normal break-all text-(--c-ink)">
            lexicon://rule/zfjw-generic?v=2.3
            <i className="ml-px inline-block h-3.75 w-[1.5px] translate-y-0.5 bg-(--c-accent)" />
          </div>
        </div>

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">解析出 18 门课</div>

        {/* 文件自带节次表且与当前不同：默认采用（当前仍是出厂作息时），用户改过的作息不自动覆盖 */}
        <div className="mt-2.5 flex items-center rounded-2xl bg-(--c-surface) px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-(--c-ink)">采用文件里的作息时间</div>
            <div className="mt-0.5 truncate text-[12px] font-medium tabular-nums text-(--c-ink4)">12 节 08:00–22:10，当前 10 节</div>
          </div>
          <span className="relative h-6.5 w-11 flex-none rounded-full bg-(--c-accent)"><i className="absolute top-0.75 right-0.75 h-5 w-5 rounded-full bg-white" /></span>
        </div>

        <div className="mt-2.5 rounded-2xl bg-(--c-surface) px-3 pt-2.5 pb-3">
          <div className="flex gap-1">
            {["一", "二", "三", "四", "五", "六"].map(w => (
              <div key={w} className="flex-1 text-center text-[9.5px] font-semibold text-(--c-ink4)">{w}</div>
            ))}
          </div>
          <div className="relative mt-1.5 flex h-38 gap-1">
            {[0, 50, 100].map(t => (
              <div key={t} className="absolute inset-x-0 h-px bg-(--c-line2)" style={{ top: t + 48 }} />
            ))}
            {WEEK_COLS.map(([wd, col]) => (
              <div key={wd} className="relative flex-1">
                {col.map(ev => (
                  <div
                    key={ev.name + ev.top}
                    className="absolute inset-x-0 overflow-hidden rounded-[5px] px-1 py-0.75 text-[7.5px] leading-tight font-bold"
                    style={{ top: ev.top * 0.28, height: ev.h * 0.28, background: tint(ev.color, 14), color: `color-mix(in srgb, ${ev.color} 88%, var(--c-ink-mix))` }}
                  >
                    {ev.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {parsed.slice(0, 2).map(p => (
            <div key={p.name} className="flex items-center overflow-hidden rounded-xl pr-3.5" style={{ background: tint(p.color, 7) }}>
              <i className="mr-3 h-10.5 w-0.75 flex-none rounded-full" style={{ background: p.color }} />
              <div className="flex-1 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-bold tracking-[-.01em] text-(--c-ink)">{p.name}</span>
                  <span className="ml-2 flex-none text-[11px] font-semibold tabular-nums text-(--c-ink3)">{p.weeks}</span>
                </div>
                <div className="mt-0.75 text-[11.5px] font-medium tabular-nums text-(--c-ink3)">
                  {p.when}
                  {" "}
                  {p.loc}
                  {" "}
                  {p.teacher}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end px-1">
          <span className="text-[13px] font-bold text-(--c-accent)">添加并导入</span>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  );
}

/* ---------------- 06 let AI write the rule ---------------- */

export const promptLines: [string, string][][] = [
  [["你是课表导入规则生成器。我会粘上我", "s"]],
  [["学校教务系统课表页面的内容（文字", "s"]],
  [["或截图），请输出一份 ", "s"], ["lexicon-rule", "k"], [" v1", "s"]],
  [["规则，要求：", "s"]],
  [["1. ", "p"], ["fields", "k"], [" 包含 ", "s"], ["name / time /", "k"]],
  [["   ", "p"], ["room / teacher / weeks", "k"]],
  [["2. 周次用正则，兼容「单双周」写法", "s"]],
  [["3. 只输出规则本体，不要解释", "s"]],
];

/** 预览行与词元都带字符偏移做 key（内容寻址，不用下标） */
export const promptRows = (() => {
  let at = 0;
  return promptLines.map((line) => {
    const key = at;
    const spans = line.map(([t, c]) => {
      const id = at;
      at += t.length;
      return { id, t, c };
    });
    at += 1;
    return { key, spans };
  });
})();

export function AiRuleScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="让 AI 生成规则" sub="复制这段 Prompt 交给任意 AI，写好后粘贴即可" />

        <div className="relative mt-6 rounded-2xl bg-(--c-surface) px-4 py-4">
          <div className="absolute top-3.5 right-4">
            <CopyLine width="14" height="14" className="text-(--c-ink2)" />
          </div>
          {promptRows.map(({ key, spans }) => (
            <div key={key} className="pr-8 font-mono text-[11.5px] leading-[1.95]">
              {spans.map(({ id, t, c }) => (
                <span key={id} className="whitespace-pre" style={{ color: c === "k" ? "var(--c-mono-key)" : c === "p" ? "var(--c-mono-punc)" : "var(--c-mono-ink)", fontWeight: c === "k" ? 700 : 500 }}>{t}</span>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-(--c-surface) px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-(--c-ink4)">AI 输出的规则</span>
            <span className="text-[13px] font-bold text-(--c-accent)">粘贴</span>
          </div>
          <div className="mt-2 font-mono text-[12.5px] leading-normal text-(--c-ink5)">在这里粘贴，或拖入 .rule 文件</div>
        </div>

        <div className="mt-4 rounded-2xl bg-(--c-surface) px-4 py-3.5 text-center">
          <span className="text-[13px] font-bold text-(--c-ink5)">解析并预览</span>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  );
}
