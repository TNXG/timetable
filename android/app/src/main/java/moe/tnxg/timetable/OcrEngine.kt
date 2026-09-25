package moe.tnxg.timetable

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.providers.NNAPIFlags
import android.content.Context
import android.util.Log
import java.nio.FloatBuffer
import java.util.EnumSet

/** 一条推理路径的探测结果：建会话 + 实跑；供调试页判断加速器是否真的可用 */
internal data class OcrBench(
    val ok: Boolean,
    val error: String?,
    /** 建会话耗时（毫秒） */
    val createMs: Long,
    /** 首次推理耗时（NNAPI 图上编译都在这里） */
    val firstMs: Long,
    /** 后续两次里最快的一次 */
    val bestMs: Long,
)

/**
 * 验证码 OCR：ddddocr 默认模型（`assets/ocr/captcha.onnx`，MIT）+ ONNX Runtime 本地推理。
 * 优先 NNAPI（设备有 NPU/DSP 时交给系统调度），拿不到或跑不动一律退回 CPU：
 * 会话创建、首次推理任一失败都会重建 CPU 会话重试一次。识别全程离线，图片不出设备。
 *
 * 模型输入 1×1×64×W 灰度，输出 [W,1,C] 分类分数；这里取逐帧 argmax、按 CTC 去重，
 * 只留白名单字符（数字与运算符），其余丢弃——算式解析在 TS 侧（`domain/edu/captcha.ts`）。
 */
internal class OcrEngine(
    private val model: ByteArray,
    charset: String,
    private val useNpu: Boolean,
) {
    private val env: OrtEnvironment = OrtEnvironment.getEnvironment()
    private val table: IntArray = IntArray(CLASSES)
    private var session: OrtSession
    private var inputName: String
    var provider: String = "cpu"
        private set

    init {
        for (line in charset.lineSequence()) {
            val at = line.indexOf('\t')
            if (at <= 0) continue
            val index = line.substring(0, at).trim().toIntOrNull() ?: continue
            val text = line.substring(at + 1)
            if (index in table.indices && text.isNotEmpty()) table[index] = text.codePointAt(0)
        }
        val opened = open()
        session = opened.first
        provider = opened.second
        inputName = session.inputNames.first()
        /* 注意：这里以及构造路径上都不能碰 Android API（Log 也算），JVM 单测会直接构造本类 */
    }

    /** 当前会话的 provider；NPU 不可用时为 cpu */
    private fun open(): Pair<OrtSession, String> {
        if (useNpu) {
            try {
                return create(true) to "nnapi"
            } catch (_: Throwable) {
                /* 没有 NNAPI 实现或模型不支持：降级 */
            }
        }
        return create(false) to "cpu"
    }

    private fun create(nnapi: Boolean): OrtSession {
        val opts = OrtSession.SessionOptions()
        try {
            opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            if (nnapi) opts.addNnapi()
            val s = env.createSession(model, opts)
            return s
        } finally {
            opts.close()
        }
    }

    /** 整图识别：ARGB 像素 → OCR 文本（可能为空串）。
     *  view：0 = 原图；1 = 裁掉左右两端噪声再识别（主视图读不出来时换它，实测只补不回退） */
    fun recognize(pixels: IntArray, width: Int, height: Int, view: Int = 0): String {
        val (left, right) = VIEWS[view.coerceIn(0, VIEWS.size - 1)]
        val data = OcrImage.tensor(
            pixels, width, height,
            fromX = (width * left).toInt(),
            toX = width - (width * right).toInt(),
        )
        return try {
            infer(data)
        } catch (t: Throwable) {
            /* NPU 会话跑不动（算子不支持、驱动异常）：换 CPU 再试一次 */
            if (provider == "cpu") throw t
            Log.i(TAG, "推理失败，退回 CPU：${t.message}")
            val s = create(false)
            session.close()
            session = s
            provider = "cpu"
            infer(data)
        }
    }

    /**
     * 试建一个会话并实跑，回报耗时与异常（调试页用）。flags = null 走纯 CPU；
     * 传 `CPU_DISABLED` 时算子必须全部落在加速器上，跑不过就是加速器跑不动这个模型。
     */
    fun bench(flags: EnumSet<NNAPIFlags>?): OcrBench {
        var createMs = 0L
        try {
            val started = System.nanoTime()
            val probe: OrtSession
            val opts = OrtSession.SessionOptions()
            try {
                opts.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                if (flags != null) opts.addNnapi(flags)
                probe = env.createSession(model, opts)
            } finally {
                opts.close()
            }
            createMs = (System.nanoTime() - started) / 1_000_000
            return probe.use { s ->
                val first = timeOf { run(s, PROBE) }
                val best = (1..2).minOf { timeOf { run(s, PROBE) } }
                OcrBench(true, null, createMs, first, best)
            }
        } catch (t: Throwable) {
            return OcrBench(false, t.message ?: t.javaClass.simpleName, createMs, 0, 0)
        }
    }

    private inline fun timeOf(block: () -> Unit): Long {
        val t = System.nanoTime()
        block()
        return (System.nanoTime() - t) / 1_000_000
    }

    private fun infer(data: FloatArray): String = run(session, data)

    private fun run(session: OrtSession, data: FloatArray): String {
        val width = data.size / OcrImage.HEIGHT
        val shape = longArrayOf(1, 1, OcrImage.HEIGHT.toLong(), width.toLong())
        OnnxTensor.createTensor(env, FloatBuffer.wrap(data), shape).use { input ->
            session.run(mapOf(inputName to input)).use { out ->
                val tensor = out[0] as OnnxTensor
                val dims = tensor.info.shape
                val classes = dims.last().toInt()
                var frames = 1
                for (d in dims) frames *= d.toInt()
                frames /= classes
                return decode(tensor.floatBuffer, frames, classes)
            }
        }
    }

    /** 逐帧 argmax + CTC 去重；不在白名单的字符直接丢 */
    private fun decode(buf: FloatBuffer, frames: Int, classes: Int): String {
        val sb = StringBuilder()
        var prev = -1
        for (t in 0 until frames) {
            val base = t * classes
            var best = 0
            var bestScore = buf.get(base)
            for (c in 1 until classes) {
                val v = buf.get(base + c)
                if (v > bestScore) {
                    bestScore = v
                    best = c
                }
            }
            if (best == prev) continue
            prev = best
            val cp = if (best < table.size) table[best] else 0
            if (cp != 0) sb.appendCodePoint(cp)
        }
        return sb.toString()
    }

    companion object {
        private const val TAG = "TtOcr"
        private const val CLASSES = 8210
        private const val MODEL = "ocr/captcha.onnx"
        private const val CHARSET = "ocr/charset.txt"

        /** 预处理视图：0 = 原图；1 = 左裁 2%、右裁 22%（去掉左边那撇噪声与末尾「=?」） */
        private val VIEWS = arrayOf(0f to 0f, 0.02f to 0.22f)

        /** 探测用的合成图：200×40 的确定性条纹，与真实验证码同尺寸（张量宽 320） */
        private val PROBE by lazy {
            val w = 200
            val h = 40
            val pixels = IntArray(w * h) { i ->
                if (((i / w) + (i % w)) % 7 < 3) 0xFF232323.toInt() else 0xFFFFFFFF.toInt()
            }
            OcrImage.tensor(pixels, w, h)
        }

        @Volatile
        private var shared: OcrEngine? = null

        /** 已经建好的单例（没有就是 null）：调试页拿它看当前会话落在哪个后端 */
        fun live(): OcrEngine? = shared

        /** 进程内单例：13.6MB 模型只读一次、会话只建一次 */
        fun shared(context: Context): OcrEngine = shared ?: synchronized(this) {
            shared ?: OcrEngine(
                model = context.assets.open(MODEL).use { it.readBytes() },
                charset = context.assets.open(CHARSET).use { it.readBytes().decodeToString() },
                useNpu = true,
            ).also {
                shared = it
                Log.i(TAG, "OCR 会话就绪 provider=${it.provider}")
            }
        }
    }
}
