package moe.tnxg.timetable

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject

fun photosPermission(): String {
    return if (Build.VERSION.SDK_INT >= 33) "android.permission.READ_MEDIA_IMAGES" else Manifest.permission.READ_EXTERNAL_STORAGE
}

/** Android 14 连“选中的照片”一起要，系统对话框才会把部分授权当成结果交回来 */
fun photosAlias(): String {
    if (Build.VERSION.SDK_INT >= 34) return "media14"
    if (Build.VERSION.SDK_INT >= 33) return "media"
    return "photos"
}

fun hasPermission(context: Context, permission: String): Boolean {
    return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}

/** Android 14 的“选中的照片”也算可读 */
fun hasPhotosPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 34
            && ContextCompat.checkSelfPermission(context, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED") == PackageManager.PERMISSION_GRANTED) {
        return true
    }
    return hasPermission(context, photosPermission())
}

fun permissionStatus(context: Context): JSObject {
    val o = JSObject()
    o.put("camera", if (hasPermission(context, Manifest.permission.CAMERA)) "granted" else "prompt")
    o.put("photos", if (hasPhotosPermission(context)) "granted" else "prompt")
    return o
}

/** 不再弹系统对话框的那种拒绝，页面要换成“去设置” */
fun permissionDeniedStatus(photos: Boolean, activity: Activity?): String {
    val perm = if (photos) photosPermission() else Manifest.permission.CAMERA
    val again = activity != null && ActivityCompat.shouldShowRequestPermissionRationale(activity, perm)
    return if (again) "denied" else "blocked"
}
