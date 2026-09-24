package app.timetable

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Parcelable

import androidx.core.content.FileProvider

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets

/**
 * 课表文件进出：
 * - share：把 .ics 文本写进缓存目录，经 FileProvider 交给系统分享面板
 * - 收到 .ics（ACTION_VIEW / ACTION_SEND）：读出文本，页面在就推给页面，不在就先存着等页面来取
 */
@CapacitorPlugin(name = "TtFiles")
class TtFiles : Plugin() {

    companion object {
        /** 收到的文件最多读这么大（课表用不到更大） */
        private const val MAX_BYTES = 4 * 1024 * 1024

        @Volatile
        private var instance: TtFiles? = null

        @Volatile
        private var pending: JSObject? = null

        /** MainActivity 在 onCreate / onNewIntent 里调用 */
        @JvmStatic
        fun handleIntent(act: Activity, intent: Intent?) {
            if (intent == null) return
            val action = intent.action
            var uri: Uri? = null
            if (Intent.ACTION_VIEW == action) {
                uri = intent.data
            } else if (Intent.ACTION_SEND == action) {
                val p = intent.getParcelableExtra<Parcelable>(Intent.EXTRA_STREAM)
                if (p is Uri) uri = p
            }
            if (uri == null) return
            val scheme = uri.scheme
            if ("content" != scheme && "file" != scheme) return
            // 同一个 Intent 被 resume 再送一次时不重复处理
            intent.setData(null)
            intent.removeExtra(Intent.EXTRA_STREAM)

            val text = readText(act.contentResolver, uri) ?: return
            val o = JSObject()
            o.put("text", text)
            o.put("name", uri.lastPathSegment ?: "")
            val p = instance
            if (p != null && p.hasListeners("incoming")) {
                act.runOnUiThread { p.notifyListeners("incoming", o) }
            } else {
                pending = o
            }
        }

        private fun readText(cr: ContentResolver, uri: Uri): String? {
            try {
                cr.openInputStream(uri).use { input ->
                    if (input == null) return null
                    val buf = ByteArrayOutputStream()
                    val chunk = ByteArray(16 * 1024)
                    while (true) {
                        val n = input.read(chunk)
                        if (n <= 0) break
                        buf.write(chunk, 0, n)
                        if (buf.size() > MAX_BYTES) return null
                    }
                    return String(buf.toByteArray(), StandardCharsets.UTF_8)
                }
            } catch (e: Exception) {
                return null
            }
        }
    }

    override fun load() {
        instance = this
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val text = call.getString("text", "")
        val name = call.getString("name", "timetable.ics")
        val mime = call.getString("mime", "text/calendar")
        try {
            val dir = File(context.cacheDir, "share")
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("mkdir failed")
                return
            }
            val olds = dir.listFiles()
            if (olds != null) for (old in olds) old.delete()
            val f = File(dir, name!!.replace(Regex("[\\\\/:*?\"<>|]"), " ").trim())
            FileOutputStream(f).use { out ->
                out.write(text!!.toByteArray(StandardCharsets.UTF_8))
            }
            val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", f)
            val send = Intent(Intent.ACTION_SEND)
            send.type = mime
            send.putExtra(Intent.EXTRA_STREAM, uri)
            send.putExtra(Intent.EXTRA_SUBJECT, f.name)
            send.clipData = android.content.ClipData.newRawUri(f.name, uri)
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            activity!!.startActivity(Intent.createChooser(send, null))
            call.resolve()
        } catch (e: Exception) {
            call.reject(String.valueOf(e.message))
        }
    }

    /** 页面启动后来取：启动时就带着文件进来的那一次 */
    @PluginMethod
    fun takeIncoming(call: PluginCall) {
        val p = pending
        pending = null
        call.resolve(p ?: JSObject())
    }
}
