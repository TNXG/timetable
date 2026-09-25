/**
 * 验证码判定：本地 OCR 出的文本 → 算式答案。
 *
 * 这批验证码固定是「一两位数的加减法」后面跟「=?」：只认 = 前面的算式并自行计算，
 * = 后面（问号被误读成的数字、箭头等）一律当装饰，绝不参与匹配；
 * 模型把 = 读丢时（如 "13x192"）退回整串。= 前找不到合法算式就判失败给 null，
 * 上层换一张验证码重试，而不是拿不准的答案去提交。
 * 域约束兜住误读：操作数只认 1..19、结果只认 0..38，取最长的算式（并列取最左）。
 */

/** 模型在这套字体上常看错的字符：乘法样子的其实是加号，破折号样子的其实是减号 */
const CONFUSABLE: Record<string, string> = {
  x: '+', X: '+', '×': '+', '＊': '+', '*': '+', '十': '+', '＋': '+',
  '一': '-', '－': '-', '—': '-',
  q: '?', Q: '?', '﹖': '?', '？': '?',
}

const PATTERN = /(\d{1,2})([+-])(\d{1,2})/g
const OPERAND_MIN = 1
const OPERAND_MAX = 19
const ANSWER_MIN = 0
const ANSWER_MAX = 38

export function captchaAnswer(text: string): string | null {
  let clean = ''
  for (const ch of text) {
    const mapped = CONFUSABLE[ch] ?? ch
    if (/[0-9+\-=?]/.test(mapped)) clean += mapped
  }
  const at = clean.indexOf('=')
  return pick(at >= 0 ? clean.slice(0, at) : clean)
}

/** 在 = 前的文本里找合法算式：非重叠、取最长（并列取最左） */
function pick(s: string): string | null {
  let best: string | null = null
  let bestLen = 0
  for (const m of s.matchAll(PATTERN)) {
    const a = Number(m[1])
    const b = Number(m[3])
    if (a < OPERAND_MIN || a > OPERAND_MAX || b < OPERAND_MIN || b > OPERAND_MAX) continue
    const v = m[2] === '+' ? a + b : a - b
    if (v < ANSWER_MIN || v > ANSWER_MAX) continue
    if (m[0].length > bestLen) {
      bestLen = m[0].length
      best = String(v)
    }
  }
  return best
}
