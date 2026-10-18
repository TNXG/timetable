package moe.tnxg.timetable.focus

import android.content.Context
import android.os.Binder
import android.os.Bundle
import android.service.notification.StatusBarNotification
import de.robv.android.xposed.IXposedHookLoadPackage
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage
import java.util.Collections
import java.util.WeakHashMap
import java.lang.reflect.Modifier

/** Never changes authorization for a package other than Koma. Unknown structures fail closed. */
class FocusHook : IXposedHookLoadPackage {
    private val visited = Collections.newSetFromMap(WeakHashMap<ClassLoader, Boolean>())
    @Volatile private var ready = false
    @Volatile private var settingsInstalled = false
    @Volatile private var authInstalled = false

    override fun handleLoadPackage(param: XC_LoadPackage.LoadPackageParam) {
        if (param.packageName != "com.android.systemui") return
        runCatching { install(param.classLoader); hookCapability(param.classLoader) }
            .onFailure { XposedBridge.log("KomaFocus: initialization unavailable: $it") }
        val plugin = XposedHelpers.findClassIfExists("com.android.systemui.shared.plugins.PluginInstance", param.classLoader)
        val factory = XposedHelpers.findClassIfExists("com.android.systemui.shared.plugins.PluginInstance\$PluginFactory", param.classLoader)
        if (factory != null) {
            XposedBridge.hookAllMethods(factory, "createClassLoader", object : XC_MethodHook() {
                override fun afterHookedMethod(p: MethodHookParam) {
                    runCatching { (p.result as? ClassLoader)?.let(::install) }
                        .onFailure { XposedBridge.log("KomaFocus: plugin loader unavailable: $it") }
                }
            })
            XposedBridge.hookAllMethods(factory, "createPluginContext", object : XC_MethodHook() {
                override fun afterHookedMethod(p: MethodHookParam) {
                    runCatching { (p.result as? Context)?.classLoader?.let(::install) }
                        .onFailure { XposedBridge.log("KomaFocus: plugin context unavailable: $it") }
                }
            })
        }
        if (plugin != null) {
            XposedBridge.hookAllMethods(plugin, "loadPlugin", object : XC_MethodHook() {
                override fun afterHookedMethod(p: MethodHookParam) {
                    for (field in p.thisObject.javaClass.declaredFields) {
                        if (field.name != "mPluginContext" && field.name != "mContext") continue
                        runCatching {
                            field.isAccessible = true
                            (field.get(p.thisObject) as? Context)?.classLoader?.let(::install)
                        }
                    }
                }
            })
        }
    }

    private fun install(loader: ClassLoader) {
        synchronized(visited) { if (!visited.add(loader)) return }
        val settings = XposedHelpers.findClassIfExists("miui.systemui.notification.NotificationSettingsManager", loader)
        var settingsHooked = false
        if (settings != null) {
            for (method in settings.declaredMethods) {
                if (method.name !in arrayOf("canShowFocus", "canCustomFocus") || method.returnType != Boolean::class.javaPrimitiveType) continue
                XposedBridge.hookMethod(method, object : XC_MethodHook() {
                    override fun beforeHookedMethod(p: MethodHookParam) {
                        if (p.args.any { it == FocusCapability.PACKAGE }) p.result = true
                    }
                })
                settingsHooked = true
            }
        }
        var authHooked = false
        for (name in arrayOf(
            "miui.systemui.notification.auth.AuthManager\$AuthServiceCallback\$onAuthResult\$1",
            "miui.systemui.notification.auth.AuthManager\$LowVersionAuthServiceCallback\$onAuthResult\$1")) {
            val type = XposedHelpers.findClassIfExists(name, loader) ?: continue
            val method = type.declaredMethods.firstOrNull { it.name == "invokeSuspend" } ?: continue
            XposedBridge.hookMethod(method, object : XC_MethodHook() {
                override fun beforeHookedMethod(p: MethodHookParam) {
                    // Match a package-bearing Bundle, notification, key or callback field.
                    if (!ownsKoma(p.thisObject, 0, Collections.newSetFromMap(java.util.IdentityHashMap<Any, Boolean>()))) return
                    for (field in p.thisObject.javaClass.declaredFields) {
                        if (!field.name.contains("authBundle")) continue
                        runCatching { field.isAccessible = true; (field.get(p.thisObject) as? Bundle)?.putInt("result_code", 0) }
                    }
                }
            })
            authHooked = true
        }
        settingsInstalled = settingsInstalled || settingsHooked
        authInstalled = authInstalled || authHooked
        if (settingsHooked && authHooked) {
            ready = true
            XposedBridge.log("KomaFocus: package-scoped focus hooks installed")
        }
    }

    private fun ownsKoma(value: Any?, depth: Int, seen: MutableSet<Any>): Boolean {
        if (value == null || depth > 4 || !seen.add(value)) return false
        if (value is String) return value == FocusCapability.PACKAGE || value.startsWith("0|${FocusCapability.PACKAGE}|")
        if (value is StatusBarNotification) return value.packageName == FocusCapability.PACKAGE
        if (value is Bundle) return value.keySet().any { key -> runCatching { ownsKoma(value.get(key), depth + 1, seen) }.getOrDefault(false) }
        if (!value.javaClass.name.startsWith("miui.systemui.notification")) return false
        for (field in value.javaClass.declaredFields) {
            if (Modifier.isStatic(field.modifiers)) continue
            if (runCatching { field.isAccessible = true; ownsKoma(field.get(value), depth + 1, seen) }.getOrDefault(false)) return true
        }
        return false
    }

    private fun hookCapability(loader: ClassLoader) {
        val base = XposedHelpers.findClass("android.content.ContentProvider", loader)
        XposedBridge.hookAllMethods(base, "attachInfo", object : XC_MethodHook() {
            override fun afterHookedMethod(p: MethodHookParam) {
                val info = p.args.filterIsInstance<android.content.pm.ProviderInfo>().firstOrNull() ?: return
                if (info.authority?.split(';')?.contains("miui.statusbar.notification.public") != true) return
                XposedBridge.hookAllMethods(p.thisObject.javaClass, "call", object : XC_MethodHook() {
                    override fun beforeHookedMethod(call: MethodHookParam) {
                        if (call.args.none { it == FocusCapability.METHOD }) return
                        val context = XposedHelpers.callMethod(call.thisObject, "getContext") as? Context ?: return
                        val uid = runCatching { context.packageManager.getApplicationInfo(FocusCapability.PACKAGE, 0).uid }.getOrNull()
                        if (uid == null || uid != Binder.getCallingUid()) return
                        call.result = Bundle().apply {
                            putBoolean("active", ready)
                            putBoolean("handshake", true)
                            putBoolean("settingsHook", settingsInstalled)
                            putBoolean("authHook", authInstalled)
                            putInt("version", 2)
                        }
                    }
                })
                XposedBridge.log("KomaFocus: capability handshake installed")
            }
        })
    }
}
