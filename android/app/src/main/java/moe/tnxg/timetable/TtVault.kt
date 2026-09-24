package moe.tnxg.timetable

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * 教务登录凭证的加密缓存：用户在直登页开了「保存密码」才写入。
 * <p>
 * 密钥是 AndroidKeyStore 里的 AES-256 密钥（不出安全硬件，首次使用时生成），每次加密用随机 GCM IV，
 * 密文格式 base64(iv || ciphertext)，按学校 Profile 名存应用私有的 SharedPreferences。
 * 明文只在加解密的瞬间存在内存里，不进任何日志；读出来只为登录页预填学号密码。
 * 关掉开关、退出登录即删；Keystore 被系统清掉等异常一律当作没存过，并把该条密文清掉。
 */
@CapacitorPlugin(name = "TtVault")
class TtVault : Plugin() {

    private val prefs by lazy { context.getSharedPreferences(FILE, Context.MODE_PRIVATE) }

    /** 主密钥：Keystore 里已有就直接用，没有就生成一次 */
    private fun key(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null, null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return gen.generateKey()
    }

    /** 解出 (学号, 密码)；没存过或解不开（Keystore 被清、密文被改）返回 null，并把坏条目删掉 */
    private fun decrypt(profile: String): Pair<String, String>? {
        val blob = prefs.getString(profile, null) ?: return null
        try {
            val raw = Base64.decode(blob, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, raw, 0, IV_LEN))
            val plain = cipher.doFinal(raw, IV_LEN, raw.size - IV_LEN)
            val o = JSONObject(String(plain, Charsets.UTF_8))
            val u = o.optString("u")
            val p = o.optString("p")
            if (u.isEmpty() || p.isEmpty()) return null
            return u to p
        } catch (e: Exception) {
            prefs.edit().remove(profile).apply()
            return null
        }
    }

    /** 登录成功后由登录页调用；空学号/空密码不存 */
    @PluginMethod
    fun set(call: PluginCall) {
        val profile = call.getString("profile") ?: ""
        val username = call.getString("username") ?: ""
        val password = call.getString("password") ?: ""
        val o = JSObject()
        if (profile.isEmpty() || username.isEmpty() || password.isEmpty()) {
            o.put("ok", false)
            call.resolve(o)
            return
        }
        try {
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val iv = cipher.iv
            val plain = JSONObject().put("u", username).put("p", password).toString().toByteArray(Charsets.UTF_8)
            val out = ByteArray(iv.size + plain.size)
            iv.copyInto(out)
            cipher.doFinal(plain).copyInto(out, iv.size)
            prefs.edit().putString(profile, Base64.encodeToString(out, Base64.NO_WRAP)).apply()
            o.put("ok", true)
        } catch (e: Exception) {
            o.put("ok", false)
        }
        call.resolve(o)
    }

    /** 登录页预填用；username 为 null 表示没有存过的凭证 */
    @PluginMethod
    fun get(call: PluginCall) {
        val profile = call.getString("profile") ?: ""
        val cred = if (profile.isEmpty()) null else decrypt(profile)
        val o = JSObject()
        o.put("username", cred?.first)
        o.put("password", cred?.second)
        call.resolve(o)
    }

    /** 关掉「保存密码」、退出登录时调用 */
    @PluginMethod
    fun clear(call: PluginCall) {
        val profile = call.getString("profile") ?: ""
        if (profile.isNotEmpty()) prefs.edit().remove(profile).apply()
        val o = JSObject()
        o.put("ok", true)
        call.resolve(o)
    }

    companion object {
        private const val FILE = "tt-vault"
        private const val ANDROID_KEY_STORE = "AndroidKeyStore"
        private const val ALIAS = "tt-edu-cred"
        private const val TRANSFORM = "AES/GCM/NoPadding"
        private const val IV_LEN = 12
        private const val TAG_BITS = 128
    }
}
