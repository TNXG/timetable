package app.timetable

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.ImageView

/**
 * 切后台前把 WebView 当前像素拷一份盖在上面，回前台后等 WebView 真正画出新一帧再撤。
 *
 * WebView 在后台会释放合成器资源，回来第一帧常是底色，会闪一下（cordova-android#1282）。
 * 做法和相机 freeze 一样：像素定格 → 内容就绪（postVisualStateCallback）→ 下一帧撤掉。
 */
class ResumeCover(private val act: Activity, private val webView: WebView) {

    private val main = Handler(Looper.getMainLooper())
    private var cover: ImageView? = null
    private var paused = false
    private var seq = 0L

    /** onPause：抓当前帧。异步拷贝，拷完若还在后台就盖上。 */
    fun capture() {
        paused = true
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val w = webView.width
        val h = webView.height
        if (w <= 0 || h <= 0 || cover != null) return
        val loc = IntArray(2)
        webView.getLocationInWindow(loc)
        val src = Rect(loc[0], loc[1], loc[0] + w, loc[1] + h)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        try {
            PixelCopy.request(act.window, src, bmp, { result ->
                if (result != PixelCopy.SUCCESS || !paused || cover != null || act.isFinishing) {
                    bmp.recycle()
                    return@request
                }
                val parent = webView.parent as? ViewGroup
                if (parent == null) {
                    bmp.recycle()
                    return@request
                }
                val iv = ImageView(act)
                iv.scaleType = ImageView.ScaleType.FIT_XY
                iv.setImageBitmap(bmp)
                iv.isClickable = false
                iv.isFocusable = false
                parent.addView(iv, ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                cover = iv
            }, main)
        } catch (ignored: IllegalArgumentException) {
            bmp.recycle()
        }
    }

    /** onResume：等 WebView 报告新内容可画，再过一帧撤掉定格；兜底超时。 */
    fun release() {
        paused = false
        if (cover == null) return
        seq += 1
        val id = seq
        val remove = Runnable { if (id == seq) removeCover() }
        webView.postVisualStateCallback(id, object : WebView.VisualStateCallback() {
            override fun onComplete(requestId: Long) {
                if (requestId != id) return
                webView.postOnAnimation { webView.postOnAnimation(remove) }
            }
        })
        main.postDelayed(remove, FALLBACK_MS)
    }

    private fun removeCover() {
        val iv = cover
        cover = null
        if (iv == null) return
        val p = iv.parent as? ViewGroup
        if (p != null) p.removeView(iv)
        iv.setImageDrawable(null)
    }

    companion object {
        private const val FALLBACK_MS = 800L
    }
}
