package moe.tnxg.timetable

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONObject

/** Serialized by TtIslandDebug. Reads system state, never infers visible island success. */
internal class IslandDebugEngine(private val context: Context) {
    private val manager = context.getSystemService(NotificationManager::class.java)
    private val prefs = context.getSharedPreferences("tt_island_debug", Context.MODE_PRIVATE)

    fun permission(): String {
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context,
                Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return "granted"
        return if (prefs.getBoolean("permission_asked", false)) "denied" else "prompt"
    }

    fun markPermissionAsked() {
        prefs.edit().putBoolean("permission_asked", true).apply()
    }

    fun snapshot(message: String = "状态已刷新", extra: List<String> = emptyList(),
                 submitted: Boolean? = null): JSObject {
        val details = extra.toMutableList()
        val active = try {
            manager.activeNotifications.firstOrNull {
                it.id == CourseNotifications.DEBUG_ID && it.packageName == context.packageName
            }?.notification
        } catch (error: Exception) {
            details.add("活动通知读取失败：${describe(error)}")
            null
        }
        val supported = Build.VERSION.SDK_INT >= 36
        val module = moe.tnxg.timetable.focus.FocusCapability.inspect(context, true)
        val moduleActive = module.active
        @Suppress("DEPRECATION")
        val declared = context.packageManager.getPackageInfo(context.packageName,
            PackageManager.GET_PERMISSIONS).requestedPermissions
            ?.contains("android.permission.POST_PROMOTED_NOTIFICATIONS") == true
        val allowed = if (supported) manager.canPostPromotedNotifications() else null
        val promotable = if (supported) active?.hasPromotableCharacteristics() else null
        val promoted = if (supported) active?.let {
            it.flags and Notification.FLAG_PROMOTED_ONGOING != 0
        } else null
        val channel = if (Build.VERSION.SDK_INT >= 26) manager.getNotificationChannel(CourseNotifications.CHANNEL) else null
        details.add("Android API ${Build.VERSION.SDK_INT} · ${Build.MANUFACTURER} ${Build.MODEL}")
        details.add("通知渠道：${CourseNotifications.CHANNEL}；通知 ID：${CourseNotifications.DEBUG_ID}")
        if (channel != null) details.add("渠道 importance=${channel.importance}")
        if (allowed == false) details.add("提升通知未获允许，可进入系统设置")
        if (promotable == false) details.add("活动通知不满足 Live Updates 特征")
        details.add(if (active != null) "系统活动通知列表含测试通知" else "系统活动通知列表未含测试通知")
        details.add("系统提升标记不代表超级岛实际可见")
        details.add(if (moduleActive) "LSPosed 增强已生效：小米原生焦点通知" else "LSPosed 未生效：Live Updates")
        return JSObject().apply {
            put("permission", permission())
            put("posted", submitted ?: (active != null))
            put("androidVersion", Build.VERSION.SDK_INT)
            put("liveSupported", supported)
            put("focusModuleActive", moduleActive)
            put("moduleHandshake", module.handshake)
            put("moduleSettingsHook", module.settingsHook)
            put("moduleAuthHook", module.authHook)
            put("moduleVersion", module.version)
            put("moduleReason", module.reason)
            put("checkedAt", System.currentTimeMillis())
            put("focusPayloadPresent", active?.extras?.containsKey("miui.focus.param") ?: false)
            put("promotedDeclared", declared)
            put("canPostPromoted", allowed ?: JSONObject.NULL)
            put("notificationPromotable", promotable ?: JSONObject.NULL)
            put("promoted", promoted ?: JSONObject.NULL)
            put("notificationsEnabled", manager.areNotificationsEnabled())
            put("channelEnabled", channel?.let { it.importance != NotificationManager.IMPORTANCE_NONE } ?: JSONObject.NULL)
            put("channelId", CourseNotifications.CHANNEL)
            put("channelName", channel?.name?.toString() ?: "未注册")
            put("message", message)
            put("details", JSArray(details))
        }
    }

    fun send(updated: Boolean): JSObject {
        if (Build.VERSION.SDK_INT < 36) return snapshot("Live Updates 需要 Android 16 及以上")
        if (permission() != "granted" || !manager.areNotificationsEnabled()) return snapshot("未发送：通知未获允许")
        if (!moe.tnxg.timetable.focus.FocusCapability.available(context) && !manager.canPostPromotedNotifications()) return snapshot("未发送：提升通知未获允许")
        CourseNotifications.register(context)
        if (manager.getNotificationChannel(CourseNotifications.CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) {
            return snapshot("未发送：课程实时通知渠道已关闭")
        }
        val notification = IslandDebugPayload.notification(context, updated)
        if (!moe.tnxg.timetable.focus.FocusCapability.available(context) && !notification.hasPromotableCharacteristics()) return snapshot("未发送：通知不满足提升条件")
        return try {
            manager.notify(CourseNotifications.DEBUG_ID, notification)
            snapshot("测试通知已提交", listOf("${if (updated) "更新" else "首次"}测试；两分钟系统超时"), true)
        } catch (error: Exception) {
            snapshot("通知提交失败", listOf(describe(error)))
        }
    }

    fun cancel(): JSObject = try {
        manager.cancel(CourseNotifications.DEBUG_ID)
        snapshot("测试通知已取消")
    } catch (error: Exception) {
        snapshot("取消失败", listOf(describe(error)))
    }

    companion object {
        fun describe(error: Throwable): String {
            val cause = error.cause ?: error
            return "${cause.javaClass.simpleName}: ${cause.message ?: "无错误消息"}"
        }
    }
}
