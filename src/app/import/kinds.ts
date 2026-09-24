/** 规则输入类型的文案与占位提示 */
import type { RuleInputKind } from '../../domain/rules'

export const KIND_LABEL: Record<RuleInputKind, string> = { csv: 'CSV', json: 'JSON', html: 'HTML', xlsx: 'Excel', ics: '.ics 文件', script: '脚本' }
export const KIND_HINT: Record<RuleInputKind, string> = {
  csv: '课程,教师,地点,星期,节次,周次',
  json: '{"courses":[{"name":"高等数学","day":1,"startNode":1,"step":2,"weeks":"1-16"}]}',
  html: '粘贴教务课表页面的 HTML',
  xlsx: '选择教务导出的 .xlsx 文件',
  ics: 'BEGIN:VCALENDAR …',
  script: '粘贴要解析的文本',
}
