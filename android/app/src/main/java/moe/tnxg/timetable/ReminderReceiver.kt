package moe.tnxg.timetable

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Queue operations are local only; no network, WebView or long-running service.
        try { ReminderQueue.tick(context, intent.action == Intent.ACTION_BOOT_COMPLETED) }
        catch (error: Exception) { android.util.Log.e("CourseReminders", "Unable to refresh reminders", error) }
    }
}
