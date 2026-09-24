package moe.tnxg.timetable

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Size
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.util.concurrent.ExecutorService
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import android.content.ContentUris

/** 拍摄文件相对路径的目录名（应用私有 files/ 下） */
const val TASK_PHOTOS_DIR = "task-photos"

/** 拍摄文件的存放目录 */
fun cameraPhotoDir(context: Context): File {
    val dir = File(context.filesDir, TASK_PHOTOS_DIR)
    if (!dir.exists()) dir.mkdirs()
    return dir
}

/** 冻结帧缩到 720px 宽，编成 JPEG data URL；失败就回空对象 */
fun frozenFrameResult(src: Bitmap): JSObject {
    val o = JSObject()
    try {
        var s = src
        val max = 720
        if (s.width > max) {
            s = Bitmap.createScaledBitmap(s, max, Math.round(s.height * max.toFloat() / s.width), true)
        }
        val bo = ByteArrayOutputStream()
        s.compress(Bitmap.CompressFormat.JPEG, 80, bo)
        o.put("frozen", "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP))
    } catch (ignored: Exception) {
    }
    return o
}

/** 拍一张：JPEG 字节落盘后把结果交给回调；o 为 null 时 err 是错误信息 */
fun captureJpeg(imageCapture: ImageCapture, executor: ExecutorService, context: Context, mirror: Boolean, done: (JSObject?, String?) -> Unit) {
    imageCapture.takePicture(executor, object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: ImageProxy) {
            try {
                val buffer = image.planes[0].buffer
                val bytes = ByteArray(buffer.remaining())
                buffer.get(bytes)
                val rotation = image.imageInfo.rotationDegrees
                image.close()
                done(writeJpeg(context, bytes, rotation, mirror), null)
            } catch (e: Exception) {
                image.close()
                done(null, e.message)
            }
        }

        override fun onError(e: ImageCaptureException) {
            done(null, e.message)
        }
    })
}

/** 写入私有目录；需要旋转/镜像时才解码一次，否则直接落盘 */
fun writeJpeg(context: Context, jpeg: ByteArray, rotation: Int, mirror: Boolean): JSObject {
    val name = "p" + System.currentTimeMillis() + ".jpg"
    val out = File(cameraPhotoDir(context), name)
    var w: Int
    var h: Int
    if (rotation == 0 && !mirror) {
        FileOutputStream(out).use { fos -> fos.write(jpeg) }
        val opt = BitmapFactory.Options()
        opt.inJustDecodeBounds = true
        BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, opt)
        w = opt.outWidth
        h = opt.outHeight
    } else {
        val src = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
        val m = Matrix()
        m.postRotate(rotation.toFloat())
        if (mirror) m.postScale(-1f, 1f)
        val fixed = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
        if (fixed !== src) src.recycle()
        FileOutputStream(out).use { fos -> fixed.compress(Bitmap.CompressFormat.JPEG, 92, fos) }
        w = fixed.width
        h = fixed.height
        fixed.recycle()
    }
    val o = JSObject()
    o.put("path", TASK_PHOTOS_DIR + "/" + name)
    o.put("uri", Uri.fromFile(out).toString())
    o.put("width", w)
    o.put("height", h)
    return o
}

/** 缩略图很小（240px），只有它走 base64；原图始终走文件路径 */
fun thumbBase64(context: Context, uri: Uri): String {
    return try {
        val bmp = if (Build.VERSION.SDK_INT >= 29) {
            context.contentResolver.loadThumbnail(uri, Size(240, 240), null)
        } else {
            MediaStore.Images.Thumbnails.getThumbnail(
                    context.contentResolver, ContentUris.parseId(uri),
                    MediaStore.Images.Thumbnails.MINI_KIND, null)
        } ?: return ""
        val bos = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 70, bos)
        bmp.recycle()
        "data:image/jpeg;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
        ""
    }
}

/** 只解码尺寸，不读像素 */
fun imageSize(file: File): IntArray {
    val opt = BitmapFactory.Options()
    opt.inJustDecodeBounds = true
    BitmapFactory.decodeFile(file.absolutePath, opt)
    return intArrayOf(opt.outWidth, opt.outHeight)
}

fun imageResult(path: String, file: File, w: Int, h: Int): JSObject {
    val o = JSObject()
    o.put("path", path)
    o.put("uri", Uri.fromFile(file).toString())
    o.put("width", w)
    o.put("height", h)
    return o
}

fun importFromMediaStore(context: Context, id: String): JSObject {
    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toLong())
    val name = "i" + System.currentTimeMillis() + "-" + id + ".jpg"
    val dst = File(cameraPhotoDir(context), name)
    val input = context.contentResolver.openInputStream(uri)
    try {
        FileOutputStream(dst).use { os ->
            val buf = ByteArray(64 * 1024)
            var n: Int = 0
            while (input != null && input.read(buf).also { n = it } > 0) os.write(buf, 0, n)
        }
    } finally {
        input?.close()
    }
    val size = imageSize(dst)
    return imageResult(TASK_PHOTOS_DIR + "/" + name, dst, size[0], size[1])
}

/** 系统选择器选出的图以 data URL 传进来，落到私有目录 */
fun importDataUrl(context: Context, b64: String): JSObject {
    val bytes = Base64.decode(b64, Base64.DEFAULT)
    val name = "d" + System.nanoTime() + ".jpg"
    val dst = File(cameraPhotoDir(context), name)
    FileOutputStream(dst).use { fos -> fos.write(bytes) }
    val size = imageSize(dst)
    return imageResult(TASK_PHOTOS_DIR + "/" + name, dst, size[0], size[1])
}

fun importPickedImages(context: Context, ids: List<String>): JSObject {
    val out = JSArray()
    for (id in ids) {
        out.put(importFromMediaStore(context, id))
    }
    return JSObject().also { it.put("items", out) }
}

fun deleteRelativeFiles(context: Context, paths: List<String>) {
    for (p in paths) {
        val f = File(context.filesDir, p)
        if (f.exists()) f.delete()
    }
}

fun listRecentImages(context: Context, limit: Int, page: Int): JSObject {
    val items = JSArray()
    val cr = context.contentResolver
    val cols = arrayOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.WIDTH, MediaStore.Images.Media.HEIGHT)
    val c = cr.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cols, null, null,
            MediaStore.Images.Media.DATE_ADDED + " DESC LIMIT " + limit + " OFFSET " + (page * limit))
    if (c != null) {
        c.use {
            while (it.moveToNext()) {
                val id = it.getLong(0)
                val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
                val o = JSObject()
                o.put("id", id.toString())
                o.put("width", it.getInt(1))
                o.put("height", it.getInt(2))
                o.put("thumb", thumbBase64(context, uri))
                items.put(o)
            }
        }
    }
    val res = JSObject()
    res.put("items", items)
    return res
}

/** 存到系统相册：Q+ 走 MediaStore 不需要权限；失败时清掉半截记录后把异常抛回调用方 */
fun saveImageToMediaStore(context: Context, f: File, albumName: String) {
    val cr = context.contentResolver
    val v = ContentValues()
    v.put(MediaStore.Images.Media.DISPLAY_NAME, f.name)
    v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
    v.put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
    if (Build.VERSION.SDK_INT >= 29) {
        v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + albumName)
        v.put(MediaStore.Images.Media.IS_PENDING, 1)
    } else {
        val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), albumName)
        if (!dir.exists()) dir.mkdirs()
        v.put(MediaStore.Images.Media.DATA, File(dir, f.name).absolutePath)
    }
    var uri: Uri? = null
    try {
        uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v)
        if (uri == null) throw Exception("insert")
        FileInputStream(f).use { input ->
            cr.openOutputStream(uri).use { out ->
                if (out == null) throw Exception("open")
                val buf = ByteArray(64 * 1024)
                var n: Int = 0
                while (input.read(buf).also { n = it } > 0) out.write(buf, 0, n)
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            val done = ContentValues()
            done.put(MediaStore.Images.Media.IS_PENDING, 0)
            cr.update(uri, done, null, null)
        }
    } catch (e: Exception) {
        if (uri != null) {
            try {
                cr.delete(uri, null, null)
            } catch (ignored: Exception) {
            }
        }
        throw e
    }
}
