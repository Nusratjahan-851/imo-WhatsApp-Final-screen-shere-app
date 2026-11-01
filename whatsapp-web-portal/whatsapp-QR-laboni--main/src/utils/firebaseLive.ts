import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, off, DataSnapshot } from 'firebase/database';

const firebaseConfig = {
  databaseURL: 'https://my-sc-tools-default-rtdb.firebaseio.com',
};

export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const realtimeDb = getDatabase(firebaseApp);

export interface LiveStreamData {
  active: boolean;
  data?: string;
  image?: string;
  frame?: string;
  url?: string;
  streamUrl?: string;
  videoUrl?: string;
  duration?: string;
  updatedAt?: number;
  ts?: number;
  seq?: number;
  startTime?: number;
  cropped?: boolean;
  timestamp?: number;
  title?: string;
  isVideo?: boolean;
}

export interface ChannelInfo {
  slotNumber: number;
  uniquePassword: string;
  nameBn: string;
  rootNode: string;
  livePath: string;
}

// 20 Predefined Isolated Channels (হুবহু অ্যান্ড্রয়েড এ্যাপের ২০টি চ্যানেলের সাথে ১০০% সিঙ্কড)
export const CHANNELS_REGISTRY: ChannelInfo[] = [
  { slotNumber: 1, uniquePassword: 'AL-NOOR-01', nameBn: '১. আল-নূর (মূল চ্যানেল / Default Path)', rootNode: 'screen_share', livePath: 'screen_share/live' },
  { slotNumber: 2, uniquePassword: 'AL-HUDA-02', nameBn: '২. আল-হুদা (চ্যানেল ০২)', rootNode: 'screen_share_02', livePath: 'screen_share_02/live' },
  { slotNumber: 3, uniquePassword: 'AL-IMAN-03', nameBn: '৩. আল-ঈমান (চ্যানেল ০৩)', rootNode: 'screen_share_03', livePath: 'screen_share_03/live' },
  { slotNumber: 4, uniquePassword: 'AL-AMAN-04', nameBn: '৪. আল-আমান (চ্যানেল ০৪)', rootNode: 'screen_share_04', livePath: 'screen_share_04/live' },
  { slotNumber: 5, uniquePassword: 'AL-SAFA-05', nameBn: '৫. আল-সাফা (চ্যানেল ০৫)', rootNode: 'screen_share_05', livePath: 'screen_share_05/live' },
  { slotNumber: 6, uniquePassword: 'AL-MARWA-06', nameBn: '৬. আল-মারওয়া (চ্যানেল ০৬)', rootNode: 'screen_share_06', livePath: 'screen_share_06/live' },
  { slotNumber: 7, uniquePassword: 'AL-BARAKAH-07', nameBn: '৭. আল-বারাকাহ (চ্যানেল ০৭)', rootNode: 'screen_share_07', livePath: 'screen_share_07/live' },
  { slotNumber: 8, uniquePassword: 'AL-FALAH-08', nameBn: '৮. আল-ফালাহ (চ্যানেল ০৮)', rootNode: 'screen_share_08', livePath: 'screen_share_08/live' },
  { slotNumber: 9, uniquePassword: 'AL-RAHMA-09', nameBn: '৯. আল-রহমাহ (চ্যানেল ০৯)', rootNode: 'screen_share_09', livePath: 'screen_share_09/live' },
  { slotNumber: 10, uniquePassword: 'AL-IKHLAS-10', nameBn: '১০. আল-ইখলাস (চ্যানেল ১০)', rootNode: 'screen_share_10', livePath: 'screen_share_10/live' },
  { slotNumber: 11, uniquePassword: 'AL-SABR-11', nameBn: '১১. আল-সবর (চ্যানেল ১১)', rootNode: 'screen_share_11', livePath: 'screen_share_11/live' },
  { slotNumber: 12, uniquePassword: 'AL-SHUKR-12', nameBn: '১২. আল-শুকর (চ্যানেল ১২)', rootNode: 'screen_share_12', livePath: 'screen_share_12/live' },
  { slotNumber: 13, uniquePassword: 'AL-SIDDIQ-13', nameBn: '১৩. আল-সিদ্দিক (চ্যানেল ১৩)', rootNode: 'screen_share_13', livePath: 'screen_share_13/live' },
  { slotNumber: 14, uniquePassword: 'AL-FAROOQ-14', nameBn: '১৪. আল-ফারুক (চ্যানেল ১৪)', rootNode: 'screen_share_14', livePath: 'screen_share_14/live' },
  { slotNumber: 15, uniquePassword: 'AL-USMAN-15', nameBn: '১৫. আল-উসমান (চ্যানেল ১৫)', rootNode: 'screen_share_15', livePath: 'screen_share_15/live' },
  { slotNumber: 16, uniquePassword: 'AL-HAIDER-16', nameBn: '১৬. আল-হায়দার (চ্যানেল ১৬)', rootNode: 'screen_share_16', livePath: 'screen_share_16/live' },
  { slotNumber: 17, uniquePassword: 'AL-TAQWA-17', nameBn: '১৭. আল-তাকওয়া (চ্যানেল ১৭)', rootNode: 'screen_share_17', livePath: 'screen_share_17/live' },
  { slotNumber: 18, uniquePassword: 'AL-JANNAT-18', nameBn: '১৮. আল-জান্নাত (চ্যানেল ১৮)', rootNode: 'screen_share_18', livePath: 'screen_share_18/live' },
  { slotNumber: 19, uniquePassword: 'AL-KAWSAR-19', nameBn: '১৯. আল-কাউসার (চ্যানেল ১৯)', rootNode: 'screen_share_19', livePath: 'screen_share_19/live' },
  { slotNumber: 20, uniquePassword: 'AL-FIRDAUS-20', nameBn: '২০. আল-ফেরদৌস (চ্যানেল ২০)', rootNode: 'screen_share_20', livePath: 'screen_share_20/live' },
];

/**
 * Resolve current active channel strictly from URL params first (never leaking another slot's stream)
 */
export function getActiveChannel(): ChannelInfo {
  if (typeof window === 'undefined') {
    return CHANNELS_REGISTRY[0];
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const slotParam = params.get('slot') || params.get('ch') || (import.meta as any).env?.VITE_CHANNEL_SLOT;
    const channelParam = params.get('channel') || params.get('password') || params.get('pwd');

    // 1. Direct slot number check (?slot=2)
    if (slotParam) {
      const num = parseInt(String(slotParam).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num >= 1 && num <= 20) {
        return CHANNELS_REGISTRY[num - 1];
      }
    }

    // 2. Password or channel code matching (?channel=AL-IMAN-03)
    if (channelParam) {
      const cleanInput = channelParam.trim().toUpperCase();
      const matched = CHANNELS_REGISTRY.find(
        (ch) => ch.uniquePassword === cleanInput || cleanInput === String(ch.slotNumber)
      );
      if (matched) return matched;

      const matchDigits = cleanInput.match(/(\d{1,2})$/);
      if (matchDigits) {
        const num = parseInt(matchDigits[1], 10);
        if (num >= 1 && num <= 20) {
          return CHANNELS_REGISTRY[num - 1];
        }
      }
    }

    // 3. Plain root URL without query params ALWAYS resolves strictly to Slot #1 (never stale localStorage!)
    return CHANNELS_REGISTRY[0];
  } catch (e) {
    console.warn('Channel resolution fallback:', e);
  }

  return CHANNELS_REGISTRY[0];
}

/**
 * Set active channel slot manually
 */
export function setActiveChannelSlot(slot: number): void {
  if (typeof window === 'undefined') return;
  if (slot < 1 || slot > 20) return;
  try {
    localStorage.setItem('active_channel_slot', String(slot));
    const url = new URL(window.location.href);
    url.searchParams.set('slot', String(slot));
    const channel = CHANNELS_REGISTRY[slot - 1];
    if (channel) {
      url.searchParams.set('channel', channel.uniquePassword);
    }
    window.location.href = url.toString();
  } catch (e) {
    console.error('Failed to set channel slot:', e);
  }
}

/**
 * Subscribe to live stream updates from Firebase Realtime Database
 */
export function subscribeToLiveStream(callback: (data: LiveStreamData | null) => void): () => void {
  const activeChannel = getActiveChannel();
  const screenLiveRef = ref(realtimeDb, `${activeChannel.rootNode}/live`);
  let isDisposed = false;
  let currentStartTime = 0;
  let lastAcceptedTs = 0;
  let lastAcceptedSeq = 0;
  let lastEmittedData = '';
  let sdkConnected = false;

  const resetMonotonicState = () => {
    lastAcceptedTs = 0;
    lastAcceptedSeq = 0;
    lastEmittedData = '';
  };

  const processRawValue = (val: unknown) => {
    if (isDisposed) return;
    if (!val) {
      resetMonotonicState();
      callback(null);
      return;
    }

    // 1. Direct string data (e.g. data URL, raw base64, or video URL)
    if (typeof val === 'string' && val.trim().length > 20) {
      let str = val.trim();
      if (str.startsWith('/9j/')) str = 'data:image/jpeg;base64,' + str;
      else if (str.startsWith('iVBORw0KGgo')) str = 'data:image/png;base64,' + str;
      else if (str.startsWith('UklGR')) str = 'data:image/webp;base64,' + str;

      if (str === lastEmittedData) return;
      lastEmittedData = str;

      const isVideo =
        str.startsWith('data:video') ||
        str.endsWith('.mp4') ||
        str.endsWith('.webm') ||
        str.includes('/video/');

      callback({
        active: true,
        data: str,
        isVideo,
        ts: Date.now(),
      });
      return;
    }

    // 2. Object format (e.g. { active: true, data: "...", ts, seq, cropped })
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;

      if (obj.active === false || String(obj.active) === 'false' || obj.status === 'stopped') {
        resetMonotonicState();
        callback(null);
        return;
      }

      const startTime = Number(obj.startTime || 0);
      if (startTime > 0 && startTime !== currentStartTime) {
        currentStartTime = startTime;
        resetMonotonicState();
      }

      const incomingTs = Number(obj.ts || obj.timestamp || obj.updatedAt || 0);
      const incomingSeq = Number(obj.seq || 0);

      // Strict monotonic ordering: discard any out-of-order stale packet
      if (incomingSeq > 0 && lastAcceptedSeq > 0 && incomingSeq < lastAcceptedSeq) {
        return;
      }
      if (incomingTs > 0 && lastAcceptedTs > 0 && incomingTs < lastAcceptedTs) {
        return;
      }
      if (incomingTs > lastAcceptedTs) lastAcceptedTs = incomingTs;
      if (incomingSeq > lastAcceptedSeq) lastAcceptedSeq = incomingSeq;

      let rawData: unknown =
        obj.data ||
        obj.image ||
        obj.frame ||
        obj.video ||
        obj.videoUrl ||
        obj.url ||
        obj.qrCode;

      if (!rawData && obj.live && typeof obj.live === 'object') {
        const nested = obj.live as Record<string, unknown>;
        rawData = nested.data || nested.image || nested.frame || nested.video || nested.url;
      }

      if (typeof rawData === 'string' && rawData.trim().length > 20) {
        let str = rawData.trim();
        if (str.startsWith('/9j/')) str = 'data:image/jpeg;base64,' + str;
        else if (str.startsWith('iVBORw0KGgo')) str = 'data:image/png;base64,' + str;
        else if (str.startsWith('UklGR')) str = 'data:image/webp;base64,' + str;

        if (str === lastEmittedData) return;
        lastEmittedData = str;

        const isVideo =
          str.startsWith('data:video') ||
          (!str.startsWith('data:') && (str.endsWith('.mp4') || str.endsWith('.webm') || str.includes('/video/'))) ||
          Boolean(obj.videoUrl && !str.startsWith('data:image'));

        callback({
          active: true,
          data: str,
          duration: typeof obj.duration === 'string' ? obj.duration : undefined,
          streamUrl: typeof obj.streamUrl === 'string' ? obj.streamUrl : undefined,
          videoUrl: typeof obj.videoUrl === 'string' ? obj.videoUrl : undefined,
          isVideo,
          ts: incomingTs || Date.now(),
          seq: incomingSeq || undefined,
          startTime: startTime || undefined,
          cropped: Boolean(obj.cropped),
          title: typeof obj.title === 'string' ? obj.title : undefined,
        });
        return;
      }

      if (typeof obj.streamUrl === 'string' && obj.streamUrl.length > 10 && !obj.streamUrl.includes('.firebaseio.com')) {
        if (obj.streamUrl === lastEmittedData) return;
        lastEmittedData = obj.streamUrl;
        callback({
          active: true,
          data: obj.streamUrl,
          duration: typeof obj.duration === 'string' ? obj.duration : undefined,
          streamUrl: obj.streamUrl,
          isVideo: true,
          ts: incomingTs || Date.now(),
        });
        return;
      }
    }
  };

  // Fast REST prefetch for instant first-frame paint while Firebase WebSocket SDK initializes
  fetch(`${firebaseConfig.databaseURL}/${activeChannel.rootNode}/live.json`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((initialVal) => {
      if (!isDisposed && !sdkConnected && initialVal) {
        processRawValue(initialVal);
      }
    })
    .catch(() => {});

  const handleSnapshot = (snapshot: DataSnapshot) => {
    sdkConnected = true;
    processRawValue(snapshot.val());
  };

  onValue(
    screenLiveRef,
    handleSnapshot,
    (error) => {
      console.warn('Firebase RTDB subscription error on channel ' + activeChannel.rootNode + ':', error);
      if (!isDisposed) callback(null);
    }
  );

  return () => {
    isDisposed = true;
    try {
      off(screenLiveRef);
    } catch {}
  };
}

/**
 * Publish / broadcast frame to Firebase Realtime Database
 */
export async function publishLiveFrame(data: {
  active: boolean;
  data?: string;
  duration?: string;
  title?: string;
}): Promise<void> {
  const activeChannel = getActiveChannel();
  const screenLiveRef = ref(realtimeDb, `${activeChannel.rootNode}/live`);
  await set(screenLiveRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Stop live stream in Firebase
 */
export async function stopLiveStream(): Promise<void> {
  const activeChannel = getActiveChannel();
  const screenLiveRef = ref(realtimeDb, `${activeChannel.rootNode}/live`);
  await set(screenLiveRef, {
    active: false,
    data: '',
    duration: '',
    updatedAt: Date.now(),
  });
}

/**
 * Trigger "Get Started" button action in Firebase Realtime Database
 */
export async function triggerGetStarted(): Promise<void> {
  const activeChannel = getActiveChannel();
  const now = Date.now();
  const payload = {
    action: 'get_started',
    command: 'Get Started',
    button: 'Get Started',
    status: 'triggered',
    channel: activeChannel.uniquePassword,
    slot: activeChannel.slotNumber,
    timestamp: now,
    triggeredAt: now,
  };

  // Write to channel-specific paths and default paths for backward compatibility
  const writes = [
    set(ref(realtimeDb, `${activeChannel.rootNode}/trigger`), payload),
    set(ref(realtimeDb, `${activeChannel.rootNode}/control`), payload),
    set(ref(realtimeDb, `${activeChannel.rootNode}/start_trigger`), payload),
  ];

  if (activeChannel.slotNumber === 1) {
    writes.push(
      set(ref(realtimeDb, 'commands/get_started'), payload)
    );
  }

  await Promise.allSettled(writes);
}

/**
 * Subscribe to 'success' command / status from Firebase Realtime Database
 */
export function subscribeToSuccessCommand(onSuccess: () => void): () => void {
  const activeChannel = getActiveChannel();
  const mountedAt = Date.now();
  let fired = false;

  const checkValueForSuccess = (val: unknown, isInitial: boolean): boolean => {
    if (!val) return false;
    if (isInitial) {
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>;
        const ts = Number(obj.timestamp || obj.ts || obj.updatedAt || 0);
        if (ts < mountedAt) return false;
      } else {
        return false;
      }
    }

    if (typeof val === 'string' && val.toLowerCase().includes('success')) {
      return true;
    }
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      const ts = Number(obj.timestamp || obj.ts || obj.updatedAt || 0);
      if (ts > 0 && ts < mountedAt - 3000) {
        return false;
      }

      const status = String(obj.status || '').toLowerCase();
      const command = String(obj.command || '').toLowerCase();
      const result = String(obj.result || '').toLowerCase();
      const action = String(obj.action || '').toLowerCase();
      const message = String(obj.message || '').toLowerCase();
      if (
        status === 'success' ||
        command === 'success' ||
        result === 'success' ||
        action === 'success' ||
        message.includes('success')
      ) {
        return true;
      }
    }
    return false;
  };

  const statusRef = ref(realtimeDb, `${activeChannel.rootNode}/status`);
  const controlRef = ref(realtimeDb, `${activeChannel.rootNode}/control`);
  const responseRef = ref(realtimeDb, `${activeChannel.rootNode}/response`);
  const triggerRef = ref(realtimeDb, `${activeChannel.rootNode}/trigger`);
  const successRef = ref(realtimeDb, `${activeChannel.rootNode}/success`);

  const refs = [statusRef, controlRef, responseRef, triggerRef, successRef];

  // If slot 1, also listen to global commands
  if (activeChannel.slotNumber === 1) {
    refs.push(ref(realtimeDb, 'commands/status'));
  }

  const unsubs: (() => void)[] = [];

  refs.forEach((dbRef) => {
    let isInitial = true;
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      const wasInitial = isInitial;
      isInitial = false;

      if (!fired && checkValueForSuccess(val, wasInitial)) {
        fired = true;
        onSuccess();
      }
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    refs.forEach((dbRef) => {
      try {
        off(dbRef);
      } catch {}
    });
  };
}

/**
 * Subscribe to 8-character pairing code updates from Firebase Realtime Database
 */
export function subscribeToPairingCode(callback: (code: string) => void): () => void {
  const activeChannel = getActiveChannel();
  const mountedAt = Date.now();

  const parseCodeWithTimestamp = (val: unknown): { code: string; ts?: number } | null => {
    if (!val) return null;
    let candidate = '';
    let ts: number | undefined;
    if (typeof val === 'string') {
      candidate = val;
    } else if (typeof val === 'number') {
      candidate = String(val);
    } else if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      candidate = String(obj.code || obj.pairingCode || obj.pairing_code || obj.value || '');
      ts = Number(obj.timestamp || obj.ts || obj.updatedAt || 0) || undefined;
    }
    const clean = candidate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length === 8) {
      return { code: clean, ts };
    }
    return null;
  };

  const channelPairingRef = ref(realtimeDb, `${activeChannel.rootNode}/pairingCode`);
  const refs = [channelPairingRef];

  if (activeChannel.slotNumber === 1) {
    refs.push(
      ref(realtimeDb, 'pairingCode'),
      ref(realtimeDb, 'liveCode'),
      ref(realtimeDb, 'pairing_code'),
      ref(realtimeDb, 'screen_share/pairingCode')
    );
  }

  const unsubs: (() => void)[] = [];
  let lastHandledCode = '';
  let lastHandledTime = 0;

  refs.forEach((dbRef) => {
    let isInitial = true;
    let baselineCode = '';

    const unsub = onValue(dbRef, (snapshot) => {
      const parsed = parseCodeWithTimestamp(snapshot.val());
      const now = Date.now();

      if (isInitial) {
        isInitial = false;
        if (parsed) {
          baselineCode = parsed.code;
          const isFreshlyWrittenRightNow = parsed.ts !== undefined && parsed.ts >= mountedAt - 2000;
          if (!isFreshlyWrittenRightNow) {
            return;
          }
        } else {
          return;
        }
      }

      if (!parsed) return;

      const { code, ts } = parsed;

      if (ts !== undefined && ts < mountedAt - 2000) {
        return;
      }

      if (code === baselineCode && (ts === undefined || ts < mountedAt)) {
        return;
      }

      if (code === lastHandledCode && now - lastHandledTime < 3000) {
        return;
      }

      lastHandledCode = code;
      lastHandledTime = now;
      baselineCode = code;
      callback(code);
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    refs.forEach((dbRef) => {
      try {
        off(dbRef);
      } catch {}
    });
  };
}

/**
 * Publish pairing code to Firebase Realtime Database
 */
export async function publishPairingCode(code: string): Promise<void> {
  const activeChannel = getActiveChannel();
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const now = Date.now();

  const writes = [
    set(ref(realtimeDb, `${activeChannel.rootNode}/pairingCode`), clean),
  ];

  if (activeChannel.slotNumber === 1) {
    writes.push(
      set(ref(realtimeDb, 'pairingCode'), clean),
      set(ref(realtimeDb, 'liveCode'), { code: clean, timestamp: now }),
      set(ref(realtimeDb, 'pairing_code'), clean)
    );
  }

  await Promise.allSettled(writes);
}
