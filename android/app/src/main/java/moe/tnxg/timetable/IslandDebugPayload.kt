package moe.tnxg.timetable

import android.app.Notification
import android.content.Context
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Fixed sample routed through the production course notification renderer. */
internal object IslandDebugPayload {
    @RequiresApi(36)
    fun notification(context: Context, updated: Boolean): Notification {
        val now = System.currentTimeMillis()
        val end = now + 120_000L
        val start = now - 60_000L
        val format = SimpleDateFormat("HH:mm", Locale.getDefault())
        val location = if (updated) "测试教室 B202" else "测试教室 A101"
        return ReminderNotification.build(context, JSONObject()
            .put("title", "测试课程")
            .put("text", location)
            .put("location", location)
            .put("timeRange", "${format.format(Date(start))}–${format.format(Date(end))}")
            .put("detail", "非真实课表")
            .put("phase", "during")
            .put("countdown", true)
            .put("startAt", start).put("endAt", end).put("until", end)
            .put("kind", "course").put("promote", true)
            .put("link", "timetable://open/day/${SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(now))}"),
            CourseNotifications.DEBUG_ID)
    }
}
