package app.timetable.widget

import android.content.Context
import android.view.View
import android.widget.RemoteViews

import java.util.ArrayList

import app.timetable.R
import app.timetable.widget.WidgetStore.Data
import app.timetable.widget.WidgetStore.Day
import app.timetable.widget.WidgetStore.Item

/** 把快照画成 RemoteViews。间距、字号、配色对齐原型 10 屏的小组件。 */
object WidgetRender {

    /** 今日/今明两天每列的行数，与原型一致 */
    private const val ROWS = 2

    @JvmStatic
    fun build(ctx: Context, style: String?, data: Data?, now: Long): RemoteViews {
        val v = RemoteViews(ctx.packageName, layoutOf(style))
        v.setOnClickPendingIntent(R.id.widget_root, openMainActivity(ctx))
        val p = palette(ctx)
        v.setInt(R.id.widget_root_bg, "setColorFilter", p.surface)
        theme(ctx, v, p)
        val today = WidgetStore.localDate(now)
        when (style) {
            "next" -> next(ctx, v, p, data, today, now)
            "twoDays" -> twoDays(ctx, v, p, data, today, now)
            "week" -> week(ctx, v, p, data, today, now)
            else -> todayList(ctx, v, p, data, today, now)
        }
        return v
    }

    /** 布局里的字色是浅色默认值，这里按主题整体重设一遍；课程行、周格子的字色在各自填充时设 */
    private fun theme(ctx: Context, v: RemoteViews, p: Palette) {
        paint(ctx, v, p.ink, "w_day", "w_num", "w_week")
        paint(ctx, v, p.accent, "w_wd")
        paint(ctx, v, p.ink3, "w_label", "w_unit", "w_empty")
        paint(ctx, v, p.ink4, "w_sub", "w_sub2", "w_date")
    }

    private fun paint(ctx: Context, v: RemoteViews, color: Int, vararg names: String) {
        for (n in names) {
            val id = viewId(ctx, n)
            if (id != 0) v.setTextColor(id, color)
        }
    }

    @JvmStatic
    fun layoutOf(style: String?): Int {
        return when (style) {
            "next" -> R.layout.widget_next
            "twoDays" -> R.layout.widget_two_days
            "week" -> R.layout.widget_week
            else -> R.layout.widget_today
        }
    }

    private fun live(d: Day?): List<Item> {
        val out = ArrayList<Item>()
        if (d == null) return out
        for (it in d.items) if (!it.cancelled) out.add(it)
        return out
    }

    private fun current(items: List<Item>, now: Long): Item? {
        for (it in items) if (it.startAt <= now && now < it.endAt) return it
        return null
    }

    private fun upcoming(items: List<Item>, now: Long): Item? {
        for (it in items) if (it.startAt > now) return it
        return null
    }

    /** 今日列表只放还没下课的：上课中的排第一，上完的不再占位 */
    private fun pending(items: List<Item>, now: Long): List<Item> {
        val out = ArrayList<Item>()
        for (it in items) if (it.endAt > now) out.add(it)
        return out
    }

    private fun head(ctx: Context, v: RemoteViews, date: String, sub: String?) {
        v.setTextViewText(R.id.w_day, WidgetStore.dayOfMonth(date).toString())
        v.setTextViewText(R.id.w_wd, WidgetStore.weekdayLabel(WidgetStore.weekdayOf(date)))
        v.setTextViewText(R.id.w_sub, sub ?: "")
    }

    /* ---------------- 空状态 ---------------- */

    private fun noData(data: Data?): Boolean {
        return data == null || data.days.isEmpty()
    }

    /** 从 fromExclusive 之后（不含）起第一个有课的日子 */
    private fun nextClassDay(data: Data?, fromExclusive: String): Day? {
        if (data == null) return null
        for (d in data.days) {
            if (d.date > fromExclusive && !live(d).isEmpty()) return d
        }
        return null
    }

    /** 今天之后某一天的称呼：明天 / 周四 / 10月21日 */
    private fun dayName(today: String, date: String): String {
        val diff = WidgetStore.daysBetween(today, date)
        if (diff == 1) return "明天"
        if (diff > 1 && diff < 7) return WidgetStore.weekdayLabel(WidgetStore.weekdayOf(date))
        return "${WidgetStore.monthOf(date)}月${WidgetStore.dayOfMonth(date)}日"
    }

    /** 接下来一段时间都没课时给出的原因，一句话 */
    private fun emptyReason(data: Data?, today: String): String {
        if (noData(data)) return "还没有课表"
        val first = data!!.firstClass
        if (first != null && first > today) {
            return "${WidgetStore.monthOf(first)}月${WidgetStore.dayOfMonth(first)}日开课"
        }
        val last = data.days[data.days.size - 1].date
        if (last < today && data.week >= data.totalWeeks) return "本学期已结束"
        return "近两周没有课"
    }

    private fun empty(ctx: Context, v: RemoteViews, text: String?) {
        val id = viewId(ctx, "w_empty")
        if (id == 0) return
        v.setViewVisibility(id, if (text == null) View.GONE else View.VISIBLE)
        if (text != null) v.setTextViewText(id, text)
    }

    /* ---------------- 今日列表 ---------------- */

    private fun todayList(ctx: Context, v: RemoteViews, p: Palette, data: Data?, today: String, now: Long) {
        val d = data?.day(today)
        val items = live(d)
        val cur = current(items, now)
        var show: List<Item> = pending(items, now)
        val sub: String
        if (!show.isEmpty()) {
            sub = "还剩 ${show.size} 节"
        } else {
            val nx = nextClassDay(data, today)
            if (nx != null) {
                show = live(nx)
                sub = dayName(today, nx.date) + " " + show.size + " 节"
            } else {
                sub = ""
            }
        }
        head(ctx, v, today, sub)
        empty(ctx, v, if (show.isEmpty()) emptyReason(data, today) else null)
        for (i in 0 until ROWS) {
            val it = if (i < show.size) show[i] else null
            row(ctx, v, p, "row", i, it, it != null && it === cur,
                if (it != null && it === cur) left(it, now) else null)
        }
    }

    private fun left(it: Item, now: Long): String {
        val mins = Math.max(1L, (it.endAt - now) / 60000)
        return if (mins >= 60) "还剩 ${mins / 60} 小时" + (if (mins % 60 == 0L) "" else " ${mins % 60} 分")
        else "还剩 $mins 分"
    }

    /* ---------------- 下一节 ---------------- */

    private fun next(ctx: Context, v: RemoteViews, p: Palette, data: Data?, today: String, now: Long) {
        val d = data?.day(today)
        val items = live(d)
        val cur = current(items, now)
        if (cur != null) {
            v.setTextViewText(R.id.w_label, "上课中")
            v.setViewVisibility(R.id.w_num, View.VISIBLE)
            v.setTextViewText(R.id.w_num, Math.max(1, ((cur.endAt - now) / 60000).toInt()).toString())
            v.setTextViewText(R.id.w_unit, "分钟后下课")
            row(ctx, v, p, "row", 0, cur, true, null)
            return
        }
        var nx = upcoming(items, now)
        var label = "下一节"
        if (nx == null) {
            val nd = nextClassDay(data, today)
            if (nd != null) {
                nx = live(nd)[0]
                label = dayName(today, nd.date) + "第一节"
            }
        }
        v.setTextViewText(R.id.w_label, label)
        if (nx == null) {
            v.setViewVisibility(R.id.w_num, View.GONE)
            v.setTextViewText(R.id.w_unit, emptyReason(data, today))
            row(ctx, v, p, "row", 0, null, false, null)
            return
        }
        v.setViewVisibility(R.id.w_num, View.VISIBLE)
        val mins = (nx.startAt - now) / 60000
        if (mins >= 24 * 60) {
            v.setTextViewText(R.id.w_num, WidgetStore.daysBetween(today, WidgetStore.localDate(nx.startAt)).toString())
            v.setTextViewText(R.id.w_unit, "天后")
        } else if (mins >= 60) {
            v.setTextViewText(R.id.w_num, (mins / 60).toString())
            val rem = mins % 60
            v.setTextViewText(R.id.w_unit, if (rem == 0L) "小时后" else "小时 $rem 分钟后")
        } else {
            v.setTextViewText(R.id.w_num, Math.max(1L, mins).toString())
            v.setTextViewText(R.id.w_unit, "分钟后")
        }
        row(ctx, v, p, "row", 0, nx, false, null)
    }

    /* ---------------- 今天与明天 ---------------- */

    /** 左列是今天（上完就换成下一个有课的日子），右列是再往后一个有课的日子 */
    private fun twoDays(ctx: Context, v: RemoteViews, p: Palette, data: Data?, today: String, now: Long) {
        val d = data?.day(today)
        val items = live(d)
        val cur = current(items, now)
        var show: List<Item> = pending(items, now)
        var anchor = today
        val sub: String
        if (!show.isEmpty()) {
            sub = "还剩 ${show.size} 节"
        } else {
            val nx = nextClassDay(data, today)
            if (nx != null) {
                show = live(nx)
                anchor = nx.date
                sub = dayName(today, nx.date) + " " + show.size + " 节"
            } else {
                sub = ""
            }
        }
        head(ctx, v, today, sub)
        empty(ctx, v, if (show.isEmpty()) emptyReason(data, today) else null)
        for (i in 0 until ROWS) {
            val it = if (i < show.size) show[i] else null
            row(ctx, v, p, "row", i, it, it != null && it === cur,
                if (it != null && it === cur) left(it, now) else null)
        }
        val second = nextClassDay(data, anchor)
        val t = live(second)
        v.setTextViewText(R.id.w_sub2, if (second == null) "" else dayName(today, second.date) + " " + t.size + " 节")
        for (i in 0 until ROWS) {
            row(ctx, v, p, "trow", i, if (i < t.size) t[i] else null, false, null)
        }
    }

    /* ---------------- 本周网格 ---------------- */

    /** 周末看下一周；整周没课时只留一句原因 */
    private fun week(ctx: Context, v: RemoteViews, p: Palette, data: Data?, today: String, now: Long) {
        var dateLabel = "${WidgetStore.monthOf(today)}月${WidgetStore.dayOfMonth(today)}日"
        if (noData(data)) {
            v.setTextViewText(R.id.w_week, "本周")
            v.setTextViewText(R.id.w_date, dateLabel)
            v.setViewVisibility(R.id.w_grid, View.GONE)
            empty(ctx, v, emptyReason(data, today))
            return
        }
        val snapshot = data!!
        val cur = snapshot.day(today)
        var week = cur?.week ?: snapshot.week
        if (WidgetStore.weekdayOf(today) >= 6 && week < snapshot.totalWeeks && hasClasses(snapshot, week + 1)) {
            week++
            dateLabel = "下周"
        }
        v.setTextViewText(R.id.w_week, "第 $week 周")
        v.setTextViewText(R.id.w_date, dateLabel)
        if (!hasClasses(snapshot, week)) {
            v.setViewVisibility(R.id.w_grid, View.GONE)
            empty(ctx, v, emptyReason(data, today))
            return
        }
        v.setViewVisibility(R.id.w_grid, View.VISIBLE)
        empty(ctx, v, null)
        val cols = ArrayList<Day>()
        for (d in snapshot.days) if (d.week == week && d.weekday <= 5) cols.add(d)
        for (c in 0 until 5) {
            val d = if (c < cols.size) cols[c] else null
            val isToday = d != null && d.date == today
            v.setTextViewText(viewId(ctx, "wd$c"), WidgetStore.weekdayLabel(c + 1))
            v.setTextColor(viewId(ctx, "wd$c"), if (isToday) p.accent else p.ink3)
            val items = live(d)
            for (r in 0 until 3) {
                val cid = "c${c}_$r"
                val it = if (r < items.size) items[r] else null
                if (it == null) {
                    v.setViewVisibility(viewId(ctx, cid), View.INVISIBLE)
                    continue
                }
                val nowCell = it.startAt <= now && now < it.endAt
                weekCell(ctx, v, p, cid, it, nowCell)
            }
        }
    }

    private fun hasClasses(data: Data, week: Int): Boolean {
        for (d in data.days) if (d.week == week && d.weekday <= 5 && !live(d).isEmpty()) return true
        return false
    }
}
