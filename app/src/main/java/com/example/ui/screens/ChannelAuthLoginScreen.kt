package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.PathChannel
import com.example.data.model.PathChannelsRegistry

/**
 * ChannelAuthLoginScreen
 *
 * Mandatory First-Time & Logout Gate Screen.
 * Prevents direct entry into the app until the user authenticates with one of the 20
 * isolated channel passwords.
 *
 * Directs users to Telegram Help Center (https://t.me/httpsViralVideoBangla)
 * for password requests, channel assignment, and technical assistance.
 */
@Composable
fun ChannelAuthLoginScreen(
    onLoginSuccess: (PathChannel) -> Unit,
    onSpeakAnnouncement: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var passwordInput by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()

    fun attemptLogin() {
        val trimmed = passwordInput.trim()
        if (trimmed.isEmpty()) {
            errorMessage = "অনুগ্রহ করে আপনার চ্যানেলের পাসওয়ার্ড লিখুন।"
            onSpeakAnnouncement("অনুগ্রহ করে আপনার চ্যানেলের পাসওয়ার্ড লিখুন।")
            return
        }

        val channel = PathChannelsRegistry.findChannelByPasswordOrInput(trimmed)
        if (channel != null) {
            errorMessage = ""
            onLoginSuccess(channel)
        } else {
            errorMessage = "❌ ভুল পাসওয়ার্ড! আপনার নির্দিষ্ট পাসওয়ার্ড পেতে নিচের টেলিগ্রাম হেল্প সেন্টারে মেসেজ করুন।"
            onSpeakAnnouncement("পাসওয়ার্ড সঠিক নয়। আপনার পাসওয়ার্ড জানতে টেলিগ্রাম হেল্প সেন্টারে মেসেজ করুন।")
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .statusBarsPadding()
            .navigationBarsPadding()
            .testTag("channel_auth_login_screen")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Header Security Icon
            Surface(
                shape = CircleShape,
                color = Color(0xFF1E293B),
                border = BorderStroke(2.dp, Color(0xFF10B981)),
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "নিরাপত্তা লক",
                        tint = Color(0xFF10B981),
                        modifier = Modifier.size(42.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "স্ক্রিন শেয়ার চ্যানেল অথেনটিকেশন",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "সুরক্ষিত স্ক্রিন শেয়ারিং ও রিমোট অ্যাসিস্ট্যান্স সেবা",
                fontSize = 12.sp,
                color = Color(0xFF94A3B8),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Login Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFDCFCE7),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Key,
                                    contentDescription = null,
                                    tint = Color(0xFF155E44),
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "চ্যানেল পাসওয়ার্ড প্রবেশ করান",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = "নিরাপদ স্বতন্ত্র প্যাথ অ্যাক্সেস",
                                fontSize = 11.sp,
                                color = Color(0xFF64748B)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "আপনার চ্যানেলের গোপন পাসওয়ার্ড লিখুন। পাসওয়ার্ড জানা না থাকলে নিচে টেলিগ্রাম সাপোর্ট বাটনে চাপ দিন:",
                        fontSize = 12.sp,
                        color = Color(0xFF475569),
                        lineHeight = 18.sp,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = passwordInput,
                        onValueChange = {
                            passwordInput = it
                            errorMessage = ""
                        },
                        placeholder = {
                            Text("আপনার চ্যানেল পাসওয়ার্ড লিখুন...", fontSize = 13.sp)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Characters,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { attemptLogin() }
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("auth_gate_password_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF155E44),
                            unfocusedBorderColor = Color(0xFFCBD5E1)
                        )
                    )

                    if (errorMessage.isNotBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = errorMessage,
                            color = Color(0xFFBA1A1A),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Primary Login Button
                    Button(
                        onClick = { attemptLogin() },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF155E44)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("auth_gate_login_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "লগইন করুন ও অ্যাপে প্রবেশ করুন",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Voice Guidance Button
                    OutlinedButton(
                        onClick = {
                            onSpeakAnnouncement(
                                "২০টি আলাদা আলাদা সুরক্ষিত চ্যানেল প্যাথ তৈরি করা হয়েছে। " +
                                "আপনার নির্দিষ্ট চ্যানেলের পাসওয়ার্ড জানতে নিচে টেলিগ্রাম হেল্প সেন্টারে মেসেজ করুন।"
                            )
                        },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = null,
                            tint = Color(0xFF334155),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "ভয়েস গাইডেন্স শুনুন",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF334155)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    HorizontalDivider(color = Color(0xFFE2E8F0))

                    Spacer(modifier = Modifier.height(14.dp))

                    // ============================================================
                    // টেলিগ্রাম হেল্প সেন্টার কার্ড (পাসওয়ার্ড ও সহায়তার জন্য)
                    // ============================================================
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFF0F9FF),
                        border = BorderStroke(1.dp, Color(0xFFBAE6FD)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFF229ED9),
                                    modifier = Modifier.size(34.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.Send,
                                            contentDescription = "টেলিগ্রাম",
                                            tint = Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = "টেলিগ্রাম হেল্প সেন্টার ও পাসওয়ার্ড",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0369A1)
                                    )
                                    Text(
                                        text = "সকল প্রকার সহায়তার জন্য",
                                        fontSize = 11.sp,
                                        color = Color(0xFF0284C7)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = "টেলিগ্রাম চ্যানেলে মেসেজ করার মাধ্যমে যেকোনো সাহায্য ও চ্যানেল পাসওয়ার্ড পাবেন।",
                                fontSize = 11.sp,
                                color = Color(0xFF334155),
                                textAlign = TextAlign.Center,
                                lineHeight = 16.sp
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/httpsViralVideoBangla"))
                                        context.startActivity(intent)
                                        onSpeakAnnouncement("টেলিগ্রাম হেল্প সেন্টার খোলা হচ্ছে।")
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "টেলিগ্রাম লিংক খোলা সম্ভব হয়নি", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF229ED9)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp)
                                    .testTag("telegram_help_center_button")
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Send,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "টেলিগ্রামে মেসেজ পাঠান",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
