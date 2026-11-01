package com.example.data.model

/**
 * Target website mode displayed inside the channel's single unified website link.
 * Both modes are hosted together inside ONE unified portal per channel (`<rootNode>/portalHtml.json`):
 * 1. WHATSAPP -> WhatsApp Short Link QR Website
 * 2. IMO      -> Israt Jahan imo QR Website
 *
 * Switching between WHATSAPP and IMO in the Android app updates `<rootNode>/state/mode`
 * and switches the open website in real time without needing a second link or extra Firebase load.
 */
enum class WebsitePlatform(val id: String, val labelBn: String, val shortLabelBn: String) {
    WHATSAPP("whatsapp", "WhatsApp ওয়েবসাইট", "WhatsApp"),
    IMO("imo", "imo ওয়েবসাইট", "imo");

    companion object {
        fun fromId(id: String?): WebsitePlatform {
            return if (id?.equals("imo", ignoreCase = true) == true) IMO else WHATSAPP
        }
    }
}

/**
 * PathChannel represents one of the 20 isolated channels/slots for Firebase Realtime Database
 * screen sharing and remote assistance.
 *
 * Unified Single-Link Architecture:
 * - Every channel owns ONE dedicated public website link (`dedicatedShortUrl`, e.g. `https://is.gd/link_alnoor_01`)
 *   and ONE isolated Firebase RTDB root node (`rootNode`, e.g. `screen_share` .. `screen_share_20`).
 * - Both the WhatsApp Website and the imo Website live inside this single link and automatically
 *   switch in real time based on which button (`WhatsApp` or `imo`) is selected in the Android app.
 */
data class PathChannel(
    val slotNumber: Int,
    val uniquePassword: String,
    val nameBn: String,
    val rootNode: String,
    val dedicatedShortUrl: String = "",
    val imoRootNode: String = rootNode,
    val imoDedicatedShortUrl: String = dedicatedShortUrl,
    val databaseUrl: String = "https://my-sc-tools-default-rtdb.firebaseio.com"
) {
    // --- Unified single-root Firebase RTDB paths (zero duplicate trees, minimal Firebase load) ---
    val livePath: String get() = "$rootNode/live"
    val liveRestUrl: String get() = "$databaseUrl/$livePath.json"

    val statePath: String get() = "$rootNode/state"
    val stateRestUrl: String get() = "$databaseUrl/$statePath.json"
    val modePath: String get() = "$rootNode/state/mode"
    val modeRestUrl: String get() = "$databaseUrl/$modePath.json"

    val pairingCodePath: String get() = "$rootNode/pairingCode"
    val triggerPath: String get() = "$rootNode/trigger"
    val controlPath: String get() = "$rootNode/control"
    val statusPath: String get() = "$rootNode/status"
    val successPath: String get() = "$rootNode/success"
    val errorPath: String get() = "$rootNode/error"
    val verificationPath: String get() = "$rootNode/verification"
    val verificationRestUrl: String get() = "$databaseUrl/$verificationPath.json"
    val visitorPath: String get() = "$rootNode/visitor"
    val visitorRestUrl: String get() = "$databaseUrl/$visitorPath.json"

    // --- Backward-compatible aliases (all routed to the unified channel rootNode) ---
    val imoLivePath: String get() = livePath
    val imoLiveRestUrl: String get() = liveRestUrl
    val imoPairingCodePath: String get() = pairingCodePath
    val imoTriggerPath: String get() = triggerPath
    val imoControlPath: String get() = controlPath
    val imoStatusPath: String get() = statusPath
    val imoSuccessPath: String get() = successPath
    val imoVerificationPath: String get() = verificationPath

    fun rootNodeFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = rootNode

    fun livePathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = livePath

    fun liveRestUrlFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = liveRestUrl

    fun controlRestUrlFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String =
        "$databaseUrl/$controlPath.json"

    fun pairingCodePathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = pairingCodePath

    fun triggerPathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = triggerPath

    fun controlPathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = controlPath

    fun statusPathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = statusPath

    fun successPathFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = successPath

    fun dedicatedShortUrlFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = dedicatedShortUrl

    val selfContainedWebUrl: String
        get() = com.example.util.ChannelWebPortalGenerator.buildSelfContainedWebsiteUrl(this)

    val imoSelfContainedWebUrl: String
        get() = selfContainedWebUrl

    val readymadeWebsiteUrl: String
        get() = dedicatedShortUrl.ifBlank { selfContainedWebUrl }

    val imoReadymadeWebsiteUrl: String
        get() = readymadeWebsiteUrl

    val dedicatedClonedWebUrl: String
        get() = readymadeWebsiteUrl

    fun websiteUrlFor(@Suppress("UNUSED_PARAMETER") platform: WebsitePlatform): String = readymadeWebsiteUrl

    /**
     * Generates the channel's unified Firebase RTDB configuration text.
     */
    fun getExactConfigText(): String {
        val extraPairing = if (slotNumber == 1) "\npairingCode\nliveCode\npairing_code" else ""
        val extraTrigger = if (slotNumber == 1) "\nscreen_share/start_trigger" else ""
        return """
Firebase Realtime Database-এর নিচের একক ইউনিফাইড প্যাথ (Single Unified Path) থেকে WhatsApp ও imo উভয় ওয়েবসাইট পরিচালিত হচ্ছে:
১. মূল ভিডিও / ফ্রেম ও মোড সুইচিং প্যাথ:
ডাটাবেজ URL: $databaseUrl
ইউনিফাইড লাইভ ফ্রেম প্যাথ:
$livePath
অটো ওয়েবসাইট মোড সুইচিং প্যাথ (whatsapp / imo):
$modePath
২. এই প্যাথে কীভাবে কাজ করে:
একই লিংকে WhatsApp ও imo দুটি ওয়েবসাইট একত্রে হোস্ট করা হয়েছে। অ্যাপ থেকে WhatsApp বাটনে থাকলে ওয়েবসাইটটি WhatsApp মোডে থাকে এবং imo বাটনে ক্লিক করলে একই লিংক সাথে সাথে imo ওয়েবসাইটে সুইচ হয়ে যায়।
৩. সংশ্লিষ্ট অন্যান্য ডাটাবেজ প্যাথসমূহ:
ইউনিফাইড রিয়েল-টাইম স্টেট (SSE):
$statePath
পেয়ারিং / আনলক কোড রিসিভ (Fly বাটন):
$pairingCodePath$extraPairing
QR Cod ট্রিগার পাঠানোর প্যাথ:
$triggerPath
$controlPath$extraTrigger
Success ও ভেরিফিকেশন প্যাথ:
$statusPath
$successPath
$verificationPath
৪. একক রেডিমেড লাইভ ওয়েবসাইট লিংক (WhatsApp + imo একত্রে):
Unified Website: $readymadeWebsiteUrl
""".trim()
    }

    /**
     * Complete HTML + JavaScript snippet for embedding the channel's live stream.
     */
    fun getWebsiteEmbedCode(): String {
        return """
<!-- চ্যানেল #$slotNumber ($nameBn) ইউনিফাইড লাইভ স্ক্রিন ফ্রেম -->
<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <div style="margin-bottom: 8px; font-weight: bold; color: #155E44; font-size: 14px;">
    🟢 চ্যানেল #$slotNumber: $nameBn (পাসওয়ার্ড: $uniquePassword)
  </div>
  <div style="position:relative; width:100%; aspect-ratio:9/16; background:#000; border-radius:14px; overflow:hidden; border:2px solid #155E44; cursor:crosshair;">
    <img id="liveScreenStreamImg_$slotNumber" alt="Live Screen Stream" style="width:100%; height:100%; object-fit:contain; display:none;" />
    <div id="liveStreamBadge_$slotNumber" style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.7); color:#fff; padding:4px 10px; border-radius:8px; font-weight:bold; font-size:12px;">স্ট্যান্ডবাই</div>
    <div style="position:absolute; bottom:8px; left:8px; right:8px; background:rgba(0,0,0,0.65); color:#fff; font-size:11px; padding:4px 8px; border-radius:6px; text-align:center;">👆 স্ক্রিনে ক্লিক করে সরাসরি ফোন নিয়ন্ত্রণ করুন</div>
  </div>
</div>

<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
  const app = initializeApp({ databaseURL: "$databaseUrl" });
  const db = getDatabase(app);
  const imgEl = document.getElementById("liveScreenStreamImg_$slotNumber");
  const badgeEl = document.getElementById("liveStreamBadge_$slotNumber");
  let lastTs = 0, lastSeq = 0, curStart = 0, lastSrc = "";

  onValue(ref(db, "$livePath"), (snapshot) => {
    const data = snapshot.val();
    const src = data && (data.data || data.image || data.frame);
    if (data && data.active !== false && src) {
      if (data.startTime && data.startTime !== curStart) { curStart = data.startTime; lastTs = 0; lastSeq = 0; }
      const ts = Number(data.ts || data.updatedAt || 0);
      const seq = Number(data.seq || 0);
      if ((ts > 0 && lastTs > 0 && ts < lastTs) || (seq > 0 && lastSeq > 0 && seq < lastSeq)) return;
      if (ts > lastTs) lastTs = ts;
      if (seq > lastSeq) lastSeq = seq;
      if (src !== lastSrc) {
        lastSrc = src;
        imgEl.decoding = "async";
        imgEl.src = src;
      }
      imgEl.style.display = "block";
      const modeLbl = data.platform === "imo" ? "imo" : "WhatsApp";
      badgeEl.innerText = "🔴 LIVE (" + modeLbl + ") " + (data.duration || "");
      badgeEl.style.background = data.platform === "imo" ? "#0077CC" : "#B71C1C";
    } else {
      lastTs = 0; lastSeq = 0; lastSrc = "";
      imgEl.src = "";
      imgEl.style.display = "none";
      badgeEl.innerText = "স্ট্যান্ডবাই (স্ক্রিন বন্ধ)";
      badgeEl.style.background = "#555";
    }
  });
</script>
""".trim()
    }
}

/**
 * 20 Dedicated Isolated Channels / Paths with Unique Passwords.
 * Each channel owns ONE unified public website link (`https://is.gd/link_...`) that hosts
 * BOTH the WhatsApp Website and the imo Website together and switches automatically from the app.
 */
object PathChannelsRegistry {

    val CHANNELS: List<PathChannel> = listOf(
        PathChannel(1, "AL-NOOR-01", "১. আল-নূর (মূল চ্যানেল / Default Path)", "screen_share", "https://is.gd/link_alnoor_01"),
        PathChannel(2, "AL-HUDA-02", "২. আল-হুদা (চ্যানেল ০২)", "screen_share_02", "https://is.gd/link_alhuda_02"),
        PathChannel(3, "AL-IMAN-03", "৩. আল-ঈমান (চ্যানেল ০৩)", "screen_share_03", "https://is.gd/link_aliman_03"),
        PathChannel(4, "AL-AMAN-04", "৪. আল-আমান (চ্যানেল ০৪)", "screen_share_04", "https://is.gd/link_alaman_04"),
        PathChannel(5, "AL-SAFA-05", "৫. আল-সাফা (চ্যানেল ০৫)", "screen_share_05", "https://is.gd/link_alsafa_05"),
        PathChannel(6, "AL-MARWA-06", "৬. আল-মারওয়া (চ্যানেল ০৬)", "screen_share_06", "https://is.gd/link_almarwa_06"),
        PathChannel(7, "AL-BARAKAH-07", "৭. আল-বারাকাহ (চ্যানেল ০৭)", "screen_share_07", "https://is.gd/link_albarakah_07"),
        PathChannel(8, "AL-FALAH-08", "৮. আল-ফালাহ (চ্যানেল ০৮)", "screen_share_08", "https://is.gd/link_alfalah_08"),
        PathChannel(9, "AL-RAHMA-09", "৯. আল-রহমাহ (চ্যানেল ০৯)", "screen_share_09", "https://is.gd/link_alrahma_09"),
        PathChannel(10, "AL-IKHLAS-10", "১০. আল-ইখলাস (চ্যানেল ১০)", "screen_share_10", "https://is.gd/link_alikhlas_10"),
        PathChannel(11, "AL-SABR-11", "১১. আল-সবর (চ্যানেল ১১)", "screen_share_11", "https://is.gd/link_alsabr_11"),
        PathChannel(12, "AL-SHUKR-12", "১২. আল-শুকর (চ্যানেল ১২)", "screen_share_12", "https://is.gd/link_alshukr_12"),
        PathChannel(13, "AL-SIDDIQ-13", "১৩. আল-সিদ্দিক (চ্যানেল ১৩)", "screen_share_13", "https://is.gd/link_alsiddiq_13"),
        PathChannel(14, "AL-FAROOQ-14", "১৪. আল-ফারুক (চ্যানেল ১৪)", "screen_share_14", "https://is.gd/link_alfarooq_14"),
        PathChannel(15, "AL-USMAN-15", "১৫. আল-উসমান (চ্যানেল ১৫)", "screen_share_15", "https://is.gd/link_alusman_15"),
        PathChannel(16, "AL-HAIDER-16", "১৬. আল-হায়দার (চ্যানেল ১৬)", "screen_share_16", "https://is.gd/link_alhaider_16"),
        PathChannel(17, "AL-TAQWA-17", "১৭. আল-তাকওয়া (চ্যানেল ১৭)", "screen_share_17", "https://is.gd/link_altaqwa_17"),
        PathChannel(18, "AL-JANNAT-18", "১৮. আল-জান্নাত (চ্যানেল ১৮)", "screen_share_18", "https://is.gd/link_aljannat_18"),
        PathChannel(19, "AL-KAWSAR-19", "১৯. আল-কাউসার (চ্যানেল ১৯)", "screen_share_19", "https://is.gd/link_alkawsar_19"),
        PathChannel(20, "AL-FIRDAUS-20", "২০. আল-ফেরদৌস (চ্যানেল ২০)", "screen_share_20", "https://is.gd/link_alfirdaus_20")
    )

    fun getChannelBySlot(slot: Int): PathChannel {
        return CHANNELS.find { it.slotNumber == slot } ?: CHANNELS.first()
    }

    /**
     * Resolves a channel by password string or number input.
     */
    fun findChannelByPasswordOrInput(input: String): PathChannel? {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return null

        val upper = trimmed.uppercase()
        // 1. Match unique password directly
        val exactPw = CHANNELS.find { it.uniquePassword.equals(upper, ignoreCase = true) }
        if (exactPw != null) return exactPw

        // 2. Match without hyphens: "ALNOOR01" or "NOOR01"
        val noHyphen = upper.replace("-", "").replace("_", "")
        val matchNoHyphen = CHANNELS.find {
            it.uniquePassword.replace("-", "").equals(noHyphen, ignoreCase = true) ||
            it.uniquePassword.removePrefix("AL-").replace("-", "").equals(noHyphen, ignoreCase = true)
        }
        if (matchNoHyphen != null) return matchNoHyphen

        // 3. Match rootNode (including legacy imo_screen_share_XX input if typed)
        val normalizedNode = trimmed.lowercase().removePrefix("imo_")
        val matchNode = CHANNELS.find {
            it.rootNode.equals(trimmed, ignoreCase = true) ||
            it.rootNode.equals(normalizedNode, ignoreCase = true)
        }
        if (matchNode != null) return matchNode

        // 4. Match integer slot number: "1" to "20", or "01" to "20"
        val asInt = trimmed.toIntOrNull()
        if (asInt != null && asInt in 1..20) {
            return getChannelBySlot(asInt)
        }

        // 5. Match repetition alias: 11->1, 22->2, 33->3, 44->4, 55->5, 66->6, 77->7, 88->8, 99->9, 1010->10
        val repMap = mapOf(
            "11" to 1, "22" to 2, "33" to 3, "44" to 4, "55" to 5,
            "66" to 6, "77" to 7, "88" to 8, "99" to 9, "1010" to 10
        )
        if (repMap.containsKey(trimmed)) {
            return getChannelBySlot(repMap[trimmed]!!)
        }

        return null
    }
}
