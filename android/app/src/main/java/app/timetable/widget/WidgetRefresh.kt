package app.timetable.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * 倒计时和「上课中」要跟着时间走：屏幕上有分钟倒计时时每分钟重画一次，
 * 否则只在下一个状态变化点（上课、下课、跨天）重画，兜底 15 分钟。
 * Android 12 起普通 set() 可能推迟到一小时后才送达，所以能用精确闹钟就用精确闹钟。
 */
class WidgetRefresh : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        BaseWidget.updateAll(ctx)
        schedule(ctx)
    }

    companion object {
        private const val ACTION = "app.timetable.WIDGET_REFRESH"
        private const val MINUTE = 60_000L

        private fun has(mgr: AppWidgetManager, ctx: Context, provider: Class<*>): Boolean {
            return mgr.getAppWidgetIds(ComponentName(ctx, provider)).size > 0
        }

        private fun anyWidget(mgr: AppWidgetManager, ctx: Context): Boolean {
            for (p in BaseWidget.PROVIDERS) if (has(mgr, ctx, p)) return true
            return false
        }

        /** 下一个整分钟的 0 秒，让「还剩 N 分」正好在分钟翻转时更新 */
        private fun nextMinute(now: Long): Long {
            return (now / MINUTE + 1) * MINUTE
        }

        /** 本地时间的下一个零点 */
        private fun nextMidnight(now: Long): Long {
            val c = Calendar.getInstance()
            c.timeInMillis = now
            c.add(Calendar.DAY_OF_MONTH, 1)
            c.set(Calendar.HOUR_OF_DAY, 0)
            c.set(Calendar.MINUTE, 0)
            c.set(Calendar.SECOND, 0)
            c.set(Calendar.MILLISECOND, 0)
            return c.timeInMillis
        }

        /** 下一次刷新时刻 */
        fun nextRefreshAt(data: WidgetStore.Data?, nextStyle: Boolean, now: Long): Long {
            var at = Math.min(now + 15 * MINUTE, nextMidnight(now))
            if (data == null) return at
            val today = WidgetStore.localDate(now)
            var ticking = false
            for (d in data.days) {
                if (d.date.compareTo(today) < 0) continue
                for (it in d.items) {
                    if (it.cancelled) continue
                    if (it.startAt <= now && now < it.endAt) ticking = true
                    if (it.startAt > now && it.startAt < at) at = it.startAt
                    if (it.endAt > now && it.endAt < at) at = it.endAt
                    /* 「下一节」样式在 24 小时内显示分钟数，每分钟都在变 */
                    if (nextStyle && it.startAt > now && it.startAt - now < 24 * 60 * MINUTE) ticking = true
                }
            }
            if (ticking) at = Math.min(at, nextMinute(now))
            return at
        }

        fun schedule(ctx: Context) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val pi = pending(ctx)
            val mgr = AppWidgetManager.getInstance(ctx)
            if (!anyWidget(mgr, ctx)) {
                am.cancel(pi)
                return
            }
            val now = System.currentTimeMillis()
            val at = Math.max(nextRefreshAt(WidgetStore.read(ctx), has(mgr, ctx, NextWidget::class.java), now), now + 1000L)
            val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
            try {
                if (exact) {
                    /* 不用 WAKEUP：屏幕熄着没人看，等设备醒来再补画 */
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC, at, pi)
                } else {
                    am.setWindow(AlarmManager.RTC, at, 10 * MINUTE, pi)
                }
            } catch (e: SecurityException) {
                am.setWindow(AlarmManager.RTC, at, 10 * MINUTE, pi)
            }
        }

        private fun pending(ctx: Context): PendingIntent {
            val i = Intent(ctx, WidgetRefresh::class.java).setAction(ACTION)
            return PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
    }
}
