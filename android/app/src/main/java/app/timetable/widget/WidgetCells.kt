package app.timetable.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.view.View
import android.widget.RemoteViews

import app.timetable.MainActivity
import app.timetable.widget.WidgetStore.Item

/** 卡片配色，与页面三套主题的 --c-surface / --c-ink* / --c-accent / --c-tint-base / --c-ink-mix 一一对应 */
class Palette(
    @JvmField val surface: Int,
    @JvmField val ink: Int,
    @JvmField val ink3: Int,
    @JvmField val ink4: Int,
    @JvmField val accent: Int,
    @JvmField val tintBase: Int,
    @JvmField val inkMix: Int,
) {
    /** 课程色按比例铺在卡片底上，对应原型 tint() */
    fun tint(color: Int, percent: Int): Int {
        return WidgetStore.mix(color, tintBase, percent / 100f)
    }

    /** 课名字色：浅色下压深，深色下提亮，对应原型里和 --c-ink-mix 的混合 */
    fun deepen(color: Int, percent: Int): Int {
        return WidgetStore.mix(color, inkMix, percent / 100f)
    }
}

val LIGHT = Palette(0xFFFFFFFF.toInt(), 0xFF16171A.toInt(), 0xFF8A8E97.toInt(), 0xFFA2A6AF.toInt(), 0xFF4F5BD5.toInt(), 0xFFFFFFFF.toInt(), 0xFF000000.toInt())
val DARK = Palette(0xFF1C1D21.toInt(), 0xFFF1F1EF.toInt(), 0xFF8F939C.toInt(), 0xFF8F939C.toInt(), 0xFF7C8FF0.toInt(), 0xFF26272C.toInt(), 0xFFFFFFFF.toInt())
val BLACK = Palette(0xFF121214.toInt(), 0xFFF1F1EF.toInt(), 0xFF8F939C.toInt(), 0xFF8F939C.toInt(), 0xFF7C8FF0.toInt(), 0xFF1D1D20.toInt(), 0xFFFFFFFF.toInt())

/**
 * 跟 App 的主题走（页面每次切主题都会把底色、深浅和是否跟随系统记到 tt.theme）；
 * 跟随系统或还没打开过 App 时按系统深色模式。
 * 不走资源限定符：部分桌面用自己的配置解析资源，深浅会和 App 不一致。
 */
fun palette(ctx: Context): Palette {
    val sp: SharedPreferences = ctx.getSharedPreferences("tt.theme", Context.MODE_PRIVATE)
    if (sp.getBoolean("system", true)) return if (WidgetStore.isNight(ctx)) DARK else LIGHT
    if (sp.getBoolean("light", true)) return LIGHT
    return if (sp.getInt("bg", 0) == 0xFF000000.toInt()) BLACK else DARK
}

fun viewId(ctx: Context, name: String): Int {
    return ctx.resources.getIdentifier(name, "id", ctx.packageName)
}

/**
 * 一行课：底色是课程色 8% 铺在卡片底上；正在上的那节描一圈课程色边框，时间位换成剩余时长；课名始终用正文色，与原型 WRow 一致。
 * 边框由底层实心圆角（ring）+ 上层内缩 1.5dp 的实心圆角（bg）套出来，不用 stroke：
 * 部分桌面对带 stroke 的 shape 做 setColorFilter 会整块填成实色。不在上课时 ring 与 bg 同色，看不出拼接。
 */
fun row(ctx: Context, v: RemoteViews, p: Palette, prefix: String, idx: Int, it: Item?, now: Boolean, time: String?) {
    val rowId = viewId(ctx, prefix + idx)
    if (it == null) {
        v.setViewVisibility(rowId, View.GONE)
        return
    }
    v.setViewVisibility(rowId, View.VISIBLE)
    val bg = p.tint(it.color, 8)
    v.setInt(viewId(ctx, prefix + idx + "_bg"), "setColorFilter", bg)
    v.setInt(viewId(ctx, prefix + idx + "_ring"), "setColorFilter", if (now) it.color else bg)
    v.setInt(viewId(ctx, prefix + idx + "_bar"), "setColorFilter", it.color)
    v.setTextViewText(viewId(ctx, prefix + idx + "_name"), it.name)
    v.setTextColor(viewId(ctx, prefix + idx + "_name"), p.ink)
    val locId = viewId(ctx, prefix + idx + "_loc")
    if (locId != 0) {
        var meta: String = it.loc
        if (meta.isEmpty()) meta = it.teacher
        v.setTextViewText(locId, meta)
        v.setTextColor(locId, p.ink3)
        v.setViewVisibility(locId, if (meta.isEmpty()) View.GONE else View.VISIBLE)
    }
    val timeId = viewId(ctx, prefix + idx + "_time")
    if (timeId != 0) {
        v.setTextViewText(timeId, time ?: it.start)
        v.setTextColor(timeId, p.ink3)
    }
}

/** 周网格里的一个课格 */
fun weekCell(ctx: Context, v: RemoteViews, p: Palette, cid: String, it: Item, nowCell: Boolean) {
    v.setViewVisibility(viewId(ctx, cid), View.VISIBLE)
    val bg = p.tint(it.color, if (nowCell) 16 else 8)
    v.setInt(viewId(ctx, cid + "_bg"), "setColorFilter", bg)
    v.setInt(viewId(ctx, cid + "_ring"), "setColorFilter", if (nowCell) it.color else bg)
    v.setTextViewText(viewId(ctx, cid + "_name"), it.name)
    v.setTextColor(viewId(ctx, cid + "_name"), p.deepen(it.color, 88))
    v.setTextViewText(viewId(ctx, cid + "_time"), it.start)
    v.setTextColor(viewId(ctx, cid + "_time"), p.ink3)
    v.setTextViewText(viewId(ctx, cid + "_loc"), it.loc)
    v.setTextColor(viewId(ctx, cid + "_loc"), p.ink4)
}

fun openMainActivity(ctx: Context): PendingIntent {
    val i = Intent(ctx, MainActivity::class.java)
    i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(ctx, 0, i, flags)
}
