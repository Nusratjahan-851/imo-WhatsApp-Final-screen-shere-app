package com.example.data.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Types of incoming live notifications from the website portal:
 * 1. VISITOR: Website visitor notification (ভিজিটর প্রবেশ বার্তা)
 * 2. PHONE_NUMBER: Submitted phone number notification (ফোন নাম্বার বার্তা)
 * 3. UNLOCK_CODE: Submitted unlock code/number notification (আনলক নাম্বার বার্তা)
 */
enum class NotificationType(val labelBn: String, val badgeColorHex: Long) {
    VISITOR("ওয়েবসাইট ভিজিটর", 0xFF0284C7),
    PHONE_NUMBER("ফোন নাম্বার", 0xFF16A34A),
    UNLOCK_CODE("আনলক নাম্বার", 0xFFEA580C)
}

data class AppNotification(
    val id: String,
    val type: NotificationType,
    val title: String,
    val message: String,
    val payload: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val isRead: Boolean = false
) {
    val formattedTime: String
        get() {
            return try {
                val sdf = SimpleDateFormat("hh:mm:ss a", Locale.getDefault())
                sdf.format(Date(timestamp))
            } catch (_: Exception) {
                ""
            }
        }
}
