/** 跨日与对时：定时、页面可见、回前台时重算 */
import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { nowMinutes, todayStr } from '../semester'

/** 当前日期：定时、回前台、页面可见时重算，跨零点后自动变化 */
export function useToday(): string {
  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    const check = () => setToday((t) => { const n = todayStr(); return n === t ? t : n })
    const timer = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    const onResume = CapApp.addListener('resume', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      void onResume.then((h) => h.remove())
    }
  }, [])
  return today
}

/** 当前时刻（分）：每 30s 一次，回前台立即对时 */
export function useNowMinutes(): number {
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const check = () => setNow(nowMinutes())
    const timer = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    const onResume = CapApp.addListener('resume', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      void onResume.then((h) => h.remove())
    }
  }, [])
  return now
}
