package app.timetable

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.util.Size
import android.view.View
import android.view.ViewOutlineProvider
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.Result
import com.google.zxing.common.HybridBinarizer
import java.nio.ByteBuffer
import java.util.EnumMap
import java.util.EnumSet
import java.util.concurrent.ExecutorService

/** dp 值按屏幕密度取整 */
fun dpOf(context: Context, v: Double): Int = Math.round(v * context.resources.displayMetrics.density).toInt()

/** 取景容器：叠在 WebView 上方、圆角裁切，里面是预览 + 四角标记 */
class CameraSurface(context: Context) {
    val previewView = PreviewView(context).apply {
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
    }
    val frame = FrameLayout(context).apply {
        isClickable = false
        isFocusable = false
        alpha = 0f
        addView(previewView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        addView(FrameOverlay(context), FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        val radius = dpOf(context, 24.0).toFloat()
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, radius)
            }
        }
        clipToOutline = true
    }

    /** 第一帧到了、且页面推入动画走完，再淡入；不让黑屏/拉伸的中间态露出来 */
    fun observeReveal(owner: LifecycleOwner, revealAt: Long, isActive: () -> Boolean) {
        previewView.previewStreamState.observe(owner) { state ->
            if (state != PreviewView.StreamState.STREAMING || !isActive() || frame.alpha > 0f) return@observe
            val wait = Math.max(0L, revealAt - System.currentTimeMillis())
            frame.postDelayed({
                if (!isActive()) return@postDelayed
                frame.animate().alpha(1f).setDuration(220).start()
            }, wait)
        }
    }

    /** 从父布局摘除（start 重开时拆掉重建，保证从透明淡入） */
    fun detachFromParent() {
        val p = frame.parent
        if (p != null) (p as ViewGroup).removeView(frame)
    }

    fun placeIn(root: ViewGroup, x: Int, y: Int, w: Int, h: Int) {
        root.addView(frame)
        val lp = frame.layoutParams
        lp.width = if (w > 0) w else ViewGroup.LayoutParams.MATCH_PARENT
        lp.height = if (h > 0) h else ViewGroup.LayoutParams.MATCH_PARENT
        if (lp is ViewGroup.MarginLayoutParams) {
            lp.setMargins(x, y, 0, 0)
        }
        if (lp is androidx.coordinatorlayout.widget.CoordinatorLayout.LayoutParams) {
            lp.gravity = android.view.Gravity.TOP or android.view.Gravity.START
        } else if (lp is FrameLayout.LayoutParams) {
            lp.gravity = android.view.Gravity.TOP or android.view.Gravity.START
        }
        frame.layoutParams = lp
    }

    /** 定格用：抓当前预览帧；还没淡入（alpha 为 0）时不算数 */
    fun grabStill(): Bitmap? {
        if (frame.alpha <= 0f) return null
        return try {
            previewView.bitmap
        } catch (ignored: Exception) {
            null
        }
    }

    /** 定格：静态图盖在预览上（同一帧内完成） */
    fun showStill(bmp: Bitmap) {
        val still = ImageView(frame.context)
        still.scaleType = ImageView.ScaleType.CENTER_CROP
        still.setImageBitmap(bmp)
        frame.addView(still, 1, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    }
}

/** 上一次没 stop 干净（比如 freeze 后直接重开）：拆掉重建，保证从透明淡入 */
fun recreateSurface(
        current: CameraSurface?,
        context: Context,
        owner: LifecycleOwner,
        root: ViewGroup,
        x: Int, y: Int, w: Int, h: Int,
        revealAt: Long,
        isActive: (CameraSurface) -> Boolean
): CameraSurface {
    current?.detachFromParent()
    val s = CameraSurface(context)
    s.observeReveal(owner, revealAt) { isActive(s) }
    s.placeIn(root, x, y, w, h)
    return s
}

/** 取景框上的四角标记与上下渐变，和页面里的样式一致 */
class FrameOverlay(context: Context) : View(context) {
    private val corner = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shade = Paint()
    private val path = Path()

    init {
        corner.style = Paint.Style.STROKE
        corner.strokeWidth = dpOf(context, 2.0).toFloat()
        corner.color = Color.argb(204, 255, 255, 255)
        corner.strokeCap = Paint.Cap.BUTT
        corner.strokeJoin = Paint.Join.ROUND
        isClickable = false
    }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        shade.shader = LinearGradient(0f, 0f, 0f, h.toFloat(),
                intArrayOf(Color.argb(64, 0, 0, 0), Color.TRANSPARENT, Color.TRANSPARENT, Color.argb(89, 0, 0, 0)),
                floatArrayOf(0f, .3f, .75f, 1f), Shader.TileMode.CLAMP)
    }

    override fun onDraw(c: Canvas) {
        val w = width
        val h = height
        c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), shade)
        val x = dpOf(context, 20.0) + dpOf(context, 1.0)
        val len = dpOf(context, 24.0).toFloat()
        val r = dpOf(context, 8.0).toFloat()
        drawCorner(c, x.toFloat(), x.toFloat(), 1, 1, len, r)
        drawCorner(c, w - x.toFloat(), x.toFloat(), -1, 1, len, r)
        drawCorner(c, x.toFloat(), h - x.toFloat(), 1, -1, len, r)
        drawCorner(c, w - x.toFloat(), h - x.toFloat(), -1, -1, len, r)
    }

    /** 以 (x, y) 为角点，sx/sy 指向框内的方向，画一段带圆角的 L 形 */
    private fun drawCorner(c: Canvas, x: Float, y: Float, sx: Int, sy: Int, len: Float, r: Float) {
        path.reset()
        path.moveTo(x, y + sy * len)
        path.lineTo(x, y + sy * r)
        path.quadTo(x, y, x + sx * r, y)
        path.lineTo(x + sx * len, y)
        c.drawPath(path, corner)
    }
}

/** 二维码识别：只取 Y 平面做亮度源；解不出就丢帧 */
class BarcodeFrameDecoder {
    private val reader = MultiFormatReader()

    init {
        val hints: MutableMap<DecodeHintType, Any> = EnumMap(DecodeHintType::class.java)
        hints[DecodeHintType.POSSIBLE_FORMATS] = EnumSet.of(BarcodeFormat.QR_CODE)
        hints[DecodeHintType.TRY_HARDER] = true
        reader.setHints(hints)
    }

    fun decode(image: ImageProxy): String? {
        return try {
            val plane = image.planes[0]
            val buf: ByteBuffer = plane.buffer
            val w = image.width
            val h = image.height
            val stride = plane.rowStride
            val y = ByteArray(stride * h)
            buf.rewind()
            buf.get(y, 0, Math.min(y.size, buf.remaining()))
            val src = PlanarYUVLuminanceSource(y, stride, h, 0, 0, w, h, false)
            val r: Result
            try {
                r = reader.decodeWithState(BinaryBitmap(HybridBinarizer(src)))
            } catch (miss: Exception) {
                try {
                    r = reader.decodeWithState(BinaryBitmap(HybridBinarizer(src.invert())))
                } catch (miss2: Exception) {
                    return null
                }
            } finally {
                reader.reset()
            }
            val text = r.text
            if (text.isNullOrEmpty()) null else text
        } catch (ignored: Exception) {
            null
        }
    }
}

class SessionHandles(val camera: Camera, val capture: ImageCapture?)

/** 绑定一次相机会话：scan 模式挂一路 ImageAnalysis 解二维码，否则挂 ImageCapture 拍照 */
fun bindSession(
        provider: ProcessCameraProvider,
        owner: LifecycleOwner,
        surfaceProvider: Preview.SurfaceProvider,
        lensFacing: Int,
        scanMode: Boolean,
        analysisExecutor: ExecutorService,
        onFrame: (ImageProxy) -> Unit
): SessionHandles {
    val preview = Preview.Builder().build()
    preview.setSurfaceProvider(surfaceProvider)
    val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
    return if (scanMode) {
        val analyzer = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
        analyzer.setAnalyzer(analysisExecutor, ImageAnalysis.Analyzer { image -> onFrame(image) })
        SessionHandles(provider.bindToLifecycle(owner, selector, preview, analyzer), null)
    } else {
        val capture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setTargetResolution(Size(1440, 1920))
                .build()
        SessionHandles(provider.bindToLifecycle(owner, selector, preview, capture), capture)
    }
}

/** 按镜头能力夹紧目标倍率 */
fun clampZoom(camera: Camera, ratio: Double): Float {
    val z = camera.cameraInfo.zoomState.value
    val min = z?.minZoomRatio ?: 1f
    val max = z?.maxZoomRatio ?: 1f
    return Math.max(min.toDouble(), Math.min(max.toDouble(), ratio)).toFloat()
}
