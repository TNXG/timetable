package moe.tnxg.timetable.focus

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.SystemClock

/** Module state comes from the hooked SystemUI provider, not an installed-package check. */
object FocusCapability {
    const val PACKAGE = "moe.tnxg.timetable"
    const val METHOD = "komaFocusCapabilityV1"
    data class Status(val active: Boolean, val handshake: Boolean, val settingsHook: Boolean,
                      val authHook: Boolean, val version: Int, val reason: String)
    private var checkedAt = 0L
    private var cached = Status(false, false, false, false, 0, "尚未检查")

    fun available(context: Context): Boolean = inspect(context).active

    @Synchronized
    fun inspect(context: Context, refresh: Boolean = false): Status {
        if (Build.VERSION.SDK_INT < 33) return Status(false, false, false, false, 0, "Android 版本不支持增强路径")
        val now = SystemClock.elapsedRealtime()
        if (!refresh && now - checkedAt < 5000 && checkedAt != 0L) return cached
        checkedAt = now
        cached = try {
            val result = context.contentResolver.call(Uri.parse("content://miui.statusbar.notification.public"),
                METHOD, null, Bundle().apply { putString("package", PACKAGE) })
            if (result?.getBoolean("handshake", false) != true) {
                Status(false, false, false, false, 0, "未收到模块握手；检查 LSPosed 启用、SystemUI 作用域及重启状态")
            } else {
                val settings = result.getBoolean("settingsHook", false)
                val auth = result.getBoolean("authHook", false)
                Status(result.getBoolean("active", false), true, settings, auth, result.getInt("version", 0),
                    if (settings && auth) "模块已加载，仅放行 Koma" else "模块已加载，焦点插件 Hook 尚未就绪")
            }
        } catch (error: Exception) {
            Status(false, false, false, false, 0, "握手失败：${error.javaClass.simpleName}")
        }
        return cached
    }
}
