package com.example.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.Process
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.MainActivity
import com.example.R
import com.example.util.QrCodeDetector
import com.example.util.ScreenShareManager
import java.io.ByteArrayOutputStream

/**
 * ScreenShareService
 *
 * Lightweight, off-main-thread foreground MediaProjection service:
 * - Captures on a dedicated HandlerThread so Android UI clicks remain instant.
 * - Uses proportional 720p max capture dimensions + smart output scaling (12–24 KB frames).
 * - Deduplicates unchanged static frames via a fast 10x10 pixel hash.
 */
class ScreenShareService : Service() {

    private val tag = "ScreenShareService"
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var captureThread: HandlerThread? = null
    private var captureHandler: Handler? = null

    private var lastFrameTime = 0L
    private var lastSentFrameHash = 0L
    private var lastSentKeyFrameTime = 0L
    private var lastCropModeOrdinal = -1
    private var lastZoomBits = 0
    private val reusableBaos = ByteArrayOutputStream(32 * 1024)

    override fun onCreate() {
        super.onCreate()
        ensureScreenShareChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_START_SCREEN_SHARE -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(EXTRA_RESULT_DATA)
                }

                if (resultCode != 0 && resultData != null) {
                    startScreenCapture(resultCode, resultData)
                } else {
                    Log.e(tag, "Missing resultCode or resultData for screen capture")
                    stopSelf()
                }
            }

            ACTION_STOP_SCREEN_SHARE -> {
                stopScreenCapture()
            }
        }

        return START_NOT_STICKY
    }

    private fun ensureScreenShareChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID_SCREEN_SHARE,
                "Screen Sharing Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "দৃষ্টি প্রতিবন্ধী ভাই ও বোনদের জন্য লাইভ স্ক্রিন শেয়ারিং বিজ্ঞপ্তি"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(stopPendingIntent: PendingIntent): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            REQUEST_CODE_OPEN_APP,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID_SCREEN_SHARE)
            .setSmallIcon(R.drawable.ic_screen_share_notif)
            .setContentTitle("স্ক্রিন শেয়ারিং সক্রিয় রয়েছে")
            .setContentText("ওয়েবসাইটে লাইভ স্ক্রিন শেয়ার চলছে। বন্ধ করতে ট্যাপ করুন।")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(contentPendingIntent)
            .addAction(
                R.drawable.ic_screen_share_notif,
                "স্ক্রিন শেয়ার বন্ধ করুন",
                stopPendingIntent
            )
            .build()
    }

    private fun ensureCaptureWorker(): Handler {
        val existing = captureHandler
        if (existing != null && captureThread?.isAlive == true) {
            return existing
        }
        val thread = HandlerThread("ScreenCaptureWorker", Process.THREAD_PRIORITY_MORE_FAVORABLE).apply {
            start()
        }
        val handler = Handler(thread.looper)
        captureThread = thread
        captureHandler = handler
        return handler
    }

    private fun startScreenCapture(resultCode: Int, resultData: Intent) {
        try {
            val stopIntent = Intent(this, ScreenShareService::class.java).apply {
                action = ACTION_STOP_SCREEN_SHARE
            }
            val stopPendingIntent = PendingIntent.getService(
                this,
                REQUEST_CODE_STOP_SERVICE,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = buildForegroundNotification(stopPendingIntent)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID_SCREEN_SHARE,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                )
            } else {
                startForeground(NOTIFICATION_ID_SCREEN_SHARE, notification)
            }

            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    Log.d(tag, "MediaProjection stopped by system or user")
                    stopScreenCapture()
                }
            }, mainHandler)

            val metrics = resources.displayMetrics
            val rawW = metrics.widthPixels.coerceAtLeast(480)
            val rawH = metrics.heightPixels.coerceAtLeast(800)

            val captureScale = (720f / rawW.toFloat()).coerceAtMost(1.0f)
            val width = (((rawW * captureScale).toInt().coerceAtLeast(360)) / 2) * 2
            val height = (((rawH * captureScale).toInt().coerceAtLeast(640)) / 2) * 2
            val density = (metrics.densityDpi * captureScale).toInt().coerceAtLeast(160)

            val workerHandler = ensureCaptureWorker()
            lastFrameTime = 0L
            lastSentFrameHash = 0L
            lastSentKeyFrameTime = 0L

            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2).apply {
                setOnImageAvailableListener({ reader ->
                    var image: Image? = null
                    try {
                        image = reader.acquireLatestImage()
                        if (image != null) {
                            val now = System.currentTimeMillis()
                            if (now - lastFrameTime >= 70L) {
                                lastFrameTime = now
                                val planes = image.planes
                                val buffer = planes[0].buffer
                                val pixelStride = planes[0].pixelStride
                                val rowStride = planes[0].rowStride
                                val rowPadding = rowStride - pixelStride * width

                                val bmp = Bitmap.createBitmap(
                                    width + rowPadding / pixelStride,
                                    height,
                                    Bitmap.Config.ARGB_8888
                                )
                                bmp.copyPixelsFromBuffer(buffer)
                                val baseBitmap = if (rowPadding == 0) {
                                    bmp
                                } else {
                                    val trimmed = Bitmap.createBitmap(bmp, 0, 0, width, height)
                                    bmp.recycle()
                                    trimmed
                                }

                                val currentMode = ScreenShareManager.cropMode.value
                                if (currentMode == ScreenShareManager.ScreenCropMode.QR_CODE_ONLY) {
                                    QrCodeDetector.processFrameAsync(baseBitmap)
                                }

                                val croppedBitmap = ScreenShareManager.applyCrop(baseBitmap)
                                val streamBitmap = scaleForFastStreaming(croppedBitmap, currentMode)

                                val currentZoomBits = ScreenShareManager.zoomScale.value.toBits()
                                val frameHash = computeFastFrameHash(streamBitmap)
                                val configChanged = currentMode.ordinal != lastCropModeOrdinal || currentZoomBits != lastZoomBits
                                val hasPixelChange = frameHash != lastSentFrameHash || configChanged
                                val needsHeartbeatKeyframe = (now - lastSentKeyFrameTime) >= 1800L

                                if (hasPixelChange || needsHeartbeatKeyframe) {
                                    lastSentFrameHash = frameHash
                                    lastSentKeyFrameTime = now
                                    lastCropModeOrdinal = currentMode.ordinal
                                    lastZoomBits = currentZoomBits

                                    val jpegQuality = if (currentMode == ScreenShareManager.ScreenCropMode.QR_CODE_ONLY) 70 else 62
                                    reusableBaos.reset()
                                    streamBitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality, reusableBaos)
                                    val jpegBytes = reusableBaos.toByteArray()

                                    ScreenShareManager.updateLatestFrame(streamBitmap, jpegBytes)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(tag, "Error processing frame: ${e.message}")
                    } finally {
                        image?.close()
                    }
                }, workerHandler)
            }

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "LinkAssistantScreenShare",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                workerHandler
            )

            ScreenShareManager.onShareStarted(applicationContext)
            Log.i(tag, "Screen sharing running off-main-thread at ${width}x${height}")
        } catch (e: Exception) {
            Log.e(tag, "Failed to start screen capture: ${e.message}", e)
            stopScreenCapture()
        }
    }

    private fun scaleForFastStreaming(source: Bitmap, mode: ScreenShareManager.ScreenCropMode): Bitmap {
        val w = source.width
        val h = source.height
        if (w <= 0 || h <= 0) return source

        val maxDim = if (mode == ScreenShareManager.ScreenCropMode.QR_CODE_ONLY) 460 else 640
        val longest = maxOf(w, h)
        if (longest <= maxDim) return source

        val scale = maxDim.toFloat() / longest.toFloat()
        val targetW = (w * scale).toInt().coerceAtLeast(64)
        val targetH = (h * scale).toInt().coerceAtLeast(64)
        return Bitmap.createScaledBitmap(source, targetW, targetH, true)
    }

    private fun computeFastFrameHash(bitmap: Bitmap): Long {
        val w = bitmap.width
        val h = bitmap.height
        if (w < 10 || h < 10) return 0L
        var hash = (w.toLong() shl 32) xor h.toLong()
        val stepX = (w / 10).coerceAtLeast(1)
        val stepY = (h / 10).coerceAtLeast(1)
        var y = stepY / 2
        while (y < h) {
            var x = stepX / 2
            while (x < w) {
                val px = bitmap.getPixel(x, y) and 0xFCFCFC
                hash = (hash * 31L) xor px.toLong()
                x += stepX
            }
            y += stepY
        }
        return hash
    }

    private fun stopScreenCapture() {
        try {
            virtualDisplay?.release()
            virtualDisplay = null

            mediaProjection?.stop()
            mediaProjection = null

            imageReader?.close()
            imageReader = null

            captureThread?.quitSafely()
            captureThread = null
            captureHandler = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }

            ScreenShareManager.onShareStopped(applicationContext)
            stopSelf()
            Log.i(tag, "Screen capture service stopped cleanly")
        } catch (e: Exception) {
            Log.e(tag, "Error stopping screen capture: ${e.message}", e)
        }
    }

    override fun onDestroy() {
        stopScreenCapture()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START_SCREEN_SHARE = "com.example.ACTION_START_SCREEN_SHARE"
        const val ACTION_STOP_SCREEN_SHARE = "com.example.ACTION_STOP_SCREEN_SHARE"
        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"

        private const val CHANNEL_ID_SCREEN_SHARE = "link_assistant_screen_share"
        private const val NOTIFICATION_ID_SCREEN_SHARE = 3001
        private const val REQUEST_CODE_OPEN_APP = 301
        private const val REQUEST_CODE_STOP_SERVICE = 501
    }
}
