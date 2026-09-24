package app.timetable

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.CalendarContract
import android.provider.CalendarContract.Calendars
import android.provider.CalendarContract.Events
import android.provider.Settings

import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

import java.util.HashMap
import java.util.HashSet

/**
 * 系统日历：应用自己的几本本地日历（ACCOUNT_TYPE_LOCAL，上课 / 作业 / 考试），以 sync adapter 身份读写。
 * 提醒由系统日历发出；页面只算差异，这里只做落地。
 * key/hash 存在事件的 SYNC_DATA1/2 上：映射就在日历里，不另存一份状态。
 */
@CapacitorPlugin(
        name = "TtCalendar",
        permissions = [
                Permission(alias = "calendar", strings = [Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR]),
        ]
)
class TtCalendar : Plugin() {

    /* ---------------- 权限 ---------------- */

    private companion object {
        const val PREFS = "tt_calendar"
        const val KEY_ASKED = "asked"
    }

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun has(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
    }

    /** 已经问过、系统又不再展示弹窗：只能去设置里开 */
    private fun blocked(): Boolean {
        if (!prefs.getBoolean(KEY_ASKED, false)) return false
        return !ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.WRITE_CALENDAR)
    }

    private fun current(): String {
        return if (has()) "granted" else if (blocked()) "denied" else "prompt"
    }

    private fun status(s: String): JSObject {
        val o = JSObject()
        o.put("status", s)
        return o
    }

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        call.resolve(status(current()))
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val now = current()
        if (now != "prompt") {
            call.resolve(status(now))
            return
        }
        prefs.edit().putBoolean(KEY_ASKED, true).apply()
        requestPermissionForAlias("calendar", call, "permissionResult")
    }

    @PermissionCallback
    private fun permissionResult(call: PluginCall) {
        call.resolve(status(if (has()) "granted" else "denied"))
    }

    /* ---------------- 日历 ---------------- */

    /**
     * 找到或创建一组日历（每门课 / 作业 / 考试 / 周次各一本）；账户下多出来的旧日历删掉。
     * 颜色只在应用要的颜色变了时才写（上次写的值记在 CAL_SYNC1）：用户在系统日历里自己改的颜色不会被同步覆回去。
     * 本地日历必须以 sync adapter 身份插入，否则 Provider 拒绝。
     */
    @PluginMethod
    fun ensureCalendars(call: PluginCall) {
        if (!has()) {
            call.reject("denied")
            return
        }
        val wanted = call.getArray("calendars", JSArray())!!
        val cr = context.contentResolver
        val written = HashMap<String, String>()
        val have = CalendarOps.findCalendars(context, written)
        val ids = JSObject()
        val archived = JSArray()
        try {
            val keep = HashSet<String>()
            for (i in 0 until wanted.length()) {
                val w = wanted.getJSONObject(i)
                val slug = w.getString("slug")
                val name = w.optString("name", CalendarOps.ACCOUNT_NAME)
                val hex = w.optString("color", "")
                val color = CalendarOps.parseColor(hex, 0xFF4A55C7.toInt())
                val visible = if (w.optBoolean("visible", true)) 1 else 0
                keep.add(slug)
                var id: Long? = have[slug]
                if (id != null) {
                    val v = ContentValues()
                    v.put(Calendars.CALENDAR_DISPLAY_NAME, name)
                    val prevHex = written[slug]
                    if (prevHex == null || !hex.equals(prevHex, ignoreCase = true)) {
                        v.put(Calendars.CALENDAR_COLOR, color)
                        v.put(Calendars.CAL_SYNC1, hex)
                    }
                    v.put(Calendars.VISIBLE, visible)
                    v.put(Calendars.SYNC_EVENTS, 1)
                    cr.update(CalendarOps.asSync(ContentUris.withAppendedId(Calendars.CONTENT_URI, id)), v, null, null)
                } else {
                    val v = ContentValues()
                    v.put(Calendars.ACCOUNT_NAME, CalendarOps.ACCOUNT_NAME)
                    v.put(Calendars.ACCOUNT_TYPE, CalendarOps.ACCOUNT_TYPE)
                    v.put(Calendars.NAME, slug)
                    v.put(Calendars.CALENDAR_DISPLAY_NAME, name)
                    v.put(Calendars.CALENDAR_COLOR, color)
                    v.put(Calendars.CAL_SYNC1, hex)
                    v.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER)
                    v.put(Calendars.OWNER_ACCOUNT, CalendarOps.ACCOUNT_NAME)
                    v.put(Calendars.VISIBLE, visible)
                    v.put(Calendars.SYNC_EVENTS, 1)
                    v.put(Calendars.MAX_REMINDERS, 5)
                    v.put(Calendars.ALLOWED_REMINDERS, CalendarContract.Reminders.METHOD_DEFAULT + "," + CalendarContract.Reminders.METHOD_ALERT)
                    v.put(Calendars.ALLOWED_AVAILABILITY, Events.AVAILABILITY_BUSY + "," + Events.AVAILABILITY_FREE)
                    v.put(Calendars.ALLOWED_ATTENDEE_TYPES, CalendarContract.Attendees.TYPE_NONE.toString())
                    v.put(Calendars.CAN_ORGANIZER_RESPOND, 0)
                    v.put(Calendars.CAN_MODIFY_TIME_ZONE, 1)
                    v.put(Calendars.CALENDAR_TIME_ZONE, java.util.TimeZone.getDefault().getID())
                    val u = cr.insert(CalendarOps.asSync(Calendars.CONTENT_URI), v)
                    if (u == null) {
                        call.reject("insert failed")
                        return
                    }
                    id = ContentUris.parseId(u)
                }
                ids.put(slug, id)
            }
            val now = System.currentTimeMillis()
            for ((slug, calId) in have) {
                if (keep.contains(slug)) continue
                val u = CalendarOps.asSync(ContentUris.withAppendedId(Calendars.CONTENT_URI, calId))
                if (slug.startsWith(CalendarOps.COURSE_PREFIX) && CalendarOps.allPast(cr, calId, now)) {
                    // 上学期的课：从日历列表里隐起来，记录留着；删中的还有课的才真删
                    val v = ContentValues()
                    v.put(Calendars.VISIBLE, 0)
                    v.put(Calendars.SYNC_EVENTS, 0)
                    cr.update(u, v, null, null)
                    archived.put(calId)
                } else {
                    cr.delete(u, null, null)
                }
            }
        } catch (e: Exception) {
            call.reject(e.message.toString())
            return
        }
        val o = JSObject()
        o.put("ids", ids)
        o.put("archived", archived)
        call.resolve(o)
    }

    /** 账户下全部事件：id + calendarId + key + hash，页面拿去和期望集合比 */
    @PluginMethod
    fun readAll(call: PluginCall) {
        if (!has()) {
            call.reject("denied")
            return
        }
        try {
            val cals = CalendarOps.findCalendars(context, null)
            val o = JSObject()
            o.put("events", CalendarOps.readEvents(context, cals))
            call.resolve(o)
        } catch (e: Exception) {
            call.reject(e.message.toString())
        }
    }

    /**
     * 一次落地全部差异：inserts / updates / deletes。
     * 事件与它的提醒放在同一批里，用 back reference 拿新事件的 id。
     */
    @PluginMethod
    fun apply(call: PluginCall) {
        if (!has()) {
            call.reject("denied")
            return
        }
        try {
            val counts = CalendarOps.applyDiffs(
                    context,
                    call.getArray("inserts", JSArray())!!,
                    call.getArray("updates", JSArray())!!,
                    call.getArray("deletes", JSArray())!!)
            val o = JSObject()
            o.put("inserted", counts[0])
            o.put("updated", counts[1])
            o.put("deleted", counts[2])
            call.resolve(o)
        } catch (e: Exception) {
            call.reject(e.message.toString())
        }
    }

    /** 账户下的日历全部删掉（Provider 级联删事件与提醒） */
    @PluginMethod
    fun removeAll(call: PluginCall) {
        if (!has()) {
            call.resolve()
            return
        }
        val cr = context.contentResolver
        for (id in CalendarOps.findCalendars(context, null).values) {
            try {
                cr.delete(CalendarOps.asSync(ContentUris.withAppendedId(Calendars.CONTENT_URI, id)), null, null)
            } catch (ignored: Exception) {
            }
        }
        call.resolve()
    }

    /** 这台设备有没有能打开日历的应用 */
    @PluginMethod
    fun hasCalendarApp(call: PluginCall) {
        val o = JSObject()
        o.put("available", viewIntent(System.currentTimeMillis()).resolveActivity(context.packageManager) != null)
        call.resolve(o)
    }

    private fun viewIntent(at: Long): Intent {
        val b = CalendarContract.CONTENT_URI.buildUpon()
        b.appendPath("time")
        ContentUris.appendId(b, at)
        return Intent(Intent.ACTION_VIEW).setData(b.build())
    }

    /** 打开系统日历到某一天（默认今天） */
    @PluginMethod
    fun openCalendar(call: PluginCall) {
        val at = call.getLong("at", System.currentTimeMillis())!!
        try {
            val i = viewIntent(at)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("no calendar app")
        }
    }

    /** 权限被永久拒绝后，去应用详情页手动允许 */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.fromParts("package", context.packageName, null))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("no settings")
        }
    }

    /** 在系统日历里打开某一条事件 */
    @PluginMethod
    fun openEvent(call: PluginCall) {
        val id = call.getLong("id", -1L)!!
        if (id < 0) {
            call.reject("bad id")
            return
        }
        try {
            val i = Intent(Intent.ACTION_VIEW).setData(ContentUris.withAppendedId(Events.CONTENT_URI, id))
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) {
            call.reject("no calendar app")
        }
    }
}
