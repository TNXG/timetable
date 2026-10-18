package moe.tnxg.timetable

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import moe.tnxg.timetable.focus.FocusCapability
import moe.tnxg.timetable.focus.FocusPayload

internal object ReminderNotification {
    fun register(ctx: Context) {
        CourseNotifications.register(ctx)
        if (Build.VERSION.SDK_INT < 26) return
        val manager = ctx.getSystemService(NotificationManager::class.java)
        for ((id, label) in listOf("course_reminders_v1" to "上课提醒", "task_reminders_v1" to "作业提醒", "exam_reminders_v1" to "考试提醒")) {
            manager.createNotificationChannel(NotificationChannel(id, label, NotificationManager.IMPORTANCE_DEFAULT))
        }
    }

    fun build(ctx: Context, job: JSONObject, id: Int): Notification {
        register(ctx)
        val focus = job.getBoolean("promote") && FocusCapability.available(ctx)
        val promote = !focus && job.getBoolean("promote") && Build.VERSION.SDK_INT >= 36 &&
            ctx.getSystemService(NotificationManager::class.java).canPostPromotedNotifications()
        val kind = job.getString("kind")
        val channel = if (focus || promote) CourseNotifications.CHANNEL else when (kind) {
            "course" -> "course_reminders_v1"
            "exam" -> "exam_reminders_v1"
            else -> "task_reminders_v1"
        }
        val intent = Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse(job.getString("link")))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val click = PendingIntent.getActivity(ctx, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val timeout = maxOf(1000, job.getLong("until") - System.currentTimeMillis())
        val title = job.getString("title")
        val during = job.optString("phase") == "during"
        val countdown = kind == "course" && during && job.optBoolean("countdown")
        val location = job.optString("location")
        val timeRange = job.optString("timeRange")
        val stage = if (during) "上课中" else "即将上课"
        val text = if (kind == "course") listOf(location, timeRange).filter { it.isNotBlank() }.joinToString(" · ") else job.getString("text")
        // Keep standard styles for promotion, but avoid a stack of system-style field labels.
        val detail = SpannableStringBuilder()
        if (kind == "course") {
            if (location.isNotBlank()) {
                detail.append(location)
                detail.setSpan(StyleSpan(Typeface.BOLD), 0, detail.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            val secondary = listOf(timeRange, job.optString("detail").lineSequence().firstOrNull().orEmpty())
                .filter { it.isNotBlank() }.joinToString(" · ")
            if (secondary.isNotBlank()) {
                if (detail.isNotEmpty()) detail.append("\n")
                val from = detail.length
                detail.append(secondary)
                detail.setSpan(RelativeSizeSpan(0.9f), from, detail.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        } else {
            detail.append(text)
            val note = job.optString("detail")
            if (note.isNotBlank()) detail.append("\n").append(note)
        }
        if (promote && Build.VERSION.SDK_INT >= 36) {
            return Notification.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_island_debug).setContentTitle(title).setContentText(text)
                .setContentIntent(click).setOngoing(true).setOnlyAlertOnce(true).setColorized(false)
                .setShowWhen(false)
                .setWhen(if (countdown) job.getLong("endAt") else 0L)
                .setUsesChronometer(countdown).setChronometerCountDown(countdown)
                .setShortCriticalText(if (countdown) "" else stage)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setStyle(Notification.BigTextStyle().bigText(detail))
                .addExtras(Bundle().apply { putBoolean("android.requestPromotedOngoing", true) })
                .setTimeoutAfter(timeout).build()
        }
        return NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_island_debug).setContentTitle(title).setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(detail)).setContentIntent(click)
            .setWhen(if (countdown) job.getLong("endAt") else System.currentTimeMillis())
            .setUsesChronometer(countdown).setChronometerCountDown(countdown)
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setAutoCancel(true)
            .setOnlyAlertOnce(true).setTimeoutAfter(timeout).build().also {
                if (focus) FocusPayload.apply(ctx, it, job)
            }
    }
}
