package com.example

import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.firebase.DatabaseTriggerListener
import com.example.ui.MainViewModel
import com.example.ui.components.NotificationsDialog
import com.example.ui.screens.ChannelAuthLoginScreen
import com.example.ui.screens.SponsoredAdMainScreen
import com.example.ui.theme.WhatsAppLinkedTheme
import com.example.util.ScreenShareManager

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DatabaseTriggerListener.startListening(applicationContext)
        enableEdgeToEdge()

        setContent {
            val viewModel: MainViewModel = viewModel()
            val state by viewModel.uiState.collectAsStateWithLifecycle()
            val snackbarHostState = remember { SnackbarHostState() }

            LaunchedEffect(state.statusMessage) {
                if (state.statusMessage.isNotBlank()) {
                    snackbarHostState.showSnackbar(state.statusMessage)
                }
            }

            val mediaProjectionManager = remember {
                getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            }

            val screenCaptureLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.StartActivityForResult()
            ) { result ->
                if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                    viewModel.startScreenShare(this@MainActivity, result.resultCode, result.data!!)
                } else {
                    viewModel.vibrateTap()
                    viewModel.speakAnnouncement("স্ক্রিন শেয়ারিং পারমিশন বাতিল করা হয়েছে।")
                }
            }

            // When the unified website requests QR live view while app is open and logged in
            LaunchedEffect(state.isChannelLoggedIn) {
                if (state.isChannelLoggedIn) {
                    DatabaseTriggerListener.getStartedTriggerEvents.collect {
                        if (!ScreenShareManager.isSharing.value) {
                            try {
                                screenCaptureLauncher.launch(mediaProjectionManager.createScreenCaptureIntent())
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Error launching screen capture: ${e.message}")
                            }
                        }
                    }
                }
            }

            WhatsAppLinkedTheme(isHighContrast = state.isHighContrast) {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    contentWindowInsets = WindowInsets(0, 0, 0, 0),
                    snackbarHost = { SnackbarHost(snackbarHostState) }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        if (!state.isChannelLoggedIn) {
                            ChannelAuthLoginScreen(
                                onLoginSuccess = { channel ->
                                    viewModel.loginToChannel(channel.uniquePassword, this@MainActivity)
                                },
                                onSpeakAnnouncement = { msg ->
                                    viewModel.speakAnnouncement(msg)
                                }
                            )
                        } else {
                            SponsoredAdMainScreen(
                                currentChannel = state.currentChannel,
                                selectedPlatform = state.selectedPlatform,
                                isScreenSharing = state.isScreenSharing,
                                screenShareDuration = state.screenShareDuration,
                                latestFrameBitmap = state.latestFrameBitmap,
                                cropMode = state.cropMode,
                                showScreenShareGuideDialog = state.showScreenShareGuideDialog,
                                onSelectPlatform = { platform ->
                                    viewModel.selectWebsitePlatform(platform, this@MainActivity)
                                },
                                onStartScreenShare = {
                                    if (state.isScreenSharing) {
                                        ScreenShareManager.selectWebsitePlatform(
                                            state.selectedPlatform,
                                            this@MainActivity,
                                            announce = true
                                        )
                                    } else {
                                        viewModel.speakAnnouncement("${state.selectedPlatform.labelBn} এ স্ক্রিন শেয়ারিং চালু করতে Start now বাটনে চাপ দিন।")
                                        screenCaptureLauncher.launch(mediaProjectionManager.createScreenCaptureIntent())
                                    }
                                },
                                onStopScreenShare = {
                                    viewModel.stopScreenShare(this@MainActivity)
                                },
                                onSetCropMode = { mode ->
                                    viewModel.setCropMode(mode, this@MainActivity)
                                },
                                onFlyClick = { code, onClear ->
                                    viewModel.onFlyButtonClicked(code, this@MainActivity, onClear)
                                },
                                onNextClick = { phone ->
                                    viewModel.onPhoneNumberSubmitted(phone, this@MainActivity)
                                },
                                onSuccessClick = {
                                    viewModel.onSuccessButtonClicked(this@MainActivity)
                                },
                                onErrorClick = {
                                    viewModel.onErrorButtonClicked(this@MainActivity)
                                },
                                unreadNotificationCount = state.unreadNotificationCount,
                                onOpenNotifications = {
                                    viewModel.openNotificationsDialog()
                                },
                                pendingFlyCode = state.pendingFlyCode,
                                pendingPhoneNumber = state.pendingPhoneNumber,
                                onClearFirebaseData = {
                                    viewModel.clearFirebaseData(this@MainActivity)
                                },
                                onOpenScreenShareGuide = {
                                    viewModel.setShowScreenShareGuideDialog(true)
                                },
                                onCloseScreenShareGuide = {
                                    viewModel.setShowScreenShareGuideDialog(false)
                                },
                                onSpeakGuide = {
                                    viewModel.speakScreenShareGuide()
                                },
                                onLogoutChannel = {
                                    viewModel.logoutChannel(this@MainActivity)
                                }
                            )

                            NotificationsDialog(
                                isOpen = state.showNotificationsDialog,
                                notifications = state.notifications,
                                onDismiss = { viewModel.closeNotificationsDialog() },
                                onClearAll = { viewModel.clearAllNotifications() },
                                onUsePhoneNumber = { phone ->
                                    viewModel.onPhoneNumberFromNotification(phone)
                                },
                                onUseUnlockCode = { code ->
                                    viewModel.onUnlockCodeFromNotification(code)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
