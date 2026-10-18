package moe.tnxg.timetable

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.concurrent.Executors

@CapacitorPlugin(name = "TtReminders", permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])])
class TtReminders : Plugin() {
    private fun status(): JSObject {
        val granted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
            Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val manager = context.getSystemService(NotificationManager::class.java)
        return JSObject().apply {
            put("permission", if (granted) "granted" else if (getPermissionState("notifications").toString() == "DENIED") "denied" else "prompt")
            put("notificationsEnabled", manager.areNotificationsEnabled())
            put("exactAlarms", Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms())
            put("canPromote", Build.VERSION.SDK_INT >= 36 && manager.canPostPromotedNotifications())
            put("focusModuleActive", moe.tnxg.timetable.focus.FocusCapability.available(context))
            put("scheduled", ReminderQueue.count(context))
        }
    }

    @PluginMethod
    fun inspect(call: PluginCall) { call.resolve(status()) }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
                Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) call.resolve(status())
        else requestPermissionForAlias("notifications", call, "permissionResult")
    }

    @PermissionCallback
    private fun permissionResult(call: PluginCall) { call.resolve(status()) }

    @PluginMethod
    fun replace(call: PluginCall) {
        val json = call.getString("json") ?: run { call.reject("缺少提醒计划"); return }
        worker.execute {
            try { ReminderQueue.replace(context, json); call.resolve() }
            catch (error: Exception) { call.reject("提醒计划保存失败", error) }
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        worker.execute {
            try { ReminderQueue.clear(context); call.resolve() }
            catch (error: Exception) { call.reject("提醒清理失败", error) }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            call.resolve()
        } catch (error: Exception) { call.reject("通知设置无法打开", error) }
    }

    companion object {
        private val worker = Executors.newSingleThreadExecutor()
    }
}
