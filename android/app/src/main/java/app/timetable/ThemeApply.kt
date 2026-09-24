package app.timetable

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.content.res.Configuration
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.view.Window
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

/** 把页面主题同步到原生窗口：底色、系统栏颜色与图标深浅。 */
object ThemeApply {
    private const val PREFS = "tt.theme"

    @JvmStatic
    fun isSystemDark(cfg: Configuration): Boolean {
        return cfg.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    }

    @JvmStatic
    fun isSystemDark(ctx: Context): Boolean {
        return isSystemDark(ctx.resources.configuration)
    }

    /** system：用户选的是「跟随系统」，小组件据此在系统切换深浅时自行跟随 */
    @JvmStatic
    fun remember(ctx: Context, color: Int, light: Boolean, system: Boolean) {
        val sp: SharedPreferences = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.edit().putInt("bg", color).putBoolean("light", light).putBoolean("system", system).apply()
    }

    /** 启动时先按上次的主题铺好，等页面首帧前不露出默认白底 */
    @JvmStatic
    fun applySaved(act: Activity, webView: View?) {
        val sp: SharedPreferences = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!sp.contains("bg")) return
        apply(act, webView, sp.getInt("bg", 0xFFF7F7F6.toInt()), sp.getBoolean("light", true))
    }

    @JvmStatic
    fun apply(act: Activity, webView: View?, color: Int, light: Boolean) {
        val w: Window = act.window
        w.setBackgroundDrawable(ColorDrawable(color))
        w.statusBarColor = color
        w.navigationBarColor = color
        val c = WindowCompat.getInsetsController(w, w.decorView)
        c.isAppearanceLightStatusBars = light
        c.isAppearanceLightNavigationBars = light
        if (webView != null) webView.setBackgroundColor(color)
    }
}
