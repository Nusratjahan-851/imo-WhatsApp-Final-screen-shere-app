import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, off } from 'firebase/database';

export const RTDB_URL = 'https://my-sc-tools-default-rtdb.firebaseio.com';

const firebaseConfig = {
  databaseURL: RTDB_URL,
  projectId: 'my-sc-tools-default-rtdb',
};

export function getRtdb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getDatabase(app);
}

export interface ScreenSharePayload {
  active: boolean;
  streamData: string | null;
  timestamp?: number | string;
  seq?: number;
  cropped?: boolean;
  source?: string;
  raw?: any;
}

function resolveImoRootNode(): string {
  if (typeof window === 'undefined') return 'imo_screen_share';
  try {
    const params = new URLSearchParams(window.location.search);
    const slotStr = params.get('slot') || params.get('ch') || '';
    const slotNum = parseInt(slotStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(slotNum) && slotNum >= 2 && slotNum <= 20) {
      return `imo_screen_share_${String(slotNum).padStart(2, '0')}`;
    }
  } catch {}
  return 'imo_screen_share';
}

/**
 * Subscribes in real-time to imo_screen_share/live (and fallback screen_share/live for slot 1)
 * with instant REST first-frame prefetch, strict monotonic seq/ts ordering, and zero duplicate
 * SSE + WebSocket collisions so shared screens never lag or jump backward.
 */
export function subscribeToLiveScreenShare(
  onUpdate: (payload: ScreenSharePayload) => void
): () => void {
  let isCleanedUp = false;
  let sseSource: EventSource | null = null;
  let rtdbConnected = false;
  let currentStartTime = 0;
  let lastAcceptedTs = 0;
  let lastAcceptedSeq = 0;
  let lastEmittedData = '';

  const imoRoot = resolveImoRootNode();
  const db = getRtdb();
  const imoLiveRef = ref(db, `${imoRoot}/live`);
  const legacyLiveRef = imoRoot === 'imo_screen_share' ? ref(db, 'screen_share/live') : null;

  let imoHasActiveStream = false;

  const closeSseFallback = () => {
    if (sseSource) {
      try {
        sseSource.close();
      } catch {}
      sseSource = null;
    }
  };

  const resetOrdering = () => {
    lastAcceptedTs = 0;
    lastAcceptedSeq = 0;
    lastEmittedData = '';
  };

  const processData = (val: any, fromLegacyFallback = false) => {
    if (isCleanedUp) return;
    if (fromLegacyFallback && imoHasActiveStream) return;

    if (!val) {
      if (!fromLegacyFallback) {
        imoHasActiveStream = false;
      }
      if (!imoHasActiveStream) {
        resetOrdering();
        onUpdate({ active: false, streamData: null, raw: val });
      }
      return;
    }

    let streamData: string | null = null;
    let isActive = true;
    let incomingTs = 0;
    let incomingSeq = 0;
    let startTime = 0;
    let cropped = false;

    if (typeof val === 'string') {
      streamData = val.trim();
    } else if (typeof val === 'object') {
      if (val.active === false || val.status === 'stopped' || val.status === 'idle') {
        isActive = false;
      }
      streamData = val.data || val.image || val.video || val.frame || val.src || null;
      incomingTs = Number(val.ts || val.timestamp || val.time || val.updatedAt || 0);
      incomingSeq = Number(val.seq || 0);
      startTime = Number(val.startTime || 0);
      cropped = Boolean(val.cropped);
    }

    if (!isActive || !streamData || streamData.length === 0) {
      if (!fromLegacyFallback) {
        imoHasActiveStream = false;
      }
      if (!imoHasActiveStream) {
        resetOrdering();
        onUpdate({ active: false, streamData: null, timestamp: incomingTs, raw: val });
      }
      return;
    }

    if (!fromLegacyFallback) {
      imoHasActiveStream = true;
    }

    if (startTime > 0 && startTime !== currentStartTime) {
      currentStartTime = startTime;
      resetOrdering();
    }

    // Strict monotonic ordering: reject out-of-order older packets
    if (incomingSeq > 0 && lastAcceptedSeq > 0 && incomingSeq < lastAcceptedSeq) {
      return;
    }
    if (incomingTs > 0 && lastAcceptedTs > 0 && incomingTs < lastAcceptedTs) {
      return;
    }
    if (incomingTs > lastAcceptedTs) lastAcceptedTs = incomingTs;
    if (incomingSeq > lastAcceptedSeq) lastAcceptedSeq = incomingSeq;

    if (streamData === lastEmittedData) return;
    lastEmittedData = streamData;

    onUpdate({
      active: true,
      streamData,
      timestamp: incomingTs || Date.now(),
      seq: incomingSeq || undefined,
      cropped,
      source: 'firebase_rtdb',
      raw: val,
    });
  };

  // 1. Instant REST prefetch so first live frame paints in ~100ms before WebSocket handshake finishes
  fetch(`${RTDB_URL}/${imoRoot}/live.json`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((initialVal) => {
      if (!isCleanedUp && !rtdbConnected && initialVal) {
        processData(initialVal, false);
      }
    })
    .catch(() => {});

  // 2. Primary Firebase SDK WebSocket listener (closes SSE fallback immediately upon connection)
  try {
    onValue(
      imoLiveRef,
      (snapshot) => {
        if (isCleanedUp) return;
        rtdbConnected = true;
        closeSseFallback();
        processData(snapshot.val(), false);
      },
      (error) => {
        console.warn('[Firebase RTDB] onValue error, activating SSE fallback:', error);
        initSseFallback();
      }
    );

    if (legacyLiveRef) {
      onValue(legacyLiveRef, (snapshot) => {
        if (isCleanedUp) return;
        const val = snapshot.val();
        if (val) processData(val, true);
      });
    }
  } catch (err) {
    console.warn('[Firebase RTDB] Error initializing onValue listener:', err);
    initSseFallback();
  }

  function initSseFallback() {
    if (isCleanedUp || sseSource || rtdbConnected) return;
    try {
      sseSource = new EventSource(`${RTDB_URL}/${imoRoot}/live.json`);
      sseSource.addEventListener('put', (event) => {
        if (isCleanedUp || rtdbConnected) return;
        try {
          const parsed = JSON.parse(event.data);
          const val = parsed?.data !== undefined ? parsed.data : parsed;
          processData(val, false);
        } catch {}
      });
      sseSource.addEventListener('patch', (event) => {
        if (isCleanedUp || rtdbConnected) return;
        try {
          const parsed = JSON.parse(event.data);
          const val = parsed?.data !== undefined ? parsed.data : parsed;
          processData(val, false);
        } catch {}
      });
    } catch {}
  }

  const fallbackTimer = setTimeout(() => {
    if (!rtdbConnected && !isCleanedUp) {
      initSseFallback();
    }
  }, 3500);

  return () => {
    isCleanedUp = true;
    clearTimeout(fallbackTimer);
    try {
      off(imoLiveRef);
      if (legacyLiveRef) off(legacyLiveRef);
    } catch {}
    closeSseFallback();
  };
}
