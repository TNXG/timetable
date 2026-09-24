package app.timetable.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

abstract class BaseWidget : AppWidgetProvider() {

    protected abstract fun style(): String

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val data: WidgetStore.Data? = WidgetStore.read(ctx)
        val now = System.currentTimeMillis()
        for (id in ids) {
            val v: RemoteViews = WidgetRender.build(ctx, style(), data, now)
            mgr.updateAppWidget(id, v)
        }
        WidgetRefresh.schedule(ctx)
    }

    override fun onEnabled(ctx: Context) {
        WidgetRefresh.schedule(ctx)
    }

    companion object {
        @JvmField
        val PROVIDERS: Array<Class<*>> = arrayOf(
            TodayWidget::class.java, NextWidget::class.java, TwoDaysWidget::class.java, WeekWidget::class.java,
        )

        /** 课表、待办或时间变了就整体重画 */
        @JvmStatic
        fun updateAll(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            for (p in PROVIDERS) {
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, p))
                if (ids.size == 0) continue
                val i = Intent(ctx, p)
                i.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                ctx.sendBroadcast(i)
            }
        }
    }
}
