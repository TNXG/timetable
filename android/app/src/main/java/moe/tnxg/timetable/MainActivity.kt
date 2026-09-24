package moe.tnxg.timetable

import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.os.SystemClock

import androidx.core.splashscreen.SplashScreen
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    /** 开屏最多停留多久：页面迟迟不报首帧时也要放行 */
    private var resumeCover: ResumeCover? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // 只用系统开屏（纯背景色），一直挡到 WebView 画完首帧再撤，中间不出现空白页
        val splash: SplashScreen = installSplashScreen()
        val start = SystemClock.uptimeMillis()
        splash.setKeepOnScreenCondition { !WidgetBridge.webReady && SystemClock.uptimeMillis() - start < SPLASH_MAX_MS }
        registerPlugin(WidgetBridge::class.java)
        registerPlugin(TtCamera::class.java)
        registerPlugin(TtCalendar::class.java)
        registerPlugin(TtFiles::class.java)
        registerPlugin(TtEdu::class.java)
        super.onCreate(savedInstanceState)
        TtFiles.handleIntent(this, intent)
        ThemeApply.applySaved(this, bridge.webView)
        ImeFollow.install(this, bridge.webView)
        resumeCover = ResumeCover(this, bridge.webView)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        TtFiles.handleIntent(this, intent)
    }

    override fun onPause() {
        resumeCover?.capture()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        resumeCover?.release()
        WidgetBridge.notifyDynamicColors(this)
    }

    /** uiMode 在 configChanges 里，系统深浅色切换不重建 Activity，这里把变化转给页面 */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        WidgetBridge.notifySystemDark(this, ThemeApply.isSystemDark(newConfig))
    }

    companion object {
        /** 开屏最多停留多久：页面迟迟不报首帧时也要放行 */
        private const val SPLASH_MAX_MS = 4000L
    }
}
