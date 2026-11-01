package com.example.util

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

/**
 * Immutable bounding box for detected QR codes.
 * Pure Kotlin properties avoid Android SDK stub issues in unit tests.
 */
data class QrBox(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width: Int get() = right - left
    val height: Int get() = bottom - top
    val centerX: Int get() = (left + right) / 2
    val centerY: Int get() = (top + bottom) / 2
}

/**
 * QrCodeDetector
 *
 * Uses Google ML Kit Barcode Scanning to automatically and accurately detect the
 * exact bounding box of the WhatsApp / imo QR code on the screen.
 *
 * Includes deadzone hysteresis stabilization so micro-pixel shifts never cause
 * the shared QR frame on the website to jitter or jump back and forth.
 */
object QrCodeDetector {

    private const val TAG = "QrCodeDetector"
    private const val STABILIZE_DEADZONE_PX = 10
    private const val MAX_CONSECUTIVE_MISSES = 5

    private val options: BarcodeScannerOptions = BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()

    private val scanner: BarcodeScanner by lazy {
        BarcodeScanning.getClient(options)
    }

    private val isProcessing = AtomicBoolean(false)

    @Volatile
    private var cachedQrBox: QrBox? = null

    @Volatile
    private var cachedSourceWidth: Int = 0

    @Volatile
    private var cachedSourceHeight: Int = 0

    @Volatile
    private var consecutiveMisses: Int = 0

    @Volatile
    private var lastDetectionTime = 0L

    /**
     * Inspects the frame asynchronously using ML Kit Barcode Scanning.
     * Throttled to ~3 detections per second to conserve CPU while keeping
     * the bounding box rock-steady and responsive.
     */
    fun processFrameAsync(bitmap: Bitmap) {
        val now = System.currentTimeMillis()
        val intervalMs = if (cachedQrBox == null) 180L else 340L
        if (now - lastDetectionTime < intervalMs) return
        if (!isProcessing.compareAndSet(false, true)) return

        val srcW = bitmap.width
        val srcH = bitmap.height

        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    lastDetectionTime = System.currentTimeMillis()
                    val qrCode = barcodes.firstOrNull { it.format == Barcode.FORMAT_QR_CODE }
                    if (qrCode != null && qrCode.boundingBox != null) {
                        val rawBox = qrCode.boundingBox!!
                        val adjusted = calculatePaddedSquare(
                            rawBox.left, rawBox.top, rawBox.right, rawBox.bottom,
                            srcW, srcH
                        )
                        if (adjusted != null) {
                            consecutiveMisses = 0
                            cachedQrBox = stabilizeQrBox(cachedQrBox, adjusted, cachedSourceWidth == srcW && cachedSourceHeight == srcH)
                            cachedSourceWidth = srcW
                            cachedSourceHeight = srcH
                        }
                    } else {
                        consecutiveMisses += 1
                        if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
                            cachedQrBox = null
                        }
                    }
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "ML Kit QR code detection failed: ${e.message}")
                }
                .addOnCompleteListener {
                    isProcessing.set(false)
                }
        } catch (e: Exception) {
            Log.w(TAG, "Error initiating ML Kit frame processing: ${e.message}")
            isProcessing.set(false)
        }
    }

    /**
     * Applies deadzone hysteresis so minor 1..10px detection fluctuations do not
     * cause visible crop jumping on the live website view.
     */
    fun stabilizeQrBox(previous: QrBox?, candidate: QrBox, sameDimensions: Boolean = true): QrBox {
        if (previous == null || !sameDimensions) return candidate
        val dx = abs(candidate.centerX - previous.centerX)
        val dy = abs(candidate.centerY - previous.centerY)
        val dw = abs(candidate.width - previous.width)
        return if (dx <= STABILIZE_DEADZONE_PX && dy <= STABILIZE_DEADZONE_PX && dw <= STABILIZE_DEADZONE_PX) {
            previous
        } else {
            candidate
        }
    }

    /**
     * Calculates a padded, perfectly square QrBox centered on the detected QR code.
     * Adds ~12% quiet-zone margin so no QR corners or timing patterns are clipped.
     */
    fun calculatePaddedSquare(rawLeft: Int, rawTop: Int, rawRight: Int, rawBottom: Int, maxWidth: Int, maxHeight: Int): QrBox? {
        val boxWidth = rawRight - rawLeft
        val boxHeight = rawBottom - rawTop
        if (boxWidth < 20 || boxHeight < 20) return null

        val side = maxOf(boxWidth, boxHeight)
        val margin = (side * 0.12f).toInt()
        val paddedSide = side + (margin * 2)

        val centerX = (rawLeft + rawRight) / 2
        val centerY = (rawTop + rawBottom) / 2

        var left = centerX - paddedSide / 2
        var top = centerY - paddedSide / 2
        var right = left + paddedSide
        var bottom = top + paddedSide

        if (left < 0) {
            right -= left
            left = 0
        }
        if (top < 0) {
            bottom -= top
            top = 0
        }
        if (right > maxWidth) {
            val overflow = right - maxWidth
            left = maxOf(0, left - overflow)
            right = maxWidth
        }
        if (bottom > maxHeight) {
            val overflow = bottom - maxHeight
            top = maxOf(0, top - overflow)
            bottom = maxHeight
        }

        val finalSide = minOf(right - left, bottom - top)
        if (finalSide < 40) return null

        return QrBox(left, top, left + finalSide, top + finalSide)
    }

    /**
     * Gets the effective QrBox for cropping, scaling proportionally if queried for
     * physical display coordinates vs downscaled capture coordinates.
     */
    fun getEffectiveQrRect(sourceWidth: Int, sourceHeight: Int): QrBox {
        val cached = cachedQrBox
        val cW = cachedSourceWidth
        val cH = cachedSourceHeight
        if (cached != null && cW > 0 && cH > 0) {
            if (cW == sourceWidth && cH == sourceHeight) {
                if (cached.left >= 0 && cached.top >= 0 &&
                    cached.right <= sourceWidth && cached.bottom <= sourceHeight &&
                    cached.width > 40 && cached.height > 40
                ) {
                    return cached
                }
            } else {
                val sx = sourceWidth.toFloat() / cW.toFloat()
                val sy = sourceHeight.toFloat() / cH.toFloat()
                val scaledLeft = (cached.left * sx).toInt().coerceIn(0, sourceWidth - 40)
                val scaledTop = (cached.top * sy).toInt().coerceIn(0, sourceHeight - 40)
                val scaledSide = (cached.width * minOf(sx, sy)).toInt()
                    .coerceIn(40, minOf(sourceWidth - scaledLeft, sourceHeight - scaledTop))
                return QrBox(scaledLeft, scaledTop, scaledLeft + scaledSide, scaledTop + scaledSide)
            }
        }

        // Safe fallback before first detection occurs
        val fallbackSide = (minOf(sourceWidth, sourceHeight) * 0.45f).toInt().coerceAtLeast(60)
        val left = (sourceWidth - fallbackSide) / 2
        val top = (sourceHeight * 0.42f).toInt() - (fallbackSide / 2)
        val safeTop = top.coerceIn(0, sourceHeight - fallbackSide)
        return QrBox(left, safeTop, left + fallbackSide, safeTop + fallbackSide)
    }

    /**
     * Returns whether a QR code is currently actively detected on the screen.
     */
    fun hasDetectedQrCode(): Boolean = cachedQrBox != null

    /**
     * Resets the cached bounding box (e.g. on stream stop or page refresh).
     */
    fun reset() {
        cachedQrBox = null
        cachedSourceWidth = 0
        cachedSourceHeight = 0
        consecutiveMisses = 0
        lastDetectionTime = 0L
    }
}
