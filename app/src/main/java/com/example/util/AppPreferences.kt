package com.example.util

import android.content.Context
import android.content.SharedPreferences
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform

/**
 * Lightweight preferences exclusively for 20-channel authentication
 * and unified WhatsApp + imo website platform state.
 */
class AppPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "whatsapp_link_prefs"

        @Volatile
        private var instance: AppPreferences? = null

        fun getInstance(context: Context): AppPreferences {
            return instance ?: synchronized(this) {
                instance ?: AppPreferences(context.applicationContext).also { instance = it }
            }
        }
    }

    var isHighContrast: Boolean
        get() = prefs.getBoolean("key_high_contrast", false)
        set(value) = prefs.edit().putBoolean("key_high_contrast", value).apply()

    var isHapticFeedback: Boolean
        get() = prefs.getBoolean("key_haptic_feedback", true)
        set(value) = prefs.edit().putBoolean("key_haptic_feedback", value).apply()

    var selectedChannelSlot: Int
        get() = prefs.getInt("key_selected_channel_slot", 1)
        set(value) = prefs.edit().putInt("key_selected_channel_slot", value.coerceIn(1, 20)).apply()

    var selectedWebsitePlatform: WebsitePlatform
        get() = WebsitePlatform.fromId(prefs.getString("key_selected_website_platform", "whatsapp"))
        set(value) = prefs.edit().putString("key_selected_website_platform", value.id).apply()

    var isChannelLoggedIn: Boolean
        get() = prefs.getBoolean("key_is_channel_logged_in", false)
        set(value) = prefs.edit().putBoolean("key_is_channel_logged_in", value).apply()

    var currentChannelPassword: String
        get() = prefs.getString(
            "key_current_channel_password",
            PathChannelsRegistry.getChannelBySlot(selectedChannelSlot).uniquePassword
        ) ?: PathChannelsRegistry.getChannelBySlot(selectedChannelSlot).uniquePassword
        set(value) = prefs.edit().putString("key_current_channel_password", value).apply()

    fun getCurrentChannel(): PathChannel {
        return PathChannelsRegistry.getChannelBySlot(selectedChannelSlot)
    }

    fun loginChannelByPassword(input: String): PathChannel? {
        val found = PathChannelsRegistry.findChannelByPasswordOrInput(input)
        if (found != null) {
            selectedChannelSlot = found.slotNumber
            currentChannelPassword = found.uniquePassword
            isChannelLoggedIn = true
        }
        return found
    }

    fun selectChannelSlot(slotNumber: Int): PathChannel {
        val channel = PathChannelsRegistry.getChannelBySlot(slotNumber)
        selectedChannelSlot = channel.slotNumber
        currentChannelPassword = channel.uniquePassword
        isChannelLoggedIn = true
        return channel
    }

    fun logoutChannel() {
        isChannelLoggedIn = false
    }
}
