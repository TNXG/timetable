import React, { useLayoutEffect, useRef, useState } from "react";
import DownLine from "~icons/mingcute/down-line";
import { Sticker, stickerTilt } from "../../app/Sticker";
import { WeekAxis, WeekCard, WeekLines } from "../../app/week-axis";
import { stickerOf } from "../../domain/stickers";
import { buildAxis, CARD_INSET, rowHeights } from "../../domain/time-axis";
import { C, CourseRow, DateStrip, DayDivider, DayPicker, days, Nav, nowLabel, Phone, todayIndex } from "../shared";

/* ---------------- 01 today ---------------- */

export function TodayScreen({ overlay }: { overlay?: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<Record<string, HTMLDivElement>>({});
  const [active, setActive] = useState(todayIndex);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el)
      return;
    const base = el.getBoundingClientRect().top + 96;
    let cur = todayIndex;
    for (const d of days) {
      const node = marksRef.current[d.key];
      if (node && node.getBoundingClientRect().top <= base)
        cur = days.indexOf(d);
    }
    setActive(cur);
  };

  useLayoutEffect(() => {
    const m = location.hash.match(/^#scroll=(\d+)$/);
    if (m && scrollRef.current)
      scrollRef.current.scrollTop = Number(m[1]);
    /* 首帧先按初始状态渲染，下一帧再量一次：避免挂载后同帧改状态 */
    const raf = requestAnimationFrame(onScroll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visible = days.filter(d => d.courses.length > 0 && days.indexOf(d) >= todayIndex);

  return (
    <Phone>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto pt-12 pb-50 scrollbar-none">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">
            10月14日
            <span className="font-bold text-(--c-ink4)">周二</span>
          </h1>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>第 7 周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>单周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>
              4 节课
              <span className="text-(--c-ink4)">，剩 2 节</span>
            </span>
          </div>
        </div>

        <div className="mt-6 px-5">
          {visible.map((day, di) => (
            <div
              key={day.key}
              ref={(el) => {
                if (el)
                  marksRef.current[day.key] = el;
              }}
            >
              {di > 0 && <DayDivider day={day} />}
              {day.courses.map((c, ci) => (
                <CourseRow key={day.key + c.name + c.start} c={c} last={ci === day.courses.length - 1} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-7 h-50"
        style={{ background: "var(--c-fade)" }}
      />
      {!overlay && <DateStrip active={active} />}
      {overlay}
      <Nav active={0} />
    </Phone>
  );
}

/* ---------------- 02 week ---------------- */

/* top/h 是旧的按钟点排的坐标（导入预览等小图还在用）；p 是节次区间，周视图按节次轴排 */
export interface Ev { name: string; loc: string; color: string; top: number; h: number; p?: [number, number]; now?: boolean }
/** 七列的星期标识（周一…周日），渲染时当 key 用，不走下标 */
export const COL_WD = ["一", "二", "三", "四", "五", "六", "日"];
export const weekCols: Ev[][] = [
  [
    { name: "大学英语", loc: "外语楼105", color: C.eng, top: 0, h: 72, p: [1, 2] },
    { name: "高等数学", loc: "教三302", color: C.math, top: 84, h: 72, p: [3, 4] },
    { name: "短课演示", loc: "40分钟", color: C.pol, top: 252, h: 28, p: [5, 5] },
    { name: "思想道德", loc: "教二404", color: C.pol, top: 322, h: 72, p: [7, 8] },
  ],
  [
    { name: "大学英语", loc: "外语楼105", color: C.eng, top: 0, h: 72, p: [1, 2] },
    { name: "高等数学", loc: "上课中", color: C.math, top: 84, h: 72, p: [3, 4], now: true },
    { name: "数据结构", loc: "教一201", color: C.ds, top: 252, h: 72, p: [5, 6] },
    { name: "体育", loc: "东区馆", color: C.phy, top: 336, h: 72, p: [7, 8] },
    { name: "线代习题", loc: "教三110", color: C.la, top: 462, h: 72, p: [9, 10] },
  ],
  [
    { name: "数据结构", loc: "教一201", color: C.ds, top: 84, h: 72, p: [3, 4] },
    { name: "大学物理", loc: "理科楼A", color: C.phy, top: 252, h: 72, p: [5, 6] },
  ],
  [
    { name: "高等数学", loc: "教三302", color: C.math, top: 0, h: 72, p: [1, 2] },
    { name: "线性代数", loc: "教三110", color: C.la, top: 252, h: 72, p: [5, 6] },
    { name: "形势政策", loc: "教二404", color: C.pol, top: 336, h: 72, p: [7, 8] },
  ],
  [
    { name: "大学物理", loc: "理科楼A", color: C.phy, top: 0, h: 72, p: [1, 2] },
    { name: "数据结构", loc: "机房B2", color: C.ds, top: 84, h: 72, p: [3, 4] },
  ],
  [],
];

/** weekCols 配好星期标识，渲染 key 直接取 wd，不引用下标 */
export const WEEK_COLS: [string, Ev[]][] = weekCols.map((col, i) => [COL_WD[i], col]);

/* 默认作息：10 节，45 分钟一节 */
export const protoGrid = [480, 535, 600, 655, 840, 895, 960, 1015, 1140, 1195].map((s, i) => ({ index: i + 1, start: s, end: s + 45 }));
/* 375 宽样机下的列宽 */
export const PROTO_COL_W = 39;
export const weekAxis = buildAxis(
  protoGrid,
  undefined,
  rowHeights(
    protoGrid,
    weekCols.flat().filter(e => e.p).map(e => ({ start: protoGrid[e.p![0] - 1].start, end: protoGrid[e.p![1] - 1].end, name: e.name, loc: e.loc })),
    PROTO_COL_W,
  ),
);
export const nowMin = 11 * 60 + 2;

export function WeekScreen({ overlay }: { overlay?: React.ReactNode }) {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="flex items-center justify-between px-5">
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-.01em] text-(--c-ink)">
            第 7 周
            <DownLine width="13" height="13" style={{ color: "var(--c-ink4)" }} />
          </div>
          <div className="flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>单周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>秋季学期</span>
          </div>
        </div>

        <div className="mt-3.5 px-2">
          <div className="rounded-[22px] bg-(--c-surface) p-2.5 pb-4">
            <DayPicker
              active={todayIndex}
              lead={<div className="-mr-1.25 flex w-8 flex-none items-center justify-center text-[10.5px] font-semibold text-(--c-ink4)">10月</div>}
            />

            <div className="relative mt-2">
              <WeekLines axis={weekAxis} />
              <div className="flex pt-1.5">
                <WeekAxis axis={weekAxis} nowTop={weekAxis.y(nowMin)} nowLabel={nowLabel} />
                <div className="relative flex flex-1 gap-1.25" style={{ height: weekAxis.height }}>
                  {WEEK_COLS.map(([wd, col], i) => {
                    const pastCol = i < todayIndex;
                    const nowY = weekAxis.y(nowMin);
                    return (
                      <div key={wd} className={`relative flex-1 ${pastCol ? "opacity-45" : ""}`}>
                        {col.map((ev) => {
                          const [p0, p1] = ev.p ?? [1, 2];
                          const t0 = protoGrid[p0 - 1].start;
                          const t1 = p0 === p1 && ev.h < 40 ? t0 + 40 : protoGrid[p1 - 1].end;
                          const top = weekAxis.y(t0) + CARD_INSET;
                          const h = weekAxis.y(t1) - top - CARD_INSET;
                          const done = i < todayIndex || (i === todayIndex && t1 <= nowMin);
                          const sticker = h >= 44 ? stickerOf(ev.name) : null;
                          return (
                            <div key={ev.name + ev.top} className="absolute inset-x-0" style={{ top, height: h, opacity: done && !pastCol ? 0.55 : 1 }}>
                              <WeekCard name={ev.name} loc={ev.loc} color={ev.color} h={h} w={PROTO_COL_W} now={ev.now} done={done} progress={nowY - top} sticker={sticker} />
                              {sticker && (
                                <Sticker
                                  id={sticker}
                                  size={20}
                                  tilt={stickerTilt(ev.name)}
                                  className="pointer-events-none absolute -right-1.5 -bottom-1.5 z-10"
                                />
                              )}
                            </div>
                          );
                        })}
                        {i === todayIndex && (
                          <div className="pointer-events-none absolute -right-0.5 -left-0.5 z-20" style={{ top: nowY }}>
                            <i className="block h-[1.5px] w-full rounded-full bg-(--c-accent)" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {overlay}
      <Nav active={1} />
    </Phone>
  );
}
