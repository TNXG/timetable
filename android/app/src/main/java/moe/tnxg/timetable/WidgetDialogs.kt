package moe.tnxg.timetable

import android.app.Activity

/** 系统对话框的共用处理：WidgetBridge 的 pickDate / pickTime / pickOption / confirm 调用 */
object WidgetDialogs {

    /**
     * 系统对话框主题：DeviceDefault 由 ROM 厂商覆写（ColorOS / MIUI / One UI / Pixel 动态取色），
     * AppCompat/Material 只会得到 AOSP 原生样式。
     */
    fun dialogTheme(act: Activity): Int {
        return if (ThemeApply.isSystemDark(act))
            android.R.style.Theme_DeviceDefault_Dialog_Alert
        else
            android.R.style.Theme_DeviceDefault_Light_Dialog_Alert
    }

    /** 返回键只关对话框，不往 Activity 下传 */
    fun eatBack(d: android.app.Dialog) {
        d.setCanceledOnTouchOutside(true)
        d.setOnKeyListener { dlg, keyCode, event ->
            if (keyCode != android.view.KeyEvent.KEYCODE_BACK) return@setOnKeyListener false
            if (event.action == android.view.KeyEvent.ACTION_UP) dlg.cancel()
            true
        }
    }
}
