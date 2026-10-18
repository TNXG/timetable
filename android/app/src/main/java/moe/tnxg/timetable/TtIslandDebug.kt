package moe.tnxg.timetable

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "TtIslandDebug",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])]
)
class TtIslandDebug : Plugin() {
    @PluginMethod
    fun inspect(call: PluginCall) = dispatch(call) { call.resolve(it.snapshot()) }

    @PluginMethod
    fun send(call: PluginCall) = dispatch(call) {
        call.resolve(it.send(call.getBoolean("updated", false) == true))
    }

    @PluginMethod
    fun cancel(call: PluginCall) = dispatch(call) { call.resolve(it.cancel()) }

    @PluginMethod
    fun openPromotedSettings(call: PluginCall) {
        val act = activity ?: run { call.reject("当前无可用页面"); return }
        act.runOnUiThread {
            val actions = mutableListOf<Intent>()
            if (Build.VERSION.SDK_INT >= 36) {
                actions.add(Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }
            actions.add(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            actions.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", context.packageName, null)))
            val errors = mutableListOf<String>()
            for (intent in actions) {
                try {
                    act.startActivity(intent)
                    dispatch(call) { call.resolve(it.snapshot("已打开系统设置，返回后刷新状态", errors)) }
                    return@runOnUiThread
                } catch (error: android.content.ActivityNotFoundException) {
                    errors.add(IslandDebugEngine.describe(error))
                } catch (error: SecurityException) {
                    errors.add(IslandDebugEngine.describe(error))
                }
            }
            dispatch(call) { call.resolve(it.snapshot("系统设置无法打开", errors)) }
        }
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) = dispatch(call) { engine ->
        if (Build.VERSION.SDK_INT < 33 || engine.permission() == "granted") {
            call.resolve(engine.snapshot("通知权限状态已读取"))
        } else {
            engine.markPermissionAsked()
            activity.runOnUiThread {
                try {
                    requestPermissionForAlias("notifications", call, "notificationPermissionResult")
                } catch (error: Exception) {
                    dispatch(call) { call.resolve(it.snapshot("通知权限申请失败",
                        listOf(IslandDebugEngine.describe(error)))) }
                }
            }
        }
    }

    @PermissionCallback
    private fun notificationPermissionResult(call: PluginCall) = dispatch(call) {
        call.resolve(it.snapshot(if (it.permission() == "granted") "通知权限已授权" else "通知权限未授权"))
    }

    private fun dispatch(call: PluginCall, action: (IslandDebugEngine) -> Unit) {
        worker.execute {
            val engine = engine(context)
            try {
                action(engine)
            } catch (error: Throwable) {
                call.resolve(engine.snapshot("原生调试操作失败", listOf(IslandDebugEngine.describe(error))))
            }
        }
    }

    companion object {
        // Retain ordering and restore state across Activity/WebView recreation, not a service.
        private val worker = Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "tt-island-debug").apply { isDaemon = true }
        }
        private var sharedEngine: IslandDebugEngine? = null

        @Synchronized
        private fun engine(context: Context): IslandDebugEngine = sharedEngine
            ?: IslandDebugEngine(context.applicationContext).also { sharedEngine = it }
    }
}
