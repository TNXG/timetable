package app.timetable

import android.graphics.*
import android.os.*
import android.view.*
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.webkit.WebViewCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * 教务导入用的内置浏览器。
 * <p>
 * 学校页面放在一个独立 WebView 里，叠在应用 WebView <b>下面</b>；应用 WebView 在这段时间透明，
 * 页面自己在中间留出一块透明区域（frame），地址栏、悬浮胶囊、选学期抽屉照常由页面画在上面。
 * 落在透明区域里的触摸（除去 keep 列出的胶囊等区域）原样转发给下面的 WebView。
 * <p>
 * 会话隔离：支持多 Profile 的系统 WebView 上每所学校一个 Profile（Cookie / 存储与应用及其他学校互不相通），
 * 默认打开与关闭都清 Cookie 与本地存储；用户开了「保持登录」才保留该 Profile（只有 Cookie，不存账号密码），
 * 「退出登录」整个删掉。不支持多 Profile 的老 WebView 退回全局 CookieManager 全清，不提供保持登录。
 * 页面里的脚本只在用户点「导入」等操作时通过 eval 注入，结果经 TtBridge.post 回传。
 * <p>
 * 自动更新用另一个不可见的 WebView（bg*）：同一 Profile 打开课表页，页面完成后由 JS 侧决定是否还在登录态并注入同一套脚本。
 * <p>
 * 请求头：WebView 会给每个请求补一个 X-Requested-With: 应用包名，没有关闭它的接口。强智等教务把带这个头的请求
 * 一律当 AJAX：未登录时不跳登录页而是直接回一段 JSON（还没有 Content-Type，页面上就是乱码）。WebView 只在请求
 * 没带该头时才补包名，所以这里给它一个空值，服务器看到的就与普通浏览器一致：支持 CUSTOM_REQUEST_HEADERS 的 WebView
 * 用 Profile 的自定义请求头覆盖该学校的全部请求；老 WebView 退回到在 shouldOverrideUrlLoading 里把主文档导航带头重发。
 */
@CapacitorPlugin(name = "TtEdu")
class TtEdu : Plugin() {

    internal var container: FrameLayout? = null
    internal var web: WebView? = null
    internal var density = 1f
    /** 透明区域（设备像素，相对 WebView 顶/底） */
    internal var frameTop = -1
    internal var frameBottom = 0
    internal val keep = ArrayList<int[]>()
    internal var interactive = true
    internal var routing = false
    internal var transparent = false
    internal var painted = false
    internal var hostBg: android.graphics.drawable.Drawable? = null
    internal var parentBg: android.graphics.drawable.Drawable? = null
    internal var windowBg: android.graphics.drawable.Drawable? = null
    internal var hostAlpha = 1f
    /** 当前页面用的 Profile；null 为默认 Profile（老 WebView） */
    internal var profileName: String? = null
    /** 自动更新用的不可见 WebView */
    internal var bg: WebView? = null

    override fun load() {
        density = context.resources.displayMetrics.density
    }

    /* ---------------- 页面接口 ---------------- */

    /** profile：每所学校一个；keep=true 时不清上次会话（直登刚建立的会话也靠它传给页面） */
    @PluginMethod
    fun open(call: PluginCall) {
        val url = call.getString("url", "")
        val profile = call.getString("profile")
        val keep = call.getBoolean("keep", false) == true
        if (url == null || url.isEmpty()) {
            call.reject("url required")
            return
        }
        activity.runOnUiThread {
            try {
                ensureView(profile)
                val w = web
                val go = Runnable {
                    if (w === web) w!!.loadUrl(url, navHeaders(null))
                }
                if (keep) go.run() else clearSession(go)
                val o = JSObject()
                o.put("persistent", profileName != null)
                call.resolve(o)
            } catch (e: Exception) {
                call.reject(java.lang.String.valueOf(e.message))
            }
        }
    }

    /** keep=true 时保留该 Profile 的 Cookie / 存储（用户开了保持登录，或直登刚建立的会话） */
    @PluginMethod
    fun close(call: PluginCall) {
        val keep = call.getBoolean("keep", false) == true
        activity.runOnUiThread {
            teardown(keep)
            call.resolve()
        }
    }

    @PluginMethod
    fun profiles(call: PluginCall) {
        val o = JSObject()
        o.put("supported", multiProfile())
        call.resolve(o)
    }

    /** 退出登录：整个删掉该学校的 Profile；正在使用中则删不掉，ok=false */
    @PluginMethod
    fun clearProfile(call: PluginCall) {
        val profile = call.getString("profile", "")
        activity.runOnUiThread {
            var ok = false
            if (profile != null && !profile.isEmpty() && multiProfile()) {
                try {
                    ok = ProfileStore.getInstance().deleteProfile(profile)
                } catch (ignored: Exception) {
                }
            }
            val o = JSObject()
            o.put("ok", ok)
            call.resolve(o)
        }
    }

    /* ---------------- 直登：HTTP 与会话 Cookie（实现在 EduHttp.kt） ---------------- */

    /** 一头一响应、不跟重定向；登录重定向由插件逐跳处理，每跳的 Set-Cookie 都收得到 */
    @PluginMethod
    fun http(call: PluginCall) = EduHttp.request(call)

    /** 登录拿到的会话 Cookie 按网址种进学校 Profile，浏览器打开即已登录 */
    @PluginMethod
    fun setCookies(call: PluginCall) = EduHttp.setCookies(call)

    /** 读 Profile 里的会话 Cookie 给插件做「会话还活着吗」探测 */
    @PluginMethod
    fun getCookies(call: PluginCall) = EduHttp.getCookies(call)

    /* ---------------- 自动更新：不可见 WebView ---------------- */

    @PluginMethod
    fun bgOpen(call: PluginCall) {
        val url = call.getString("url", "")
        val profile = call.getString("profile")
        if (url == null || url.isEmpty()) {
            call.reject("url required")
            return
        }
        activity.runOnUiThread {
            try {
                bgTeardown()
                val host = bridge.webView
                val parent = host.parent as ViewGroup
                val w = WebView(context)
                var viaProfile = false
                if (profile != null && !profile.isEmpty() && multiProfile()) {
                    WebViewCompat.setProfile(w, profile)
                    viaProfile = profileHeader(profile)
                }
                configure(w)
                w.addJavascriptInterface(Bridge(this), "TtBridge")
                w.webViewClient = BgClient(this, !viaProfile)
                w.webChromeClient = android.webkit.WebChromeClient()
                w.visibility = View.INVISIBLE
                val dm = context.resources.displayMetrics
                parent.addView(w, 0, ViewGroup.LayoutParams(dm.widthPixels, dm.heightPixels))
                bg = w
                w.loadUrl(url, navHeaders(null))
                call.resolve()
            } catch (e: Exception) {
                call.reject(java.lang.String.valueOf(e.message))
            }
        }
    }

    @PluginMethod
    fun bgEval(call: PluginCall) {
        val js = call.getString("js", "")
        activity.runOnUiThread {
            if (bg == null || js == null) {
                call.reject("closed")
                return@runOnUiThread
            }
            bg!!.evaluateJavascript(js) { v ->
                val o = JSObject()
                o.put("value", v ?: "null")
                call.resolve(o)
            }
        }
    }

    @PluginMethod
    fun bgClose(call: PluginCall) {
        activity.runOnUiThread {
            bgTeardown()
            call.resolve()
        }
    }

    @PluginMethod
    fun navigate(call: PluginCall) {
        val url = call.getString("url", "")
        activity.runOnUiThread {
            if (web != null && url != null && !url.isEmpty()) web!!.loadUrl(url, navHeaders(null))
            call.resolve()
        }
    }

    @PluginMethod
    fun reload(call: PluginCall) {
        activity.runOnUiThread {
            if (web != null) web!!.reload()
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread {
            if (web != null) {
                web!!.stopLoading()
                emit(false, 100)
            }
            call.resolve()
        }
    }

    /** 学校页面当前画面的定格（半分辨率 JPEG data URL）；页面退场时贴在透明洞里一起滑走 */
    @PluginMethod
    fun snapshot(call: PluginCall) {
        activity.runOnUiThread {
            if (web == null || web!!.width == 0 || web!!.height == 0) {
                call.reject("closed")
                return@runOnUiThread
            }
            val w = web!!
            val sw = w.width
            val sh = w.height
            val bmp = Bitmap.createBitmap(Math.max(1, sw / 2), Math.max(1, sh / 2), Bitmap.Config.ARGB_8888)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val loc = IntArray(2)
                w.getLocationInWindow(loc)
                val src = Rect(loc[0], loc[1], loc[0] + sw, loc[1] + sh)
                try {
                    PixelCopy.request(activity.window, src, bmp, { res ->
                        if (res != PixelCopy.SUCCESS) drawInto(w, bmp)
                        encode(bmp, call)
                    }, Handler(Looper.getMainLooper()))
                    return@runOnUiThread
                } catch (ignored: Exception) {
                }
            }
            drawInto(w, bmp)
            encode(bmp, call)
        }
    }

    @PluginMethod
    fun back(call: PluginCall) {
        activity.runOnUiThread {
            val went = web != null && web!!.canGoBack()
            if (went) web!!.goBack()
            val o = JSObject()
            o.put("went", went)
            call.resolve(o)
        }
    }

    /** 透明区域与其中保留给页面自己的矩形，单位 CSS px；interactive=false 时触摸一律留在页面（抽屉打开时） */
    @PluginMethod
    fun frame(call: PluginCall) {
        val top = call.getDouble("top", -1.0)
        val bottom = call.getDouble("bottom", 0.0)
        val inter = call.getBoolean("interactive", true) == true
        val arr = call.getArray("keep")
        val rects = ArrayList<int[]>()
        if (arr != null) {
            try {
                for (i in 0 until arr.length()) {
                    val r = arr.getJSONObject(i)
                    rects.add(intArrayOf(
                            px(r.optDouble("x", 0.0)), px(r.optDouble("y", 0.0)),
                            px(r.optDouble("x", 0.0) + r.optDouble("w", 0.0)), px(r.optDouble("y", 0.0) + r.optDouble("h", 0.0))))
                }
            } catch (ignored: Exception) {
            }
        }
        activity.runOnUiThread {
            frameTop = if (top < 0) -1 else px(top)
            frameBottom = px(bottom)
            keep.clear()
            keep.addAll(rects)
            interactive = inter
            if (container != null) {
                container!!.setPadding(0, Math.max(0, frameTop), 0, Math.max(0, frameBottom))
                container!!.visibility = if (frameTop < 0) View.INVISIBLE else View.VISIBLE
            }
            applyTransparency()
            call.resolve()
        }
    }

    /** 在学校页面里执行脚本；同步返回值以 JSON 字符串给回，异步结果走 TtBridge.post → message 事件 */
    @PluginMethod
    fun eval(call: PluginCall) {
        val js = call.getString("js", "")
        activity.runOnUiThread {
            if (web == null || js == null) {
                call.reject("closed")
                return@runOnUiThread
            }
            web!!.evaluateJavascript(js) { v ->
                val o = JSObject()
                o.put("value", v ?: "null")
                call.resolve(o)
            }
        }
    }

    @PluginMethod
    fun state(call: PluginCall) {
        activity.runOnUiThread { call.resolve(snapshot(false, 100)) }
    }

    /* ---------------- 内部辅助 ---------------- */

    private fun px(css: Double): Int {
        return Math.round(css * density).toInt()
    }

    internal fun snapshot(loading: Boolean, progress: Int): JSObject {
        val o = JSObject()
        val url = web?.url
        val title = web?.title
        o.put("url", url ?: "")
        o.put("title", title ?: "")
        o.put("loading", loading)
        o.put("progress", progress)
        o.put("canGoBack", web != null && web!!.canGoBack())
        o.put("painted", painted)
        return o
    }

    internal fun emit(loading: Boolean, progress: Int) {
        notifyListeners("nav", snapshot(loading, progress))
    }

    /** Kotlin 顶层类访问不到 protected 的 notifyListeners，给 TtEduClients.kt 里的回调类转发用 */
    internal fun notifyEvent(name: String, data: JSObject) {
        notifyListeners(name, data)
    }
}
