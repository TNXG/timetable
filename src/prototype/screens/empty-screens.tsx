import React from 'react'
import { C, Phone, Nav, DateStrip, TopBar, EmptyBlock } from '../shared'

/* ---------------- empty & error states ---------------- */


export function FreeDayScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">10月18日 <span className="font-bold text-(--c-ink4)">周六</span></h1>
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] font-semibold text-(--c-ink3)">
            <span>第 7 周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span>单周</span>
            <span className="h-3 w-px bg-(--c-line)" />
            <span className="text-(--c-ink4)">没有课</span>
          </div>
        </div>
        <EmptyBlock
          className="mt-14 px-8"
          kind="free"
          title="今天没有课，好耶"
          desc="周末到了，不如去做点感兴趣的事，出去走走。"
          actions={['本周课表', '待办']}
        />

        <div className="mt-10 px-5">
          <div className="px-1 text-[12px] font-bold tracking-[-.01em] text-(--c-ink4)">下一节</div>
          <div className="mt-2 flex items-center rounded-[16px] bg-(--c-surface) px-4 py-3.5">
            <div className="w-[46px] flex-none">
              <div className="text-[13px] font-extrabold tabular-nums text-(--c-ink)">08:00</div>
              <div className="mt-0.5 text-[11px] font-medium tabular-nums text-(--c-ink5)">09:40</div>
            </div>
            <i className="mr-3.5 h-[34px] w-[3px] flex-none rounded-full" style={{ background: C.eng }} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold tracking-[-.01em] text-(--c-ink)">大学英语（三）</div>
              <div className="mt-[3px] text-[11.5px] font-medium text-(--c-ink3)">外语楼 105，陈晓</div>
            </div>
            <span className="ml-2 flex-none text-[11.5px] font-semibold text-(--c-ink4)">周一</span>
          </div>
        </div>
      </div>
      <DateStrip active={5} />
      <Nav active={0} />
    </Phone>
  )
}

export function NoDataScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden pt-12">
        <div className="px-5">
          <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-(--c-ink)">10月14日 <span className="font-bold text-(--c-ink4)">周二</span></h1>
          <div className="mt-2 text-[12.5px] font-semibold text-(--c-ink4)">暂无课表</div>
        </div>
        <EmptyBlock
          className="mt-24 px-8"
          kind="none"
          title="让课表就位"
          desc="一键导入，或是手动创建。随后的日程追踪与准时提醒，皆会为你准备就绪。"
          actions={['导入课表', '手动添加']}
        />
      </div>
      <Nav active={0} />
    </Phone>
  )
}

export const failedRows: [string, string][] = [
  ['高等数学（下）', '周次写成 2-16双，规则没认出来'],
  ['大学体育（羽毛球）', '这门课没有节次'],
  ['形势与政策', '一行里写了两个上课时间'],
]

export function PartialFailScreen() {
  return (
    <Phone>
      <div className="flex-1 overflow-hidden px-5 pt-12">
        <TopBar title="3 门课导入失败" sub="其余 18 门已导入，失败的可稍后重试。" />

        <div className="mt-6 rounded-[16px] bg-(--c-surface) px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13.5px] font-bold text-(--c-ink)">正方教务 通用规则 v2.3</span>
            <span className="text-[11.5px] font-semibold tabular-nums text-(--c-ink4)">用时 6 秒</span>
          </div>
          <div className="mt-3 flex h-[3px] overflow-hidden rounded-full bg-(--c-surface2)">
            <i className="block h-full" style={{ width: '86%', background: '#4F5BD5' }} />
            <i className="block h-full" style={{ width: '14%', background: '#E8C39A' }} />
          </div>
          <div className="mt-2.5 flex items-baseline gap-4 text-[11.5px] font-semibold tabular-nums">
            <span className="text-(--c-accent)">成功 18 门</span>
            <span className="text-(--c-amber)">失败 3 门</span>
          </div>
        </div>

        <div className="mt-5 text-[12.5px] font-semibold text-(--c-ink3)">失败的课</div>
        <div className="mt-2.5 space-y-2">
          {failedRows.map(([name, why]) => (
            <div key={name} className="rounded-[12px] bg-(--c-surface) px-3.5 py-3">
              <div className="text-[13.5px] font-bold tracking-[-.01em] text-(--c-ink)">{name}</div>
              <div className="mt-1 text-[12px] font-medium text-(--c-ink3)">{why}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end px-1">
          <span className="text-[13px] font-bold text-(--c-accent)">手动添加</span>
        </div>
      </div>
      <Nav active={1} />
    </Phone>
  )
}
