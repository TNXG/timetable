package app.timetable.widget

import android.content.Context
import android.content.SharedPreferences
import android.content.res.Configuration

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

import java.text.SimpleDateFormat
import java.util.ArrayList
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** 小组件的数据源：WebView 写进 SharedPreferences 的课表快照，这里解析成渲染用的结构。 */
object WidgetStore {
    private const val PREFS = "timetable.widget"
    private const val KEY = "data"

    class Item {
        @JvmField var name: String = ""
        @JvmField var loc: String = ""
        @JvmField var teacher: String = ""
        @JvmField var color: Int = 0xFF4F5BD5.toInt()
        @JvmField var start: String = ""
        @JvmField var startAt: Long = 0
        @JvmField var endAt: Long = 0
        @JvmField var cancelled: Boolean = false
    }

    class Day {
        @JvmField var date: String = ""
        @JvmField var weekday: Int = 0
        @JvmField var week: Int = 0
        @JvmField val items: MutableList<Item> = ArrayList()
    }

    class Data {
        @JvmField var week: Int = 0
        @JvmField var totalWeeks: Int = 0
        @JvmField var firstClass: String? = null
        @JvmField val days: MutableList<Day> = ArrayList()

        fun day(date: String): Day? {
            for (d in days) if (d.date == date) return d
            return null
        }
    }

    @JvmStatic
    fun write(ctx: Context, json: String) {
        prefs(ctx).edit().putString(KEY, json).apply()
    }

    private fun prefs(ctx: Context): SharedPreferences {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    @JvmStatic
    fun read(ctx: Context): Data? {
        val raw = prefs(ctx).getString(KEY, null) ?: return null
        return try {
            val o = JSONObject(raw)
            val d = Data()
            d.week = o.optInt("week")
            d.totalWeeks = o.optInt("totalWeeks")
            d.firstClass = if (o.isNull("firstClass")) null else o.optString("firstClass", null)
            val days = o.optJSONArray("days")
            var i = 0
            while (days != null && i < days.length()) {
                val dj = days.getJSONObject(i)
                val day = Day()
                day.date = dj.optString("date")
                day.weekday = dj.optInt("weekday")
                day.week = dj.optInt("week")
                val items = dj.optJSONArray("items")
                var j = 0
                while (items != null && j < items.length()) {
                    val ij = items.getJSONObject(j)
                    val it = Item()
                    it.name = ij.optString("name")
                    it.loc = ij.optString("loc")
                    it.teacher = ij.optString("teacher")
                    it.color = parseColor(ij.optString("color"), 0xFF4F5BD5.toInt())
                    it.start = ij.optString("start")
                    it.startAt = ij.optLong("startAt")
                    it.endAt = ij.optLong("endAt")
                    it.cancelled = ij.optBoolean("cancelled")
                    day.items.add(it)
                    j++
                }
                d.days.add(day)
                i++
            }
            d
        } catch (e: JSONException) {
            null
        }
    }

    @JvmStatic
    fun parseColor(hex: String?, fallback: Int): Int {
        return try {
            if (hex == null || hex.length < 4) return fallback
            0xFF000000.toInt() or (hex.replace("#", "").toLong(16) and 0xFFFFFF).toInt()
        } catch (e: NumberFormatException) {
            fallback
        }
    }

    /** 与 WebView 侧同一套本地日期字符串 */
    @JvmStatic
    fun localDate(at: Long): String {
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(at))
    }

    @JvmStatic
    fun nextDate(date: String): String {
        return try {
            val c = Calendar.getInstance()
            c.time = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date)
            c.add(Calendar.DAY_OF_MONTH, 1)
            SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.time)
        } catch (e: Exception) {
            date
        }
    }

    @JvmStatic
    fun dayOfMonth(date: String): Int {
        val p = date.split("-")
        return if (p.size == 3) p[2].toInt() else 1
    }

    @JvmStatic
    fun monthOf(date: String): Int {
        val p = date.split("-")
        return if (p.size == 3) p[1].toInt() else 1
    }

    /** 周一 = 1 … 周日 = 7 */
    @JvmStatic
    fun weekdayOf(date: String): Int {
        return try {
            val c = Calendar.getInstance()
            c.time = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date)
            (c.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1
        } catch (e: Exception) {
            1
        }
    }

    /** from 到 to 相差的天数（to 在后为正） */
    @JvmStatic
    fun daysBetween(from: String, to: String): Int {
        return try {
            val f = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val a = f.parse(from).time
            val b = f.parse(to).time
            Math.round((b - a) / 86400000.0).toInt()
        } catch (e: Exception) {
            0
        }
    }

    @JvmStatic
    fun weekdayLabel(weekday: Int): String {
        return when (weekday) {
            1 -> "周一"
            2 -> "周二"
            3 -> "周三"
            4 -> "周四"
            5 -> "周五"
            6 -> "周六"
            else -> "周日"
        }
    }

    @JvmStatic
    fun isNight(ctx: Context): Boolean {
        return (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    /** a 占 k，b 占 1-k */
    fun mix(a: Int, b: Int, k: Float): Int {
        val r = Math.round(((a shr 16) and 0xFF) * k + ((b shr 16) and 0xFF) * (1 - k))
        val g = Math.round(((a shr 8) and 0xFF) * k + ((b shr 8) and 0xFF) * (1 - k))
        val bl = Math.round((a and 0xFF) * k + (b and 0xFF) * (1 - k))
        return 0xFF000000.toInt() or (r shl 16) or (g shl 8) or bl
    }
}
