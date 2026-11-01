/**
 * Accessibility helper for screen readers
 */

let speechEnabled = true;

export function setSpeechEnabled(enabled: boolean) {
  speechEnabled = enabled;
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    localStorage.setItem('accessibility_voice_enabled', enabled ? 'true' : 'false');
  }
}

export function isSpeechEnabled(): boolean {
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    const saved = localStorage.getItem('accessibility_voice_enabled');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return true; // default enabled for accessibility
}

export function speakMessage(text: string, lang: 'bn' | 'en' = 'bn') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!speechEnabled) return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick Bengali voice if available and requested, otherwise system default
    const voices = window.speechSynthesis.getVoices();
    if (lang === 'bn') {
      const bnVoice = voices.find(v => v.lang.startsWith('bn'));
      if (bnVoice) {
        utterance.voice = bnVoice;
      }
      utterance.lang = 'bn-BD';
    } else {
      utterance.lang = 'en-US';
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[Speech] Could not speak message:', err);
  }
}

/**
 * Announce message to screen readers via hidden aria-live region
 */
export function announceToScreenReader(message: string) {
  if (typeof document === 'undefined') return;

  let liveRegion = document.getElementById('a11y-screen-reader-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-screen-reader-announcer';
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.padding = '0';
    liveRegion.style.margin = '-1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0, 0, 0, 0)';
    liveRegion.style.whiteSpace = 'nowrap';
    liveRegion.style.border = '0';
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = '';
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 50);
}
