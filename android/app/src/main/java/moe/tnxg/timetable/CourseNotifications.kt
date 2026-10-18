package moe.tnxg.timetable

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/** Shared channel for course live activities; registration never posts a notification. */
internal object CourseNotifications {
    const val CHANNEL = "course_live_v1"
    const val DEBUG_ID = 0x545449

    fun register(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "课程实时通知",
            NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "课程实时状态与超级岛展示"
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        })
        // Retire the experimental channel and its notification without touching user data.
        if (manager.getNotificationChannel("tt_island_debug_v1") != null) {
            manager.cancel(DEBUG_ID)
            manager.deleteNotificationChannel("tt_island_debug_v1")
        }
    }
}
