import React from 'react'
import {
  TodayScreen,
  CalendarSheet,
  WeekScreen,
  DetailScreen,
  AddScreen,
  LinkScreen,
  AiRuleScreen,
  EduBrowserScreen,
  EduTermSheet,
  EduPreviewScreen,
  EduFailScreen,
  TodoScreen,
  Todo2Screen,
  Todo2ComposeScreen,
  Todo2CameraScreen,
  Todo2PickerScreen,
  Todo2ReviewScreen,
  Todo2DetailScreen,
  Todo2EmptyScreen,
  SearchEmptyScreen,
  Todo2ClassEndScreen,
  MeScreen,
  ProfileScreen,
  StatsScreen,
  EraseScreen,
  AboutScreen,
  LockScreen,
  NotifPrefScreen,
  ScheduleScreen,
  ScheduleTimeSheet,
  OnboardScheduleScreen,
  CalendarIntroScreen,
  WidgetScreen,
  WidgetScreen2,
  FreeDayScreen,
  NoDataScreen,
  PartialFailScreen,
  ConflictScreen,
  ChangeScreen,
  OutOfTermScreen,
  VacationScreen,
  ExamWeekScreen,
  EditSessionScreen,
  ManualAddScreen,
  SearchScreen,
  LongPressScreen,
} from './prototype'

const screens: [string, string, () => React.ReactElement][] = [
  ['today', '今天', () => <TodayScreen />],
  ['today-cal', '今天 · 日期选择', () => <TodayScreen overlay={<CalendarSheet mode="day" />} />],
  ['week', '本周课表', () => <WeekScreen />],
  ['week-cal', '本周 · 周次选择', () => <WeekScreen overlay={<CalendarSheet mode="week" />} />],
  ['detail', '课程详情', () => <DetailScreen />],
  ['add', '规则导入', () => <AddScreen />],
  ['link', '链接添加规则', () => <LinkScreen />],
  ['airule', 'AI 生成规则', () => <AiRuleScreen />],
  ['edu-browser', '教务导入 · 登录', () => <EduBrowserScreen ready={false} />],
  ['edu-browser-table', '教务导入 · 课表页', () => <EduBrowserScreen />],
  ['edu-term', '教务导入 · 选学期', () => <EduBrowserScreen overlay={<EduTermSheet />} />],
  ['edu-preview', '教务导入 · 预览', () => <EduPreviewScreen />],
  ['edu-fail', '教务导入 · 未识别', () => <EduFailScreen />],
  ['todo', '待办', () => <TodoScreen />],
  ['todo2', '待办 · 重做', () => <Todo2Screen />],
  ['todo2-compose', '待办 · 写一句', () => <Todo2ComposeScreen />],
  ['todo2-camera', '待办 · 拍板书', () => <Todo2CameraScreen />],
  ['todo2-picker', '待办 · 相册', () => <Todo2PickerScreen />],
  ['todo2-review', '待办 · 拍完', () => <Todo2ReviewScreen />],
  ['todo2-detail', '待办 · 详情', () => <Todo2DetailScreen />],
  ['todo2-empty', '待办 · 空', () => <Todo2EmptyScreen />],
  ['search-empty', '搜索 · 空', () => <SearchEmptyScreen />],
  ['detail-todo', '课程详情 · 作业与备忘', () => <DetailScreen tall />],
  ['todo2-classend', '今天 · 刚下课', () => <Todo2ClassEndScreen />],
  ['me', '我的', () => <MeScreen />],
  ['profile', '个人资料', () => <ProfileScreen />],
  ['stats', '统计', () => <StatsScreen />],
  ['erase', '清除数据', () => <EraseScreen />],
  ['about', '关于', () => <AboutScreen />],
  ['lock', '锁屏', () => <LockScreen />],
  ['notif', '提醒', () => <NotifPrefScreen />],
  ['schedule', '作息时间', () => <ScheduleScreen />],
  ['schedule-time', '作息时间 · 改开始', () => <ScheduleScreen overlay={<ScheduleTimeSheet />} />],
  ['onboard-schedule', '引导 · 作息时间', () => <OnboardScheduleScreen />],
  ['calendar-intro', '同步至系统日历', () => <CalendarIntroScreen />],
  ['widget', '桌面小组件', () => <WidgetScreen />],
  ['widget2', '小组件样式', () => <WidgetScreen2 />],
  ['freeday', '今天没有课', () => <FreeDayScreen />],
  ['nodata', '还没有课表', () => <NoDataScreen />],
  ['partialfail', '部分导入失败', () => <PartialFailScreen />],
  ['conflict', '课程冲突', () => <ConflictScreen />],
  ['conflict-pick', '冲突 · 只留一门', () => <ConflictScreen mode="pick" />],
  ['change', '调课差异', () => <ChangeScreen />],
  ['outofterm', '超出学期', () => <OutOfTermScreen />],
  ['vacation', '假期周', () => <VacationScreen />],
  ['examweek', '考试周', () => <ExamWeekScreen />],
  ['edit', '编辑课程', () => <EditSessionScreen />],
  ['manualadd', '手动添加', () => <ManualAddScreen />],
  ['search', '搜索', () => <SearchScreen />],
  ['longpress', '长按菜单', () => <LongPressScreen />],
]

export default function App() {
  const one = new URLSearchParams(window.location.search).get('s')
  if (one) {
    const hit = screens.find(([k]) => k === one)
    return <div className="p-0">{hit ? hit[2]() : null}</div>
  }
  const q = new URLSearchParams(window.location.search)
  const zoom = Number(q.get('z') || 1)
  const g = Number(q.get('g') || 0)
  const batch = g ? screens.slice((g - 1) * 5, g * 5) : screens
  return (
    <div className="flex w-max items-start gap-9 p-10" style={{ zoom }}>
      {batch.map(([k, , render]) => (
        <div key={k} className="flex w-[375px] flex-none flex-col">{render()}</div>
      ))}
    </div>
  )
}
