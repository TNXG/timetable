package app.timetable

import android.content.Context
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants

/** 触感的底层实现：WidgetBridge 的 haptic 方法调用 vibrate / feedbackConstant */
object WidgetHaptics {

    fun feedbackConstant(kind: String?): Int {
        return when (kind) {
            "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.KEYBOARD_TAP
            "warning", "error" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
            "medium", "heavy" -> HapticFeedbackConstants.LONG_PRESS
            "light" -> HapticFeedbackConstants.KEYBOARD_TAP
            else -> if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        }
    }

    private fun vibrator(ctx: Context): Vibrator? {
        if (Build.VERSION.SDK_INT >= 31) {
            val vm = ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager?
            return vm?.defaultVibrator
        }
        return ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator?
    }

    /** 触感分级对齐 iOS UIFeedbackGenerator：
        selection 最轻刻度；light / medium / heavy 三档冲击；success / warning / error 是多段组合。
        优先用 Composition 原语按幅度合成（线性马达），不支持时退到预置波形；标为物理模拟类振动，不受「触摸反馈」开关影响 */
    fun vibrate(ctx: Context, kind: String?): Boolean {
        val vib = vibrator(ctx)
        if (vib == null || !vib.hasVibrator()) return false
        return try {
            var e: VibrationEffect? = null
            if (Build.VERSION.SDK_INT >= 30) e = composed(vib, kind)
            if (e == null && Build.VERSION.SDK_INT >= 29) e = predefined(kind)
            if (e == null && Build.VERSION.SDK_INT >= 26) e = oneShot(kind)
            if (e == null) return false
            if (Build.VERSION.SDK_INT >= 33) {
                vib.vibrate(e, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_PHYSICAL_EMULATION))
            } else {
                vib.vibrate(e)
            }
            true
        } catch (e: RuntimeException) {
            false
        }
    }

    private fun composed(vib: Vibrator, kind: String?): VibrationEffect? {
        val tick = VibrationEffect.Composition.PRIMITIVE_TICK
        val click = VibrationEffect.Composition.PRIMITIVE_CLICK
        if (!vib.areAllPrimitivesSupported(tick, click)) return null
        val low = if (Build.VERSION.SDK_INT >= 31 && vib.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_LOW_TICK))
            VibrationEffect.Composition.PRIMITIVE_LOW_TICK else tick
        val c = VibrationEffect.startComposition()
        when (kind) {
            "light" -> c.addPrimitive(tick, 0.55f)
            "medium" -> c.addPrimitive(click, 0.6f)
            "heavy" -> c.addPrimitive(click, 1f)
            "success" -> c.addPrimitive(tick, 0.5f).addPrimitive(click, 0.8f, 90)
            "warning" -> c.addPrimitive(click, 0.7f).addPrimitive(tick, 0.45f, 110)
            "error" -> c.addPrimitive(click, 0.6f).addPrimitive(click, 0.6f, 80).addPrimitive(tick, 0.4f, 100)
            else -> c.addPrimitive(low, if (low == tick) 0.35f else 0.7f)
        }
        return c.compose()
    }

    private fun predefined(kind: String?): VibrationEffect {
        return when (kind) {
            "light" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
            "medium", "success", "warning" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
            "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
            "error" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
            else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
        }
    }

    private fun oneShot(kind: String?): VibrationEffect {
        return when (kind) {
            "light" -> VibrationEffect.createOneShot(8, 120)
            "medium", "success", "warning" -> VibrationEffect.createOneShot(14, 180)
            "heavy" -> VibrationEffect.createOneShot(20, 255)
            "error" -> VibrationEffect.createWaveform(longArrayOf(0, 14, 70, 14), intArrayOf(0, 180, 0, 180), -1)
            else -> VibrationEffect.createOneShot(5, 80)
        }
    }
}
