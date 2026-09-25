package moe.tnxg.timetable

import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale

/**
 * 调试页用：只读的运行时与设备信息，不碰任何用户数据。
 * 机型与芯片是判断加速器能不能用上的前提，单独一问，不必连带跑推理探测。
 */
@CapacitorPlugin(name = "TtDebug")
class TtDebug : Plugin() {

    /** → { model, brand, manufacturer, soc, abi, abis, release, sdk, locale } */
    @PluginMethod
    fun device(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("model", Build.MODEL)
                .put("brand", Build.BRAND)
                .put("manufacturer", Build.MANUFACTURER)
                /* Android 12 起系统才上报芯片名 */
                .put("soc", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MODEL else "")
                .put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "")
                .put("abis", Build.SUPPORTED_ABIS.joinToString(" "))
                .put("release", Build.VERSION.RELEASE)
                .put("sdk", Build.VERSION.SDK_INT)
                .put("locale", Locale.getDefault().toString()),
        )
    }
}
