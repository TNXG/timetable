package moe.tnxg.timetable

import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.providers.NNAPIFlags
import android.content.Context
import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.EnumSet

/**
 * 验证码 OCR 桥：把 data URI / base64 图片交给本地 ONNX 模型，回识别出的文字。
 * 图片只在内存里过一道，不落盘、不上传；模型随包分发（ddddocr，MIT）。
 */
@CapacitorPlugin(name = "TtOcr")
class TtOcr : Plugin() {

    /** { image, view } → { text, provider }；view = 0 原图 / 1 裁掉两端噪声，provider = nnapi / cpu */
    @PluginMethod
    fun recognize(call: PluginCall) {
        val image = call.getString("image")
        if (image.isNullOrBlank()) {
            call.reject("缺少图片")
            return
        }
        val view = call.getInt("view") ?: 0
        val app = context.applicationContext
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val r = withContext(Dispatchers.Default) {
                    val pixels = decode(image)
                    val engine = OcrEngine.shared(app)
                    val text = engine.recognize(pixels.first, pixels.second, pixels.third, view)
                    text to engine.provider
                }
                call.resolve(JSObject().put("text", r.first).put("provider", r.second))
            } catch (t: Throwable) {
                call.reject(t.message ?: "识别失败")
            }
        }
    }

    /**
     * 调试页用：当前会话后端 + 新建会话实跑（NNAPI 仅加速器 / NNAPI 可回退 / CPU）+ 推理内核信息。
     * 每次调用都会新建三个会话、各跑三次推理，只在调试入口里触发。
     */
    @PluginMethod
    fun diagnose(call: PluginCall) {
        val app = context.applicationContext
        CoroutineScope(Dispatchers.Main).launch {
            try {
                call.resolve(withContext(Dispatchers.Default) { report(app) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "探测失败")
            }
        }
    }

    private fun report(app: Context): JSObject {
        val engine = OcrEngine.shared(app)
        val built = JSArray()
        for (p in OrtEnvironment.getAvailableProviders()) built.put(p.name)
        return JSObject()
            .put("provider", engine.provider)
            .put("providers", built)
            .put("ort", OrtEnvironment.getEnvironment().version)
            .put("strict", bench(engine.bench(EnumSet.of(NNAPIFlags.CPU_DISABLED))))
            .put("nnapi", bench(engine.bench(EnumSet.noneOf(NNAPIFlags::class.java))))
            .put("cpu", bench(engine.bench(null)))
    }

    private fun bench(b: OcrBench): JSObject = JSObject()
        .put("ok", b.ok)
        .put("error", b.error)
        .put("createMs", b.createMs)
        .put("firstMs", b.firstMs)
        .put("bestMs", b.bestMs)

    /** data URI 或裸 base64 → ARGB 像素 + 宽高 */
    private fun decode(image: String): Triple<IntArray, Int, Int> {
        val base64 = if (image.startsWith("data:")) image.substringAfter(',', "") else image
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: throw IllegalArgumentException("图片解不开")
        try {
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            return Triple(pixels, bitmap.width, bitmap.height)
        } finally {
            bitmap.recycle()
        }
    }
}
