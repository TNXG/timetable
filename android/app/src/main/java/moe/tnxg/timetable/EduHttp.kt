package moe.tnxg.timetable

import android.util.Base64
import androidx.webkit.ProfileStore
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * 直登的原生 HTTP 件（软件的通用能力，学校插件借它逐跳登录）：
 * - request：一头一响应、不跟重定向——重定向由插件逐跳处理，才能收到每一跳的 Set-Cookie（TGT、JSESSIONID、route）。
 * - setCookies / getCookies：把插件交回的会话 Cookie 按网址种进学校 Profile 的 CookieManager，
 *   浏览器（含自动更新的不可见页）打开即已登录。老 WebView 退回全局 CookieManager。
 */
internal object EduHttp {
    private const val CONNECT_TIMEOUT = 10_000
    private const val READ_TIMEOUT = 20_000

    internal fun request(call: PluginCall) {
        val url = call.getString("url", "")
        if (url.isNullOrEmpty()) {
            call.reject("url required")
            return
        }
        val method = call.getString("method", "GET") ?: "GET"
        val body = call.getString("body")
        val binary = call.getBoolean("binary", false) == true
        val reqHeaders = call.getObject("headers")
        try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.instanceFollowRedirects = false
            conn.connectTimeout = CONNECT_TIMEOUT
            conn.readTimeout = READ_TIMEOUT
            if (reqHeaders != null) {
                for (k in reqHeaders.keys()) conn.setRequestProperty(k, reqHeaders.getString(k))
            }
            if (body != null) {
                conn.doOutput = true
                if (conn.getRequestProperty("Content-Type") == null) {
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                }
                conn.getOutputStream().use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val input = if (status in 200..399) conn.inputStream else conn.errorStream
            val bytes = input?.readBytes() ?: ByteArray(0)
            val headers = JSObject()
            for ((name, values) in conn.headerFields) {
                if (name == null) continue
                val arr = JSArray()
                for (v in values) arr.put(v ?: "")
                headers.put(name, arr)
            }
            val o = JSObject()
            o.put("status", status)
            o.put("url", conn.url.toString())
            o.put("headers", headers)
            o.put("body", if (binary) Base64.encodeToString(bytes, Base64.NO_WRAP) else String(bytes, Charsets.UTF_8))
            conn.disconnect()
            call.resolve(o)
        } catch (e: Exception) {
            call.reject(e.message ?: "null")
        }
    }

    /** profile 的 CookieManager；老 WebView 为全局单例（应用自身不用 Cookie） */
    private fun manager(profile: String?): android.webkit.CookieManager {
        if (!profile.isNullOrEmpty() && multiProfile()) {
            try {
                return ProfileStore.getInstance().getOrCreateProfile(profile).cookieManager
            } catch (ignored: Exception) {
            }
        }
        return android.webkit.CookieManager.getInstance()
    }

    internal fun setCookies(call: PluginCall) {
        val profile = call.getString("profile", "")
        val url = call.getString("url", "")
        val cookies = call.getArray("cookies")
        if (url.isNullOrEmpty() || cookies == null) {
            call.reject("url / cookies required")
            return
        }
        try {
            val list = cookies.toList<String>()
            val cm = manager(profile)
            for (c in list) cm.setCookie(url, c)
            cm.flush()
            val o = JSObject()
            o.put("ok", true)
            call.resolve(o)
        } catch (e: Exception) {
            call.reject(e.message ?: "null")
        }
    }

    internal fun getCookies(call: PluginCall) {
        val profile = call.getString("profile", "")
        val url = call.getString("url", "")
        if (url.isNullOrEmpty()) {
            call.reject("url required")
            return
        }
        try {
            val cookie = manager(profile).getCookie(url)
            val o = JSObject()
            o.put("cookie", cookie)
            call.resolve(o)
        } catch (e: Exception) {
            call.reject(e.message ?: "null")
        }
    }
}
