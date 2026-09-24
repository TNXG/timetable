package app.timetable

import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.JSObject
import androidx.webkit.CustomHeader
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewFeature
import java.util.Collections

private const val XRW = "X-Requested-With"

/** 主文档导航用的请求头；referer 为发起页（WebView 会按默认 referrer policy 裁剪） */
internal fun navHeaders(referer: String?): Map<String, String> {
    val h = HashMap<String, String>()
    h[XRW] = ""
    if (referer != null && (referer.startsWith("http://") || referer.startsWith("https://"))) {
        h["Referer"] = referer
    }
    return h
}

internal fun multiProfile(): Boolean {
    return try {
        WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)
    } catch (t: Throwable) {
        false
    }
}

/**
 * 给该 Profile 的所有 http(s) 请求（主文档、子框、XHR、POST）带空值 X-Requested-With；页面自己设了的不覆盖。
 * 需要 WebView 支持 CUSTOM_REQUEST_HEADERS；不支持返回 false，由 {@link NavHeaderClient} 重发主文档导航兼容。
 */
internal fun profileHeader(profile: String): Boolean {
    return try {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.CUSTOM_REQUEST_HEADERS)) return false
        val p = ProfileStore.getInstance().getOrCreateProfile(profile)
        p.addCustomHeader(CustomHeader(XRW, "", Collections.singleton("*")))
        true
    } catch (t: Throwable) {
        false
    }
}

/**
 * shouldOverrideUrlLoading 的公共处理。reissue=true（Profile 请求头不可用）时，页面发起的 http(s) 主文档 GET 导航
 * （含 POST 登录后的 302）取消掉，换成带 {@link TtEdu#navHeaders} 的重发；应用自己 loadUrl 的导航 WebView 不会再回调，
 * 不会递归。非 http(s) 协议一律吞掉（不外跳）。
 */
internal open class NavHeaderClient(private val reissue: Boolean) : WebViewClient() {
    /** 连续重发的重定向次数；非重定向导航或页面完成时归零 */
    private var redirects = 0

    override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
        if (!isHttp(req.url.scheme)) return true
        if (!reissue || !req.isForMainFrame) return false
        if (req.isRedirect) {
            if (++redirects > MAX_REDIRECTS) return false
        } else {
            redirects = 0
        }
        view.loadUrl(req.url.toString(), navHeaders(view.url))
        return true
    }

    override fun onPageFinished(view: WebView, url: String) {
        redirects = 0
    }

    companion object {
        /** 与 Chromium 一致的重定向上限，防止「重定向到自身」时无限重发 */
        private const val MAX_REDIRECTS = 20

        private fun isHttp(scheme: String?): Boolean {
            return "http" == scheme || "https" == scheme
        }
    }
}

internal class Client(private val t: TtEdu, reissue: Boolean) : NavHeaderClient(reissue) {
    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        t.emit(true, 0)
    }

    override fun onPageCommitVisible(view: WebView, url: String) {
        if (t.painted) return
        t.painted = true
        t.emit(view.progress < 100, view.progress)
    }

    override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        t.painted = true
        t.emit(false, 100)
    }

    override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
        if (!req.isForMainFrame) return
        val o = t.snapshot(false, 100)
        o.put("error", java.lang.String.valueOf(err.description))
        t.notifyEvent("nav", o)
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        val o = t.snapshot(false, 100)
        o.put("error", "ssl")
        t.notifyEvent("nav", o)
    }
}

/** 不可见 WebView 的导航：只报主文档完成 / 失败，登录态由 JS 侧按地址与标题判断 */
internal class BgClient(private val t: TtEdu, reissue: Boolean) : NavHeaderClient(reissue) {
    private fun report(view: WebView, error: String?) {
        if (view !== t.bg) return
        val o = JSObject()
        val url = view.url
        val title = view.title
        o.put("url", url ?: "")
        o.put("title", title ?: "")
        if (error != null) o.put("error", error)
        t.notifyEvent("bgNav", o)
    }

    override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        report(view, null)
    }

    override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
        if (req.isForMainFrame) report(view, java.lang.String.valueOf(err.description))
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        report(view, "ssl")
    }
}

internal class Chrome(private val t: TtEdu) : WebChromeClient() {
    override fun onProgressChanged(view: WebView, p: Int) {
        t.emit(p < 100, p)
    }

    override fun onReceivedTitle(view: WebView, title: String?) {
        t.emit(view.progress < 100, view.progress)
    }
}

internal class Bridge(private val t: TtEdu) {
    @JavascriptInterface
    fun post(data: String?) {
        val o = JSObject()
        o.put("data", data ?: "")
        t.notifyEvent("message", o)
    }
}
