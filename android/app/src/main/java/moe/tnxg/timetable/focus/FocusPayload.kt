package moe.tnxg.timetable.focus

import android.app.Notification
import android.content.Context
import android.graphics.drawable.Icon
import android.os.Bundle
import org.json.JSONObject

/** SystemUI templates, enabled only after a package-scoped module handshake. */
object FocusPayload {
    fun apply(context: Context, notification: Notification, job: JSONObject) {
        val iconKey = "miui.focus.pic_koma"
        val image = JSONObject().put("type", 1).put("pic", iconKey)
        val during = job.optString("phase") == "during"
        val countdown = during && job.optBoolean("countdown")
        val endAt = job.optLong("endAt", job.getLong("until"))
        val now = System.currentTimeMillis()
        val timer = JSONObject().put("timerType", if (countdown) -1 else 0)
            .put("timerWhen", if (countdown) endAt else 0)
            .put("timerTotal", 0).put("timerSystemCurrent", if (countdown) now else 0)
        val status = if (during) "上课中" else "即将上课"
        val text = JSONObject().put("title", status).put("narrowFont", false)
        if (countdown) text.put("timerInfo", timer)
        val island = JSONObject().put("islandProperty", 1).put("islandTimeout", ((job.getLong("until") - now) / 1000).coerceIn(1, 43200))
            .put("bigIslandArea", JSONObject()
                .put("imageTextInfoLeft", JSONObject().put("type", 1).put("picInfo", image)
                    .put("textInfo", JSONObject().put("title", job.getString("title"))))
                .put("textInfo", text))
            .put("smallIslandArea", JSONObject().put("picInfo", image))
        val focus = JSONObject().put("protocol", 1).put("business", "class_schedule")
            .put("updatable", true).put("reopen", "reopen")
            .put("enableFloat", false).put("islandFirstFloat", !during)
            .put("timeout", ((job.getLong("until") - now) / 60000 + 1).coerceIn(1, 720))
            .put("ticker", job.getString("title")).put("aodTitle", job.getString("title"))
            .put("baseInfo", JSONObject().put("type", 2).put("title", job.getString("title"))
                .put("content", job.optString("location"))
                .put("subTitle", job.optString("timeRange"))
                .put("showDivider", false))
            .put("hintInfo", JSONObject().put("type", 2).put("content", if (countdown) "距下课" else "")
                .put("title", if (countdown) "" else status).put("timerInfo", timer))
            .put("param_island", island)
        notification.extras.putString("miui.focus.param", JSONObject().put("param_v2", focus).toString())
        notification.extras.putBundle("miui.focus.pics", Bundle().apply {
            putParcelable(iconKey, Icon.createWithResource(context, moe.tnxg.timetable.R.mipmap.ic_launcher))
        })
    }
}
