package moe.tnxg.timetable

import android.Manifest
import android.net.Uri
import android.os.Build
import android.view.ViewGroup
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * 相机与相册：CameraX 预览叠在 WebView 上方的取景区，页面自己画四周的黑底与控件。
 * 拍摄直接写应用私有目录，缩略图走 ContentResolver.loadThumbnail，图片字节不经过 JS。
 */
@CapacitorPlugin(
        name = "TtCamera",
        permissions = [
                Permission(alias = "camera", strings = [Manifest.permission.CAMERA]),
                // 按 SDK 拆开：同一次请求里带上 manifest 已用 maxSdkVersion 裁掉的权限，Capacitor 会在回调里整个 reject
                Permission(alias = "photos", strings = [Manifest.permission.READ_EXTERNAL_STORAGE]),
                Permission(alias = "media", strings = ["android.permission.READ_MEDIA_IMAGES"]),
                Permission(alias = "media14", strings = ["android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"]),
                Permission(alias = "save", strings = [Manifest.permission.WRITE_EXTERNAL_STORAGE]),
        ]
)
class TtCamera : Plugin() {

    /** 取景容器：叠在 WebView 上方、圆角裁切，里面是预览 + 四角标记 */
    private var surface: CameraSurface? = null
    private var provider: ProcessCameraProvider? = null
    private var capture: ImageCapture? = null
    private var camera: Camera? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    /** 扫码模式：预览旁挂一路 ImageAnalysis 解二维码，识别结果以 scan 事件推给页面 */
    private var scanMode = false
    private var lastScan: String? = null
    private var lastScanAt = 0L
    private lateinit var io: ExecutorService
    private lateinit var analysis: ExecutorService
    private val barcodeDecoder = BarcodeFrameDecoder()

    override fun load() {
        io = Executors.newSingleThreadExecutor()
        analysis = Executors.newSingleThreadExecutor()
        // 提前初始化 CameraX，进相机页时少等几百毫秒
        ProcessCameraProvider.getInstance(context)
    }

    /* ---------------- 权限 ---------------- */

    override fun checkPermissions(call: PluginCall) = call.resolve(permissionStatus(context))

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val photos = "photos" == call.getString("kind", "camera")
        if (if (photos) hasPhotosPermission(context) else hasPermission(context, Manifest.permission.CAMERA)) {
            call.resolve(JSObject().also { it.put("status", "granted") })
            return
        }
        requestPermissionForAlias(if (photos) photosAlias() else "camera", call, "permissionResult")
    }

    @PermissionCallback
    private fun permissionResult(call: PluginCall) {
        val photos = "photos" == call.getString("kind", "camera")
        val ok = if (photos) hasPhotosPermission(context) else hasPermission(context, Manifest.permission.CAMERA)
        call.resolve(JSObject().also {
            // 不再弹系统对话框的那种拒绝，页面要换成“去设置”
            it.put("status", if (ok) "granted" else permissionDeniedStatus(photos, activity))
        })
    }

    /* ---------------- 预览 ---------------- */

    private fun dp(v: Double): Int = Math.round(v * context.resources.displayMetrics.density).toInt()

    @PluginMethod
    fun start(call: PluginCall) {
        if (!hasPermission(context, Manifest.permission.CAMERA)) {
            call.reject("no-permission")
            return
        }
        val position = call.getString("position", "back")
        lensFacing = if ("front" == position) CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
        scanMode = call.getBoolean("scan", false) == true
        lastScan = null
        val x = dp(call.getDouble("x", 0.0) ?: 0.0)
        val y = dp(call.getDouble("y", 0.0) ?: 0.0)
        val w = dp(call.getDouble("width", 0.0) ?: 0.0)
        val h = dp(call.getDouble("height", 0.0) ?: 0.0)
        val revealAt = System.currentTimeMillis() + (call.getInt("delay", 0) ?: 0)

        activity!!.runOnUiThread {
            try {
                val root = bridge.webView.parent as ViewGroup
                // 上一次没 stop 干净（比如 freeze 后直接重开）：拆掉重建，保证从透明淡入
                surface = recreateSurface(surface, context, activity as LifecycleOwner, root, x, y, w, h, revealAt) { s -> surface === s }
                bindCamera(call)
            } catch (e: Exception) {
                call.reject(e.message)
            }
        }
    }

    private fun bindCamera(call: PluginCall?) {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                val p = future.get()
                provider = p
                p.unbindAll()
                val s = surface
                if (s == null) {
                    call?.reject("stopped")
                    return@addListener
                }
                val handles = bindSession(p, activity as LifecycleOwner, s.previewView.surfaceProvider,
                        lensFacing, scanMode, analysis) { decodeFrame(it) }
                camera = handles.camera
                capture = handles.capture
                if (call != null) {
                    call.resolve(JSObject().also {
                        it.put("position", if (lensFacing == CameraSelector.LENS_FACING_FRONT) "front" else "back")
                    })
                }
            } catch (e: Exception) {
                call?.reject(e.message)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /* ---------------- 扫码 ---------------- */

    /** 解不出就丢帧，正常解出后 1.5s 内同一内容不重复上报 */
    private fun decodeFrame(image: ImageProxy) {
        try {
            val text = barcodeDecoder.decode(image) ?: return
            val now = System.currentTimeMillis()
            if (text == lastScan && now - lastScanAt < 1500) return
            lastScan = text
            lastScanAt = now
            notifyListeners("scan", JSObject().also { it.put("text", text) })
        } catch (ignored: Exception) {
        } finally {
            image.close()
        }
    }

    /**
     * 定格：当前画面立刻换成一张静态图盖在预览上（同一帧内完成），相机随即解绑；
     * 编码成 JPEG 交给页面的工作放到后台线程，不占 UI 线程。原生层此时仍在，
     * 页面拿到图、画好之后再调 stop() 撤掉，两边像素一致，看不到交接。
     */
    @PluginMethod
    fun freeze(call: PluginCall) {
        activity!!.runOnUiThread {
            val b = surface?.grabStill()
            if (b != null) surface?.showStill(b)
            provider?.unbindAll()
            capture = null
            camera = null
            if (b == null) {
                call.resolve(JSObject())
                return@runOnUiThread
            }
            io.execute { call.resolve(frozenFrameResult(b)) }
        }
    }

    /** 撤掉原生层。没 freeze 过也可以直接调，等价于立刻收起。 */
    @PluginMethod
    fun stop(call: PluginCall) {
        activity!!.runOnUiThread {
            provider?.unbindAll()
            surface?.let { s ->
                s.frame.animate().cancel()
                s.detachFromParent()
            }
            surface = null
            capture = null
            camera = null
            call.resolve()
        }
    }

    @PluginMethod
    fun switchCamera(call: PluginCall) {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
        activity!!.runOnUiThread { bindCamera(call) }
    }

    /** 双指缩放：传目标倍率，按镜头能力夹紧后返回实际倍率 */
    @PluginMethod
    fun setZoom(call: PluginCall) {
        val ratio = call.getDouble("ratio", 1.0) ?: 1.0
        activity!!.runOnUiThread {
            val cam = camera
            if (cam == null) {
                call.resolve(JSObject().also { it.put("ratio", 1.0) })
                return@runOnUiThread
            }
            val r = clampZoom(cam, ratio)
            cam.cameraControl.setZoomRatio(r)
            call.resolve(JSObject().also { it.put("ratio", r) })
        }
    }

    @PluginMethod
    fun setTorch(call: PluginCall) {
        val on = call.getBoolean("on", false) == true
        val cam = camera
        if (cam == null || !cam.cameraInfo.hasFlashUnit()) {
            call.resolve()
            return
        }
        cam.cameraControl.enableTorch(on)
        call.resolve()
    }

    /* ---------------- 拍摄 ---------------- */

    @PluginMethod
    fun capture(call: PluginCall) {
        val cap = capture
        if (cap == null) {
            call.reject("not-started")
            return
        }
        val mirror = lensFacing == CameraSelector.LENS_FACING_FRONT
        captureJpeg(cap, io, context, mirror) { o, err ->
            if (o == null) call.reject(err) else call.resolve(o)
        }
    }

    /* ---------------- 相册 / 文件 ---------------- */

    /** 后台执行并按约定回包：返回 JSObject 则 resolve 它，抛异常则 reject */
    private fun runIo(call: PluginCall, body: () -> JSObject?) {
        io.execute {
            val o = try {
                body()
            } catch (e: Exception) {
                call.reject(e.message)
                return@execute
            }
            if (o == null) call.resolve() else call.resolve(o)
        }
    }

    @PluginMethod
    fun listRecent(call: PluginCall) {
        if (!hasPhotosPermission(context)) {
            call.reject("no-permission")
            return
        }
        runIo(call) { listRecentImages(context, call.getInt("limit", 60) ?: 60, call.getInt("page", 0) ?: 0) }
    }

    @PluginMethod
    fun importPicked(call: PluginCall) {
        val ids = call.getArray("ids")
        if (ids == null) {
            call.reject("no-ids")
            return
        }
        runIo(call) { importPickedImages(context, ids.toList()) }
    }

    @PluginMethod
    fun importData(call: PluginCall) {
        val data = call.getString("data", "") ?: ""
        val comma = data.indexOf(',')
        if (comma < 0) {
            call.reject("bad-data")
            return
        }
        runIo(call) { importDataUrl(context, data.substring(comma + 1)) }
    }

    /** 相对路径转 WebView 能加载的地址 */
    @PluginMethod
    fun resolve(call: PluginCall) {
        val f = File(context.filesDir, call.getString("path", ""))
        call.resolve(JSObject().also { it.put("uri", if (f.exists()) Uri.fromFile(f).toString() else "") })
    }

    /** 存到系统相册：Q+ 走 MediaStore 不需要权限，更老的系统先要 WRITE_EXTERNAL_STORAGE */
    @PluginMethod
    fun saveToGallery(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 29 && !hasPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            requestPermissionForAlias("save", call, "saveResult")
            return
        }
        doSave(call)
    }

    @PermissionCallback
    private fun saveResult(call: PluginCall) {
        if (hasPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE)) doSave(call)
        else call.reject("denied")
    }

    private fun doSave(call: PluginCall) {
        val f = File(context.filesDir, call.getString("path", ""))
        if (!f.exists()) {
            call.reject("missing")
            return
        }
        runIo(call) {
            saveImageToMediaStore(context, f, context.getString(R.string.app_name))
            null
        }
    }

    @PluginMethod
    fun deleteFiles(call: PluginCall) {
        val paths = call.getArray("paths") ?: return call.resolve()
        io.execute {
            try {
                deleteRelativeFiles(context, paths.toList())
            } catch (ignored: Exception) {
            }
            call.resolve()
        }
    }
}
