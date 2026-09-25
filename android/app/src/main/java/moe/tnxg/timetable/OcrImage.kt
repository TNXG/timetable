package moe.tnxg.timetable

import kotlin.math.floor

/**
 * 验证码 OCR 的图像预处理，与 ddddocr 默认模型同一套参数：
 * 灰度（PIL 'L' 同系数）→ 保持宽高比缩放到高 64（Catmull-Rom 双三次）→ /255 排成 NCHW。
 * 纯 JVM 实现（不碰 Android API），单元测试可与 Python 参考实现逐项核对。
 */
internal object OcrImage {
    /** 模型输入高度：ddddocr 默认模型固定 64 */
    const val HEIGHT = 64

    /** 灰度系数取 ITU-R 601-2，与 PIL convert('L') 一致；只算 [fromX, toX) 这几列 */
    fun gray(pixels: IntArray, width: Int, fromX: Int, toX: Int): FloatArray {
        val rows = pixels.size / width
        val out = FloatArray(rows * (toX - fromX))
        for (y in 0 until rows) {
            val src = y * width
            val dst = y * (toX - fromX)
            for (x in fromX until toX) {
                val p = pixels[src + x]
                out[dst + x - fromX] = 0.299f * ((p shr 16) and 0xFF) + 0.587f * ((p shr 8) and 0xFF) + 0.114f * (p and 0xFF)
            }
        }
        return out
    }

    /** 目标宽度与 ddddocr 一致：int(width * 64 / height)，截断且至少 1 */
    fun widthFor(width: Int, height: Int): Int =
        maxOf(1, floor(width * HEIGHT.toDouble() / maxOf(1, height)).toInt())

    /**
     * ARGB 像素（可只取 [fromX, toX) 列）→ 归一化灰度张量（1×1×64×W 的扁平 float）。
     * 两次分离卷积都按 8 位量化中间结果，和 Pillow 的 8bpc 重采样路径对齐。
     */
    fun tensor(pixels: IntArray, width: Int, height: Int, fromX: Int = 0, toX: Int = width): FloatArray {
        require(width > 0 && height > 0 && pixels.size >= width * height) { "图像尺寸不对" }
        val x0 = fromX.coerceIn(0, width - 1)
        val x1 = toX.coerceIn(x0 + 1, width)
        val cw = x1 - x0
        val outW = widthFor(cw, height)
        val src = gray(pixels, width, x0, x1)
        val hx = taps(cw, outW)
        val mid = FloatArray(height * outW)
        for (y in 0 until height) {
            val row = y * cw
            val dst = y * outW
            for (x in 0 until outW) {
                val from = hx.first[x]
                val to = from + hx.count(x)
                var acc = 0.0
                for (i in from until to) {
                    val xi = if (i < 0) 0 else if (i >= cw) cw - 1 else i
                    acc += src[row + xi] * hx.weight(x, i)
                }
                mid[dst + x] = quantize(acc)
            }
        }
        val vy = taps(height, HEIGHT)
        val out = FloatArray(HEIGHT * outW)
        for (y in 0 until HEIGHT) {
            val from = vy.first[y]
            val to = from + vy.count(y)
            val dst = y * outW
            for (x in 0 until outW) {
                var acc = 0.0
                for (i in from until to) {
                    val yi = if (i < 0) 0 else if (i >= height) height - 1 else i
                    acc += mid[yi * outW + x] * vy.weight(y, i)
                }
                out[dst + x] = quantize(acc) / 255f
            }
        }
        return out
    }

    /** Pillow 把中间结果裁到 0..255 并四舍五入 */
    private fun quantize(v: Double): Float = v.toFloat().coerceIn(0f, 255f).let { floor(it + 0.5f) }

    /** Catmull-Rom（a=-0.5，支撑 2）核 */
    private fun cubic(x: Double): Double {
        val a = if (x < 0) -x else x
        return when {
            a < 1.0 -> (1.5 * a - 2.5) * a * a + 1.0
            a < 2.0 -> ((-0.5 * a + 2.5) * a - 4.0) * a + 2.0
            else -> 0.0
        }
    }

    /** 一条轴上的重采样抽头：与 Pillow 一样把核按边界截断后再归一化 */
    private class Taps(private val firsts: IntArray, private val offs: IntArray, private val weights: FloatArray) {
        val first: IntArray get() = firsts
        fun count(o: Int): Int = offs[o + 1] - offs[o]
        fun weight(o: Int, srcIndex: Int): Float = weights[offs[o] + (srcIndex - firsts[o])]
    }

    private fun taps(inSize: Int, outSize: Int): Taps {
        val scale = inSize.toDouble() / outSize
        val filterScale = if (scale < 1.0) 1.0 else scale
        val support = 2.0 * filterScale
        val firsts = IntArray(outSize)
        val offs = IntArray(outSize + 1)
        val weights = ArrayList<Float>(outSize * 4)
        for (o in 0 until outSize) {
            val center = (o + 0.5) * scale
            var lo = floor(center - support + 0.5).toInt()
            var hi = floor(center + support + 0.5).toInt()
            if (lo < 0) lo = 0
            if (hi > inSize) hi = inSize
            if (lo >= inSize) lo = inSize - 1
            if (hi <= lo) hi = lo + 1
            firsts[o] = lo
            val span = hi - lo
            val raw = DoubleArray(span)
            var sum = 0.0
            for (k in 0 until span) {
                raw[k] = cubic((lo + k - center + 0.5) / filterScale)
                sum += raw[k]
            }
            val inv = if (sum != 0.0) 1.0 / sum else 0.0
            for (k in 0 until span) weights.add((raw[k] * inv).toFloat())
            offs[o + 1] = weights.size
        }
        return Taps(firsts, offs, weights.toFloatArray())
    }
}
