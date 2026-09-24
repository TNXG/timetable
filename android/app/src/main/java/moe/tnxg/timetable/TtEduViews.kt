package moe.tnxg.timetable

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.util.Base64
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.webkit.WebViewCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import java.io.ByteArrayOutputStream
import java.util.Locale

/* ---------------- 视图 ---------------- */

@SuppressLint("SetJavaScriptEnabled")
internal fun TtEdu.configure(w: WebView) {
    val s = w.settings
    s.javaScriptEnabled = true
    s.domStorageEnabled = true
    s.useWideViewPort = true
    s.loadWithOverviewMode = true
    s.builtInZoomControls = true
    s.displayZoomControls = false
    s.setSupportMultipleWindows(false)
    s.javaScriptCanOpenWindowsAutomatically = false
    s.mediaPlaybackRequiresUserGesture = true
    s.allowFileAccess = false
    s.allowContentAccess = false
    s.saveFormData = false
    s.cacheMode = WebSettings.LOAD_NO_CACHE
    s.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    val cm = cookies(w)
    cm.setAcceptCookie(true)
    cm.setAcceptThirdPartyCookies(w, true)
}

/** 该 WebView 所属 Profile 的 CookieManager；老 WebView 为全局单例 */
internal fun cookies(w: WebView): CookieManager {
    if (multiProfile()) {
        try {
            return WebViewCompat.getProfile(w).cookieManager
        } catch (ignored: Exception) {
        }
    }
    return CookieManager.getInstance()
}

internal fun TtEdu.ensureView(profile: String?) {
    if (web != null) return
    val host = bridge.webView
    val parent = host.parent as ViewGroup
    val c = FrameLayout(context)
    container = c
    // 页面画出首帧前，洞里露的是应用底色而不是白块
    val sp = context.getSharedPreferences("tt.theme", Context.MODE_PRIVATE)
    c.setBackgroundColor(sp.getInt("bg", 0xFFF7F7F6.toInt()))
    painted = false
    c.visibility = if (frameTop < 0) View.INVISIBLE else View.VISIBLE
    c.setPadding(0, Math.max(0, frameTop), 0, Math.max(0, frameBottom))
    val wv = WebView(context)
    web = wv
    profileName = null
    var viaProfile = false
    // Profile 必须在首次导航前指定
    if (profile != null && !profile.isEmpty() && multiProfile()) {
        try {
            WebViewCompat.setProfile(wv, profile)
            profileName = profile
            viaProfile = profileHeader(profile)
        } catch (ignored: Exception) {
        }
    }
    wv.isFocusable = true
    wv.isFocusableInTouchMode = true
    configure(wv)
    wv.addJavascriptInterface(Bridge(this), "TtBridge")
    wv.webViewClient = Client(this, !viaProfile)
    wv.webChromeClient = Chrome(this)
    c.addView(wv, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    val idx = Math.max(0, parent.indexOfChild(host))
    parent.addView(c, idx, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    host.setOnTouchListener { v, ev -> route(v, ev) }
    applyTransparency()
}

internal fun TtEdu.teardown(keepSession: Boolean) {
    val host = bridge.webView
    host.setOnTouchListener(null)
    routing = false
    restoreTransparency()
    val w = web
    if (w != null) {
        val c = container
        val fin = Runnable {
            w.stopLoading()
            w.loadUrl("about:blank")
            w.clearHistory()
            w.clearCache(true)
            w.clearFormData()
            w.removeJavascriptInterface("TtBridge")
            if (c != null && c.parent is ViewGroup) {
                (c.parent as ViewGroup).removeView(c)
            }
            w.destroy()
        }
        if (keepSession) {
            cookies(w).flush()
            fin.run()
        } else {
            clearSession(fin)
        }
        web = null
        container = null
    }
    frameTop = -1
    keep.clear()
}

/**
 * 清当前 Profile 的 Cookie（老 WebView 为全局，应用自身不用 Cookie）；有页面在时先清它的本地存储。
 * then 在 Cookie 真正清完后才跑，随后的 loadUrl 不会带着旧会话发出去。
 */
internal fun TtEdu.clearSession(then: Runnable?) {
    val cm = if (web != null) cookies(web!!) else CookieManager.getInstance()
    val clearCookies = Runnable {
        cm.removeAllCookies { _ ->
            cm.flush()
            then?.run()
        }
    }
    val w = web
    if (w != null && w.url != null) {
        w.evaluateJavascript("try{localStorage.clear();sessionStorage.clear()}catch(e){}") { clearCookies.run() }
    } else {
        clearCookies.run()
    }
}

internal fun TtEdu.bgTeardown() {
    val w = bg ?: return
    bg = null
    w.stopLoading()
    w.loadUrl("about:blank")
    w.removeJavascriptInterface("TtBridge")
    if (w.parent is ViewGroup) (w.parent as ViewGroup).removeView(w)
    w.destroy()
}

/* ---------------- 应用 WebView 透明（下面的学校页面才看得见） ---------------- */

private fun miui(): Boolean {
    val m = Build.MANUFACTURER?.lowercase(Locale.US) ?: ""
    val b = Build.BRAND?.lowercase(Locale.US) ?: ""
    return m.contains("xiaomi") || b.contains("xiaomi") || b.contains("redmi") || b.contains("poco")
}

private fun fullStack(): Boolean {
    val m = Build.MANUFACTURER?.lowercase(Locale.US) ?: ""
    val b = Build.BRAND?.lowercase(Locale.US) ?: ""
    return miui() || m.contains("huawei") || m.contains("honor") || b.contains("huawei") || b.contains("honor")
}

internal fun TtEdu.applyTransparency() {
    if (web == null) return
    val host = bridge.webView
    val parent = host.parent as View?
    val win = activity.window
    if (!transparent) {
        hostBg = host.background
        hostAlpha = host.alpha
        parentBg = parent?.background
        windowBg = win.decorView.background
        transparent = true
    }
    // 小米 / 华为系的合成器会把全透明 WebView 优化掉，留 1/255 的 alpha（做法同 capacitor-inappbrowser）
    if (fullStack()) {
        win.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        parent?.setBackgroundColor(Color.TRANSPARENT)
    }
    host.setBackgroundColor(if (miui()) Color.argb(1, 255, 255, 255) else Color.TRANSPARENT)
    host.alpha = if (miui()) 0.99f else hostAlpha
}

internal fun TtEdu.restoreTransparency() {
    if (!transparent) return
    transparent = false
    val host = bridge.webView
    val parent = host.parent as View?
    host.background = hostBg
    host.alpha = hostAlpha
    parent?.background = parentBg
    activity.window.setBackgroundDrawable(windowBg)
    ThemeApply.applySaved(activity, host)
}

/* ---------------- 触摸转发 ---------------- */

internal fun TtEdu.inHole(x: Float, y: Float): Boolean {
    if (!interactive || frameTop < 0 || web == null) return false
    val h = bridge.webView.height
    if (y < frameTop || y > h - frameBottom) return false
    for (r in keep) {
        if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return false
    }
    return true
}

/** 应用 WebView 的触摸：按下落在透明区域就把整段手势交给下面的页面 */
internal fun TtEdu.route(v: View, ev: MotionEvent): Boolean {
    val a = ev.actionMasked
    if (a == MotionEvent.ACTION_DOWN) routing = inHole(ev.x, ev.y)
    if (!routing || web == null) return false
    val copy = MotionEvent.obtain(ev)
    copy.offsetLocation(0f, (-Math.max(0, frameTop)).toFloat())
    web!!.dispatchTouchEvent(copy)
    copy.recycle()
    if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) routing = false
    return true
}

/* ---------------- 快照编码 ---------------- */

internal fun drawInto(v: View, bmp: Bitmap) {
    val c = Canvas(bmp)
    c.scale(bmp.width.toFloat() / Math.max(1, v.width), bmp.height.toFloat() / Math.max(1, v.height))
    v.draw(c)
}

internal fun encode(bmp: Bitmap, call: PluginCall) {
    Thread {
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 78, out)
        bmp.recycle()
        val o = JSObject()
        o.put("src", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
        call.resolve(o)
    }.start()
}
