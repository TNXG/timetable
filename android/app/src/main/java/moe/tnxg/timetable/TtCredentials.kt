package moe.tnxg.timetable

import java.io.File
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * 学号/密码由 Android Keystore 生成的 AES 密钥加密后存入应用私有的不备份目录。
 * 明文只在登录调用期间存在内存中；应用自身不维护加密密钥。
 */
@CapacitorPlugin(name = "TtCredentials")
class TtCredentials : Plugin() {
    companion object {
        private const val KEY_ALIAS = "timetable.edu.credentials"
        private const val VALUE = "edu_credentials"
        private const val IV_LENGTH = 12
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val body = cipher.iv + cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(body, Base64.NO_WRAP)
    }

    private fun decrypt(value: String): String {
        val body = Base64.decode(value, Base64.NO_WRAP)
        require(body.size > IV_LENGTH)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, body, 0, IV_LENGTH))
        return String(cipher.doFinal(body, IV_LENGTH, body.size - IV_LENGTH), StandardCharsets.UTF_8)
    }

    @PluginMethod
    fun save(call: PluginCall) {
        val username = call.getString("username") ?: ""
        val password = call.getString("password") ?: ""
        if (username.isEmpty() || password.isEmpty()) {
            call.resolve(JSObject().put("ok", false))
            return
        }
        try {
            File(context.noBackupFilesDir, VALUE).writeText(encrypt("$username\u0000$password"), StandardCharsets.UTF_8)
            call.resolve(JSObject().put("ok", true))
        } catch (_: Exception) {
            call.resolve(JSObject().put("ok", false))
        }
    }

    @PluginMethod
    fun get(call: PluginCall) {
        try {
            val raw = File(context.noBackupFilesDir, VALUE).takeIf { it.exists() }?.readText(StandardCharsets.UTF_8)
            if (raw == null) {
                call.resolve(JSObject().put("ok", false))
                return
            }
            val parts = decrypt(raw).split('\u0000', limit = 2)
            if (parts.size != 2 || parts[0].isEmpty() || parts[1].isEmpty()) {
                call.resolve(JSObject().put("ok", false))
                return
            }
            call.resolve(JSObject().put("ok", true).put("username", parts[0]).put("password", parts[1]))
        } catch (_: Exception) {
            call.resolve(JSObject().put("ok", false))
        }
    }
    @PluginMethod
    fun clear(call: PluginCall) {
        File(context.noBackupFilesDir, VALUE).delete()
        call.resolve(JSObject().put("ok", true))
    }

}
