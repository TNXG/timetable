package moe.tnxg.timetable

import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.PasswordCredential
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * 学号/密码交给系统密码管理器（Google 密码管理器等凭据提供器）保管：应用自身不落盘。
 * save 在登录成功且「保存密码」打开时调用；get 弹系统选择面板，由用户确认后回填学号密码。
 * 密码管理器里的条目只能由用户在系统设置里删——没有可编程的删除接口。
 */
@CapacitorPlugin(name = "TtCredentials")
class TtCredentials : Plugin() {

    private val cm by lazy { CredentialManager.create(context) }

    /** 保存学号/密码；用户在系统面板取消或环境不支持时 ok=false */
    @PluginMethod
    fun save(call: PluginCall) {
        val username = call.getString("username") ?: ""
        val password = call.getString("password") ?: ""
        val activity = activity
        if (username.isEmpty() || password.isEmpty() || activity == null) {
            call.resolve(JSObject().put("ok", false))
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                cm.createCredential(activity, CreatePasswordRequest(id = username, password = password))
                call.resolve(JSObject().put("ok", true))
            } catch (e: Exception) {
                call.resolve(JSObject().put("ok", false))
            }
        }
    }

    /** 弹系统选择面板；用户取消、没有存过或环境不支持时 ok=false */
    @PluginMethod
    fun get(call: PluginCall) {
        val activity = activity
        if (activity == null) {
            call.resolve(JSObject().put("ok", false))
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val result = cm.getCredential(activity, GetCredentialRequest(listOf(GetPasswordOption())))
                val c = result.credential as? PasswordCredential
                if (c == null) call.resolve(JSObject().put("ok", false))
                else call.resolve(JSObject().put("ok", true).put("username", c.id).put("password", c.password))
            } catch (e: Exception) {
                call.resolve(JSObject().put("ok", false))
            }
        }
    }
}
