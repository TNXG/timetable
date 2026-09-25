package moe.tnxg.timetable

import org.junit.Assert.assertEquals

import org.junit.Test
import java.io.DataInputStream
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * 真实验证码样本上核对整条本地识别链路：像素 → 预处理（OcrImage）→ ONNX 推理 → CTC 解码。
 * 断言的是「识别文本解出的算式结果」，不是原始文本，模型有细微输出差异时不至于误报。
 * 用例图片来自教务 CAS 的验证码接口（200×40 算式图）。
 */
class OcrEngineTest {

    private val assets = File("src/main/assets/ocr")
    private val engine by lazy {
        OcrEngine(File(assets, "captcha.onnx").readBytes(), File(assets, "charset.txt").readText(), useNpu = false)
    }

    /** 与 TS 侧同一套判定：等号截断，操作数 1..19、结果 0..38，取最长算式 */
    private fun answer(raw: String): Int? {
        val t = buildString {
            for (c in raw) {
                val m = CONFUSABLE[c] ?: c
                if (m in "0123456789+-=?") append(m)
            }
        }.substringBefore('=')
        var best: Int? = null
        var bestLen = 0
        for (m in PATTERN.findAll(t)) {
            val a = m.groupValues[1].toInt()
            val b = m.groupValues[3].toInt()
            if (a !in 1..19 || b !in 1..19) continue
            val v = if (m.groupValues[2] == "+") a + b else a - b
            if (v !in 0..38) continue
            val len = m.value.length
            if (len > bestLen) {
                bestLen = len
                best = v
            }
        }
        return best
    }

    @Test
    fun `真实验证码解出的答案正确`() {
        for ((name, expect) in FIXTURES) {
            val (pixels, w, h) = load(name)
            /* 与登录页同一条阶梯：主视图读不出就换裁切视图 */
            val texts = (0 until VIEWS).map { view -> engine.recognize(pixels, w, h, view) }
            val got = texts.firstNotNullOfOrNull { answer(it) }
            assertEquals("$name 识别为 $texts", expect, got)
        }
    }

    /** 夹具是 gzip 压过的 ARGB 像素（TTOCR1 + 宽 + 高 + 每像素一 int），免依赖图片解码器 */
    private fun load(name: String): Triple<IntArray, Int, Int> {
        DataInputStream(GZIPInputStream(File("src/test/resources/ocr/$name.argb.gz").inputStream())).use { input ->
            val magic = ByteArray(6)
            input.readFully(magic)
            require(magic.decodeToString() == "TTOCR1") { "$name 夹具格式不对" }
            val w = input.readInt()
            val h = input.readInt()
            val pixels = IntArray(w * h)
            for (i in pixels.indices) pixels[i] = input.readInt()
            return Triple(pixels, w, h)
        }
    }

    /** 裁切视图单独覆盖：主视图读不出的样本靠它救回（实测只补、从不错） */
    @Test
    fun `裁切视图能读出主视图认不出的样本`() {
        for ((name, expect) in mapOf("s_2" to 18, "t_29" to 24)) {
            val (pixels, w, h) = load(name)
            assertEquals("$name 裁切视图", expect, answer(engine.recognize(pixels, w, h, 1)))
        }
    }

    companion object {
        private val CONFUSABLE = mapOf(
            'x' to '+', 'X' to '+', '×' to '+', '＊' to '+', '*' to '+', '十' to '+', '＋' to '+',
            '一' to '-', '－' to '-', '—' to '-', 'q' to '?', 'Q' to '?', '﹖' to '?', '？' to '?',
            '~' to ' ', '～' to ' ',
        )
        /** 与 OcrEngine 的 VIEWS 表一致：0 原图、1 裁掉两端噪声 */
        private const val VIEWS = 2
        private val PATTERN = Regex("(\\d{1,2})([+-])(\\d{1,2})")
        private val FIXTURES = mapOf(
            "s_1" to 32, "s_3" to 11, "s_4" to 33, "s_8" to 1, "s_13" to 14, "s_15" to 25,
            "t_18" to 9, "t_22" to 33, "t_24" to 15, "t_33" to 9, "t_35" to 36, "t_41" to 7,
            "t_44" to 0, "t_47" to 15,
            /* 主视图读不出（"76+12-2" / "49x5=2"），靠裁切视图读对 */
            "s_2" to 18, "t_29" to 24,
        )
    }
}
