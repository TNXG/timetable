package moe.tnxg.timetable

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/** One durable queue and one alarm. All plugin/receiver operations share this monitor. */
internal object ReminderQueue {
    private const val PREFS = "course_reminders"
    private const val FIRST_ID = 0x610000
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun pending(ctx: Context) = PendingIntent.getBroadcast(ctx, 0,
        Intent(ctx, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    @Synchronized
    fun replace(ctx: Context, json: String) {
        val data = JSONObject(json)
        val jobs = data.getJSONArray("jobs")
        val keys = HashSet<String>()
        for (i in 0 until jobs.length()) {
            val job = jobs.getJSONObject(i)
            require(job.getString("key").isNotBlank() && keys.add(job.getString("key")))
            require(job.getLong("at") < job.getLong("until"))
        }
        val old = JSONObject(prefs(ctx).getString("state", "{}")!!)
        val delivered = old.optJSONObject("delivered") ?: JSONObject()
        val kept = JSONObject()
        val active = old.optJSONObject("active") ?: JSONObject()
        for (i in 0 until jobs.length()) {
            val job = jobs.getJSONObject(i)
            val key = job.getString("key")
            if (delivered.optString(key) == job.toString()) kept.put(key, job.toString())
        }
        val manager = ctx.getSystemService(NotificationManager::class.java)
        val remove = mutableListOf<String>()
        for (key in active.keys()) {
            val current = active.getJSONObject(key)
            var replacement = false
            val now = System.currentTimeMillis()
            for (i in 0 until jobs.length()) {
                val job = jobs.getJSONObject(i)
                if (job.getString("notificationKey") == key && job.getLong("at") <= now && job.getLong("until") > now) {
                    replacement = true
                    break
                }
            }
            if (!replacement) { manager.cancel(current.getInt("id")); remove.add(key) }
        }
        remove.forEach(active::remove)
        data.put("delivered", kept).put("active", active)
        data.put("ids", old.optJSONObject("ids") ?: JSONObject())
        data.put("nextId", old.optInt("nextId", FIRST_ID))
        check(prefs(ctx).edit().putString("state", data.toString()).commit()) { "提醒计划保存失败" }
        tick(ctx)
    }

    @Synchronized
    fun clear(ctx: Context) {
        val manager = ctx.getSystemService(NotificationManager::class.java)
        val data = JSONObject(prefs(ctx).getString("state", "{}")!!)
        val active = data.optJSONObject("active") ?: JSONObject()
        for (key in active.keys()) manager.cancel(active.getJSONObject(key).getInt("id"))
        ctx.getSystemService(AlarmManager::class.java).cancel(pending(ctx))
        check(prefs(ctx).edit().clear().commit()) { "提醒清理失败" }
    }

    @Synchronized
    fun count(ctx: Context): Int {
        val data = JSONObject(prefs(ctx).getString("state", "{}")!!)
        val jobs = data.optJSONArray("jobs") ?: return 0
        val now = System.currentTimeMillis()
        return (0 until jobs.length()).count { jobs.getJSONObject(it).getLong("until") > now }
    }

    @Synchronized
    fun tick(ctx: Context, restoreAfterBoot: Boolean = false) {
        val raw = prefs(ctx).getString("state", null) ?: return
        val data = JSONObject(raw)
        val jobs = data.getJSONArray("jobs")
        val delivered = data.getJSONObject("delivered")
        val active = data.getJSONObject("active")
        val ids = data.getJSONObject("ids")
        val now = System.currentTimeMillis()
        val manager = ctx.getSystemService(NotificationManager::class.java)
        if (restoreAfterBoot) {
            for (i in 0 until jobs.length()) {
                val job = jobs.getJSONObject(i)
                if (job.optBoolean("promote") && job.getLong("until") > now)
                    delivered.remove(job.getString("key"))
            }
        }
        val expire = mutableListOf<String>()
        for (key in active.keys()) {
            val value = active.getJSONObject(key)
            if (value.getLong("until") <= now) { manager.cancel(value.getInt("id")); expire.add(key) }
        }
        expire.forEach(active::remove)
        // Latest phase wins when the process wakes after several course boundaries.
        val due = linkedMapOf<String, JSONObject>()
        var next = Long.MAX_VALUE
        for (i in 0 until jobs.length()) {
            val job = jobs.getJSONObject(i)
            val at = job.getLong("at")
            val until = job.getLong("until")
            if (until <= now) continue
            if (at > now) { next = minOf(next, at); continue }
            if (delivered.has(job.getString("key"))) continue
            val key = job.getString("notificationKey")
            if (due[key] == null || due[key]!!.getLong("at") <= at) due[key] = job
        }
        for ((key, job) in due) {
            var id = ids.optInt(key, 0)
            if (id == 0) {
                id = data.getInt("nextId")
                data.put("nextId", id + 1)
                ids.put(key, id)
            }
            try {
                if (manager.areNotificationsEnabled()) {
                    manager.notify(id, ReminderNotification.build(ctx, job, id))
                    active.put(key, JSONObject().put("id", id).put("until", job.getLong("until"))
                        .put("job", job.toString()))
                }
                // Do not replay missed alerts later when permission returns.
                for (i in 0 until jobs.length()) {
                    val phase = jobs.getJSONObject(i)
                    if (phase.getString("notificationKey") == key && phase.getLong("at") <= now)
                        delivered.put(phase.getString("key"), phase.toString())
                }
            } catch (error: SecurityException) {
                android.util.Log.w("CourseReminders", "Notification permission revoked", error)
                delivered.put(job.getString("key"), job.toString())
            }
        }
        for (key in active.keys()) next = minOf(next, active.getJSONObject(key).getLong("until"))
        check(prefs(ctx).edit().putString("state", data.toString()).commit()) { "提醒状态保存失败" }
        val alarm = ctx.getSystemService(AlarmManager::class.java)
        val pi = pending(ctx)
        alarm.cancel(pi)
        if (next == Long.MAX_VALUE) return
        val at = maxOf(now + 1000, next)
        try {
            if (Build.VERSION.SDK_INT < 31 || alarm.canScheduleExactAlarms())
                alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } catch (_: SecurityException) {
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }
}
