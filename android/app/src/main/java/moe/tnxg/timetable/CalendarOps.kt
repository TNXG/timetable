package moe.tnxg.timetable

import android.content.ContentProviderOperation
import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.provider.CalendarContract
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import android.provider.CalendarContract.Reminders

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject

import org.json.JSONObject

import java.util.ArrayList
import java.util.HashMap

/**
 * 系统日历的 Provider 落地逻辑：sync adapter 参数、查询、建删日历、事件批量写入。
 * TtCalendar 插件类只做权限与 JS 调度。
 */
object CalendarOps {

    const val ACCOUNT_NAME = "课程表"

    /** 每门课一本日历的 slug 前缀，与 calendar-plan.ts 的 courseCalendar 一致 */
    const val COURSE_PREFIX = "tt.c."

    val ACCOUNT_TYPE: String = CalendarContract.ACCOUNT_TYPE_LOCAL

    /** 单批操作上限：Binder 事务有 1MB 限制，事件 + 提醒一起算 */
    const val BATCH = 120

    fun asSync(uri: Uri): Uri {
        return uri.buildUpon()
                .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                .appendQueryParameter(Calendars.ACCOUNT_NAME, ACCOUNT_NAME)
                .appendQueryParameter(Calendars.ACCOUNT_TYPE, ACCOUNT_TYPE)
                .build()
    }

    fun parseColor(hex: String?, fallback: Int): Int {
        if (hex == null) return fallback
        return try {
            Color.parseColor(hex)
        } catch (e: IllegalArgumentException) {
            fallback
        }
    }

    /**
     * 账户下现有的日历：NAME -> _ID；colors 非空时顺带读出上次写进去的颜色（CAL_SYNC1），NAME -> hex。
     * 同名重复的旧日历直接删掉。
     */
    fun findCalendars(context: Context, colors: HashMap<String, String>?): HashMap<String, Long> {
        val out = HashMap<String, Long>()
        val cr = context.contentResolver
        try {
            cr.query(
                    Calendars.CONTENT_URI,
                    arrayOf(Calendars._ID, Calendars.NAME, Calendars.CAL_SYNC1),
                    Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=?",
                    arrayOf(ACCOUNT_NAME, ACCOUNT_TYPE),
                    null
            )?.use { c ->
                while (c.moveToNext()) {
                    val name = if (c.isNull(1)) "" else c.getString(1)
                    if (!out.containsKey(name)) {
                        out[name] = c.getLong(0)
                        if (colors != null) colors[name] = if (c.isNull(2)) "" else c.getString(2)
                    } else {
                        cr.delete(asSync(ContentUris.withAppendedId(Calendars.CONTENT_URI, c.getLong(0))), null, null)
                    }
                }
            }
        } catch (ignored: Exception) {
        }
        return out
    }

    /** 这本日历里的事件是否全部已经结束（空日历不算） */
    fun allPast(cr: ContentResolver, calendarId: Long, now: Long): Boolean {
        var any = false
        try {
            val c = cr.query(
                    Events.CONTENT_URI,
                    arrayOf(Events.DTSTART, Events.DTEND, Events.LAST_DATE),
                    Events.CALENDAR_ID + "=? AND " + Events.DELETED + "=0",
                    arrayOf(calendarId.toString()),
                    null
            )
            if (c == null) return false
            c.use {
                while (it.moveToNext()) {
                    any = true
                    val end = if (!it.isNull(2)) it.getLong(2) else if (!it.isNull(1)) it.getLong(1) else if (it.isNull(0)) Long.MAX_VALUE else it.getLong(0)
                    if (end >= now) return false
                }
            }
        } catch (e: Exception) {
            return false
        }
        return any
    }

    /** 账户下全部事件：id + calendarId + key + hash，页面拿去和期望集合比 */
    fun readEvents(context: Context, cals: HashMap<String, Long>): JSArray {
        val out = JSArray()
        if (cals.isEmpty()) return out
        val sb = StringBuilder()
        for (id in cals.values) {
            if (sb.isNotEmpty()) sb.append(',')
            sb.append(id)
        }
        val cr = context.contentResolver
        cr.query(
                asSync(Events.CONTENT_URI),
                arrayOf(Events._ID, Events.CALENDAR_ID, Events.SYNC_DATA1, Events.SYNC_DATA2),
                Events.CALENDAR_ID.toString() + " IN (" + sb + ") AND " + Events.DELETED + "=0",
                null,
                null
        )?.use { c ->
            while (c.moveToNext()) {
                val e = JSObject()
                e.put("id", c.getLong(0))
                e.put("calendarId", c.getLong(1))
                e.put("key", if (c.isNull(2)) "" else c.getString(2))
                e.put("hash", if (c.isNull(3)) "" else c.getString(3))
                out.put(e)
            }
        }
        return out
    }

    fun eventValues(context: Context, cal: Long, ev: JSONObject, key: String?, hash: String?, hasAlarm: Boolean): ContentValues {
        val v = ContentValues()
        v.put(Events.CALENDAR_ID, cal)
        v.put(Events.TITLE, ev.optString("title", ""))
        v.put(Events.EVENT_LOCATION, if (ev.isNull("location")) "" else ev.optString("location", ""))
        v.put(Events.DESCRIPTION, if (ev.isNull("description")) "" else ev.optString("description", ""))
        val allDay = ev.optBoolean("allDay", false)
        v.put(Events.ALL_DAY, if (allDay) 1 else 0)
        v.put(Events.DTSTART, ev.getLong("start"))
        v.put(Events.EVENT_TIMEZONE, if (allDay) "UTC" else ev.optString("tz", java.util.TimeZone.getDefault().getID()))
        val rrule = if (ev.isNull("rrule")) null else ev.optString("rrule", null)
        if (rrule != null && rrule.isNotEmpty()) {
            v.put(Events.RRULE, rrule)
            v.put(Events.DURATION, ev.optString("duration", "PT45M"))
            v.putNull(Events.DTEND)
            val ex = if (ev.isNull("exdate")) null else ev.optString("exdate", null)
            if (ex != null && ex.isNotEmpty()) v.put(Events.EXDATE, ex) else v.putNull(Events.EXDATE)
        } else {
            v.putNull(Events.RRULE)
            v.putNull(Events.EXDATE)
            v.putNull(Events.DURATION)
            v.put(Events.DTEND, ev.getLong("end"))
        }
        // 颜色属于日历：事件不单独着色，用户在系统日历里改日历颜色就整本一起变
        v.putNull(Events.EVENT_COLOR)
        v.put(Events.HAS_ALARM, if (hasAlarm) 1 else 0)
        v.put(Events.AVAILABILITY, if (ev.optBoolean("busy", true)) Events.AVAILABILITY_BUSY else Events.AVAILABILITY_FREE)
        v.put(Events.ACCESS_LEVEL, Events.ACCESS_PRIVATE)
        // 停课 / 请假也写 CONFIRMED：STATUS_CANCELED 的事件不进 Instances 表，任何日历应用都看不到
        v.put(Events.STATUS, Events.STATUS_CONFIRMED)
        v.put(Events.GUESTS_CAN_MODIFY, 0)
        v.put(Events.GUESTS_CAN_INVITE_OTHERS, 0)
        v.put(Events.GUESTS_CAN_SEE_GUESTS, 0)
        v.put(Events.SYNC_DATA1, key)
        v.put(Events.SYNC_DATA2, hash)
        // 让系统日历在事件详情里显示「在 课程表 中打开」
        val link = if (ev.isNull("link")) null else ev.optString("link", null)
        if (link != null && link.isNotEmpty()) {
            v.put(Events.CUSTOM_APP_PACKAGE, context.packageName)
            v.put(Events.CUSTOM_APP_URI, link)
        } else {
            v.putNull(Events.CUSTOM_APP_PACKAGE)
            v.putNull(Events.CUSTOM_APP_URI)
        }
        return v
    }

    fun minutes(item: JSONObject): IntArray {
        val arr = item.optJSONArray("reminders") ?: return IntArray(0)
        val out = IntArray(arr.length())
        for (i in 0 until arr.length()) out[i] = arr.optInt(i, 10)
        return out
    }

    @Throws(Exception::class)
    fun flush(cr: ContentResolver, ops: ArrayList<ContentProviderOperation>) {
        if (ops.isEmpty()) return
        val r = cr.applyBatch(CalendarContract.AUTHORITY, ops)
        ops.clear()
        if (r == null) throw IllegalStateException("applyBatch returned null")
    }

    /**
     * 一次落地全部差异：inserts / updates / deletes。
     * 事件与它的提醒放在同一批里，用 back reference 拿新事件的 id。
     * 返回 [inserted, updated, deleted] 计数。
     */
    @Throws(Exception::class)
    fun applyDiffs(context: Context, inserts: JSArray, updates: JSArray, deletes: JSArray): IntArray {
        val cr = context.contentResolver
        val evUri = asSync(Events.CONTENT_URI)
        val remUri = asSync(Reminders.CONTENT_URI)
        val ops = ArrayList<ContentProviderOperation>()
        var nIns = 0
        var nUpd = 0
        var nDel = 0
        for (i in 0 until deletes.length()) {
            val id = deletes.getLong(i)
            ops.add(ContentProviderOperation.newDelete(ContentUris.withAppendedId(evUri, id)).build())
            nDel++
            if (ops.size >= BATCH) flush(cr, ops)
        }
        for (i in 0 until updates.length()) {
            val it = updates.getJSONObject(i)
            val id = it.getLong("id")
            val mins = minutes(it)
            ops.add(
                    ContentProviderOperation.newUpdate(ContentUris.withAppendedId(evUri, id))
                            .withValues(eventValues(context, it.getLong("calendarId"), it.getJSONObject("event"), it.getString("key"), it.getString("hash"), mins.isNotEmpty()))
                            .build())
            ops.add(
                    ContentProviderOperation.newDelete(remUri)
                            .withSelection(Reminders.EVENT_ID + "=?", arrayOf(id.toString()))
                            .build())
            for (m in mins) {
                ops.add(
                        ContentProviderOperation.newInsert(remUri)
                                .withValue(Reminders.EVENT_ID, id)
                                .withValue(Reminders.MINUTES, m)
                                .withValue(Reminders.METHOD, Reminders.METHOD_ALERT)
                                .build())
            }
            nUpd++
            if (ops.size >= BATCH) flush(cr, ops)
        }
        for (i in 0 until inserts.length()) {
            val it = inserts.getJSONObject(i)
            val mins = minutes(it)
            // 一个事件带它的提醒必须在同一批：back reference 只在批内有效
            if (ops.size + 1 + mins.size > BATCH) flush(cr, ops)
            val ref = ops.size
            ops.add(
                    ContentProviderOperation.newInsert(evUri)
                            .withValues(eventValues(context, it.getLong("calendarId"), it.getJSONObject("event"), it.getString("key"), it.getString("hash"), mins.isNotEmpty()))
                            .build())
            for (m in mins) {
                ops.add(
                        ContentProviderOperation.newInsert(remUri)
                                .withValueBackReference(Reminders.EVENT_ID, ref)
                                .withValue(Reminders.MINUTES, m)
                                .withValue(Reminders.METHOD, Reminders.METHOD_ALERT)
                                .build())
            }
            nIns++
        }
        flush(cr, ops)
        return intArrayOf(nIns, nUpd, nDel)
    }
}
