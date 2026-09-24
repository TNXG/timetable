package app.timetable

import android.content.Context
import android.os.Build

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject

/** 动态取色的 JSON 拼装：WidgetBridge 的 dynamicColors / notifyDynamicColors 都从这里拿结果 */
object WidgetColors {

    /** Material You 主色调板（Android 12+），tone 100 → 0 共 13 级 */
    private val ACCENT1 = intArrayOf(
        android.R.color.system_accent1_0, android.R.color.system_accent1_10, android.R.color.system_accent1_50,
        android.R.color.system_accent1_100, android.R.color.system_accent1_200, android.R.color.system_accent1_300,
        android.R.color.system_accent1_400, android.R.color.system_accent1_500, android.R.color.system_accent1_600,
        android.R.color.system_accent1_700, android.R.color.system_accent1_800, android.R.color.system_accent1_900,
        android.R.color.system_accent1_1000,
    )

    fun dynamicColorsJson(ctx: Context): JSObject {
        val o = JSObject()
        val ok = Build.VERSION.SDK_INT >= 31
        o.put("supported", ok)
        if (!ok) return o
        val accent = JSArray()
        for (id in ACCENT1) accent.put(String.format("#%06X", 0xFFFFFF and ctx.getColor(id)))
        o.put("accent", accent)
        return o
    }
}
