package app.timetable

import android.app.Activity
import android.view.View
import android.webkit.WebView

import androidx.annotation.NonNull
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat

import java.util.Locale

/**
 * 键盘跟随，照 Android 官方 WindowInsetsAnimation 示例的两段做法：
 * <ul>
 *   <li>RootViewDeferringInsetsCallback：键盘弹出的动画期间，把 ime 内边距从往下分发的 insets 里摘掉，
 *       下游（Capacitor SystemBars）就不会在动画第一帧把 WebView 一下压短；动画结束再把最后一次 insets 重新分发，
 *       WebView 这时才缩到最终高度。</li>
 *   <li>TranslateDeferringInsetsAnimationCallback：onProgress 里逐帧把键盘露出的高度喂给页面，
 *       页面按它平移，和系统键盘动画同步；WebView 缩短那一帧页面再把平移归零（见 src/app/ime.ts）。</li>
 * </ul>
 * 收起不延迟：WebView 内容画不到自己边界之外，收起时得先把 WebView 放回全高，页面再跟着键盘往下走。
 */
internal class ImeFollow private constructor(webView: WebView) {
    private val webView: WebView
    private val parent: View
    private val density: Float

    /** 键盘收起时 WebView 距窗口底部的内边距（导航栏或 0），键盘高度要扣掉它 */
    private var basePad = 0
    private var animating = false

    /** 弹出动画进行中：往下分发的 insets 先摘掉 ime，动画完再补发 */
    private var deferring = false
    private var lastInsets: WindowInsetsCompat? = null
    private var lastSent = -1

    init {
        this.webView = webView
        this.parent = webView.parent as View
        this.density = webView.resources.displayMetrics.density
    }

    companion object {
        fun install(act: Activity, webView: WebView): ImeFollow {
            val f = ImeFollow(webView)
            val content: View = act.window.decorView.findViewById(android.R.id.content)

            ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
                f.lastInsets = insets
                val visible = insets.isVisible(WindowInsetsCompat.Type.ime())
                val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
                var pass: WindowInsetsCompat = insets
                if (f.deferring && visible) {
                    pass = WindowInsetsCompat.Builder(insets)
                        .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                        .setVisible(WindowInsetsCompat.Type.ime(), false)
                        .build()
                }
                // 子视图（Capacitor SystemBars）在这次分发里才会改 padding，等分发完再读
                v.post {
                    if (!visible) f.basePad = f.parent.paddingBottom
                    if (!f.animating) f.send(if (visible) ime else 0)
                }
                ViewCompat.onApplyWindowInsets(v, pass)
            }

            ViewCompat.setWindowInsetsAnimationCallback(content, object : WindowInsetsAnimationCompat.Callback(
                WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE
            ) {
                override fun onPrepare(animation: WindowInsetsAnimationCompat) {
                    if (animation.typeMask and WindowInsetsCompat.Type.ime() == 0) return
                    // onPrepare 时 root insets 还是旧状态：键盘此刻不可见 ⇒ 这是一次弹出
                    val now = ViewCompat.getRootWindowInsets(content)
                    val showing = now == null || !now.isVisible(WindowInsetsCompat.Type.ime())
                    if (showing) f.basePad = f.parent.paddingBottom
                    f.animating = true
                    f.deferring = showing
                }

                override fun onProgress(
                    insets: WindowInsetsCompat,
                    running: List<WindowInsetsAnimationCompat>
                ): WindowInsetsCompat {
                    for (a in running) {
                        if (a.typeMask and WindowInsetsCompat.Type.ime() != 0) {
                            f.send(insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
                            break
                        }
                    }
                    return insets
                }

                override fun onEnd(animation: WindowInsetsAnimationCompat) {
                    if (animation.typeMask and WindowInsetsCompat.Type.ime() == 0) return
                    val wasDeferring = f.deferring
                    f.deferring = false
                    f.animating = false
                    val now = ViewCompat.getRootWindowInsets(content)
                    if (now != null) {
                        val visible = now.isVisible(WindowInsetsCompat.Type.ime())
                        if (!visible) f.basePad = f.parent.paddingBottom
                        f.send(if (visible) now.getInsets(WindowInsetsCompat.Type.ime()).bottom else 0)
                    }
                    // 弹出动画结束：把压着没发的 insets 重新分发，WebView 这一帧才缩到键盘之上
                    if (wasDeferring && f.lastInsets != null) {
                        ViewCompat.dispatchApplyWindowInsets(content, f.lastInsets)
                    }
                }
            })
            return f
        }
    }

    /** imePx：键盘当前占屏幕底部的像素；页面收到的是扣掉 basePad 后的 CSS px */
    private fun send(imePx: Int) {
        val kb = max(0, imePx - basePad)
        if (kb == lastSent) return
        lastSent = kb
        val js = String.format(Locale.US, "window.__ttIme&&window.__ttIme(%.2f)", kb / density)
        webView.evaluateJavascript(js, null)
    }
}
