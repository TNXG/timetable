package app.timetable

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.appwidget.AppWidgetManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.widget.Toast

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

import app.timetable.widget.BaseWidget
import app.timetable.widget.NextWidget
import app.timetable.widget.TodayWidget
import app.timetable.widget.TwoDaysWidget
import app.timetable.widget.WeekWidget
import app.timetable.widget.WidgetStore

/** WebView 与桌面小组件之间的桥：写快照、触发重画、请求添加到桌面。 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridge : Plugin() {

    companion object {
        /** 页面首帧已画完：系统开屏可以收走 */
        @JvmField
        @Volatile
        var webReady: Boolean = false

        @Volatile
        private var instance: WidgetBridge? = null

        @JvmStatic
        fun notifySystemDark(act: Activity, dark: Boolean) {
            val p = instance ?: return
            val o = JSObject()
            o.put("dark", dark)
            act.runOnUiThread { p.notifyListeners("systemDark", o) }
        }

        /** 壁纸换色后系统色板会变：回前台时再推一次，页面自己比对 */
        @JvmStatic
        fun notifyDynamicColors(act: Activity) {
            val p = instance
            if (p == null || Build.VERSION.SDK_INT < 31) return
            val o = WidgetColors.dynamicColorsJson(act)
            act.runOnUiThread { p.notifyListeners("dynamicColors", o) }
        }
    }

    override fun load() {
        instance = this
    }

    /** 系统深浅色：页面启动时主动问一次，不依赖 WebView 的 prefers-color-scheme */
    @PluginMethod
    fun systemDark(call: PluginCall) {
        val o = JSObject()
        o.put("dark", ThemeApply.isSystemDark(context))
        call.resolve(o)
    }

    @PluginMethod
    fun dynamicColors(call: PluginCall) {
        call.resolve(WidgetColors.dynamicColorsJson(context))
    }

    /** 系统日期选择对话框：入参/出参都是 yyyy-MM-dd，取消时 value 为空 */
    @PluginMethod
    fun pickDate(call: PluginCall) {
        val act = activity
        if (act == null) { call.reject("no activity"); return }
        val v = call.getString("value", "")
        val c = java.util.Calendar.getInstance()
        if (v != null && v.length == 10) {
            try {
                c.set(v.substring(0, 4).toInt(), v.substring(5, 7).toInt() - 1, v.substring(8, 10).toInt())
            } catch (ignored: NumberFormatException) {
            }
        }
        act.runOnUiThread {
            val d = DatePickerDialog(act, WidgetDialogs.dialogTheme(act), { _, y, m, day ->
                val o = JSObject()
                o.put("value", String.format(java.util.Locale.ROOT, "%04d-%02d-%02d", y, m + 1, day))
                call.resolve(o)
            }, c.get(java.util.Calendar.YEAR), c.get(java.util.Calendar.MONTH), c.get(java.util.Calendar.DAY_OF_MONTH))
            d.setOnCancelListener { call.resolve(JSObject().put("value", "")) }
            WidgetDialogs.eatBack(d)
            d.show()
        }
    }

    /** 系统时间选择对话框：HH:mm */
    @PluginMethod
    fun pickTime(call: PluginCall) {
        val act = activity
        if (act == null) { call.reject("no activity"); return }
        val v = call.getString("value", "")
        var h = 8
        var m = 0
        if (v != null && v.length == 5) {
            try { h = v.substring(0, 2).toInt(); m = v.substring(3, 5).toInt() } catch (ignored: NumberFormatException) {
            }
        }
        act.runOnUiThread {
            val d = TimePickerDialog(act, WidgetDialogs.dialogTheme(act), { _, hour, minute ->
                val o = JSObject()
                o.put("value", String.format(java.util.Locale.ROOT, "%02d:%02d", hour, minute))
                call.resolve(o)
            }, h, m, true)
            d.setOnCancelListener { call.resolve(JSObject().put("value", "")) }
            WidgetDialogs.eatBack(d)
            d.show()
        }
    }

    /** 系统单选列表：返回选中下标，取消为 -1 */
    @PluginMethod
    fun pickOption(call: PluginCall) {
        val act = activity
        val arr = call.getArray("options")
        if (act == null || arr == null) { call.reject("bad args"); return }
        val title = call.getString("title")
        val selected = call.getInt("selected", -1)!!
        val items: Array<CharSequence>
        try {
            val list: java.util.List<CharSequence> = arr.toList<CharSequence>()
            items = list.toTypedArray()
        } catch (e: org.json.JSONException) {
            call.reject("bad options")
            return
        }
        act.runOnUiThread {
            val b = AlertDialog.Builder(act, WidgetDialogs.dialogTheme(act))
            if (title != null) b.setTitle(title)
            b.setSingleChoiceItems(items, selected) { dlg, which ->
                call.resolve(JSObject().put("index", which))
                dlg.dismiss()
            }
            b.setOnCancelListener { call.resolve(JSObject().put("index", -1)) }
            val d = b.create()
            WidgetDialogs.eatBack(d)
            d.show()
        }
    }

    /** 系统确认框：确定为 true，取消 / 点外部 / 返回为 false */
    @PluginMethod
    fun confirm(call: PluginCall) {
        val act = activity
        if (act == null) { call.reject("no activity"); return }
        val title = call.getString("title")
        val message = call.getString("message")
        val ok = call.getString("ok", "确定")
        val cancel = call.getString("cancel", "取消")
        act.runOnUiThread {
            val b = AlertDialog.Builder(act, WidgetDialogs.dialogTheme(act))
            if (title != null) b.setTitle(title)
            if (message != null) b.setMessage(message)
            b.setPositiveButton(ok) { _, _ -> call.resolve(JSObject().put("ok", true)) }
            b.setNegativeButton(cancel) { _, _ -> call.resolve(JSObject().put("ok", false)) }
            b.setOnCancelListener { call.resolve(JSObject().put("ok", false)) }
            val d = b.create()
            WidgetDialogs.eatBack(d)
            d.show()
        }
    }

    @PluginMethod
    fun toast(call: PluginCall) {
        val text = call.getString("text")
        val act = activity
        if (text != null && act != null) act.runOnUiThread { Toast.makeText(act, text, Toast.LENGTH_SHORT).show() }
        call.resolve()
    }

    @PluginMethod
    fun ready(call: PluginCall) {
        webReady = true
        call.resolve()
    }

    /* ---------------- 剪贴板：WebView 里 navigator.clipboard 读不到、写不稳，走系统 ClipboardManager ---------------- */

    @PluginMethod
    fun copy(call: PluginCall) {
        val text = call.getString("text")
        if (text == null) {
            call.reject("missing text")
            return
        }
        val act = activity
        if (act == null) {
            call.reject("no activity")
            return
        }
        act.runOnUiThread {
            val cm = act.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager?
            if (cm == null) {
                call.reject("no clipboard")
                return@runOnUiThread
            }
            cm.setPrimaryClip(ClipData.newPlainText("timetable", text))
            call.resolve()
        }
    }

    @PluginMethod
    fun paste(call: PluginCall) {
        val act = activity
        if (act == null) {
            call.reject("no activity")
            return
        }
        act.runOnUiThread {
            val cm = act.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager?
            val o = JSObject()
            var text = ""
            if (cm != null && cm.hasPrimaryClip()) {
                val clip = cm.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val cs = clip.getItemAt(0).coerceToText(act)
                    if (cs != null) text = cs.toString()
                }
            }
            o.put("text", text)
            call.resolve(o)
        }
    }

    /* ---------------- 触感：直接驱动马达，不走 WebView 的触摸反馈（用户关掉「触摸振动」后那条路是静音的） ---------------- */

    @PluginMethod
    fun haptic(call: PluginCall) {
        val kind = call.getString("kind", "selection")
        val act = activity
        if (act == null) {
            call.resolve()
            return
        }
        act.runOnUiThread {
            if (!WidgetHaptics.vibrate(act, kind)) {
                val v = bridge.webView
                if (v != null) v.performHapticFeedback(WidgetHaptics.feedbackConstant(kind), HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING)
            }
            call.resolve()
        }
    }

    /** 系统的本应用详情页：权限被永久拒绝后从这里放开 */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val act = activity
        if (act == null) {
            call.reject("no activity")
            return
        }
        val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", act.packageName, null))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        act.startActivity(i)
        call.resolve()
    }

    /** 页面主题变化：窗口底色、状态栏/导航栏颜色与图标深浅、WebView 底色一起切，避免露白边 */
    @PluginMethod
    fun setTheme(call: PluginCall) {
        val bg = call.getString("bg")
        val light = call.getBoolean("light")
        if (bg == null || light == null) {
            call.reject("missing bg/light")
            return
        }
        val color: Int
        try {
            color = Color.parseColor(bg)
        } catch (e: IllegalArgumentException) {
            call.reject("bad color")
            return
        }
        ThemeApply.remember(context, color, light, call.getBoolean("system") == true)
        val act = activity
        if (act != null) act.runOnUiThread { ThemeApply.apply(act, bridge.webView, color, light) }
        BaseWidget.updateAll(context)
        call.resolve()
    }

    @PluginMethod
    fun setData(call: PluginCall) {
        val json = call.getString("json")
        if (json == null) {
            call.reject("missing json")
            return
        }
        WidgetStore.write(context, json)
        BaseWidget.updateAll(context)
        call.resolve()
    }

    @PluginMethod
    fun isPinSupported(call: PluginCall) {
        val res = JSObject()
        res.put("supported", supported())
        call.resolve(res)
    }

    @PluginMethod
    fun requestPin(call: PluginCall) {
        val res = JSObject()
        if (!supported()) {
            res.put("requested", false)
            call.resolve(res)
            return
        }
        val mgr = AppWidgetManager.getInstance(context)
        val cn = ComponentName(context, providerOf(call.getString("style", "today")))
        val ok = mgr.requestPinAppWidget(cn, null, null)
        res.put("requested", ok)
        call.resolve(res)
    }

    private fun supported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val mgr = AppWidgetManager.getInstance(context)
        return mgr != null && mgr.isRequestPinAppWidgetSupported
    }

    private fun providerOf(style: String?): Class<*> {
        if (style == null) return TodayWidget::class.java
        return when (style) {
            "next" -> NextWidget::class.java
            "twoDays" -> TwoDaysWidget::class.java
            "week" -> WeekWidget::class.java
            else -> TodayWidget::class.java
        }
    }
}
