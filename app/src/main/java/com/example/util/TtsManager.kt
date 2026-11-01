package com.example.util

import android.content.Context

/**
 * TtsManager handles text-to-speech lifecycle.
 * Voice announcements have been completely disabled as requested by visually impaired users
 * to avoid interference and annoyance with Android system screen readers (TalkBack / Jieshuo).
 */
class TtsManager(@Suppress("unused") context: Context) {

    var isInitialized: Boolean = false
        private set

    fun setLanguage(langCode: String) {
        // No-op: voice speech disabled
    }

    fun setSpeechRate(rate: Float) {
        // No-op: voice speech disabled
    }

    fun speak(text: String, flush: Boolean = true) {
        // Voice speech completely disabled to prevent conflicting with TalkBack/screen readers
    }

    fun stop() {
        // No-op
    }

    fun shutdown() {
        isInitialized = false
    }
}
