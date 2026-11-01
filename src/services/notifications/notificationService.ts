import { AppSettings } from '../../database/schema';

export interface DriverPaymentAlert {
  id: string;
  transactionRecordId: string;
  transactionId: string | null;
  amountFormatted: string;
  amountMinorUnits: number;
  senderName: string;
  senderPhone: string | null;
  timeFormatted: string;
  activeTripId: string | null;
  activeTripLabel: string | null;
  createdAt: string;
}

/**
 * Plays a subtle, clear two-tone notification chime using the offline Web Audio API.
 * Does not require internet access or external audio files.
 */
export function playOfflineNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Second tone (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    gain2.gain.setValueAtTime(0.18, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.42);
  } catch {
    // Ignore audio context restrictions if user hasn't interacted yet
  }
}

/**
 * Triggers offline device vibration when supported by Android / browser runtime.
 */
export function triggerDeviceVibration(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 80, 220]);
    }
  } catch {
    // Vibration not supported on this device
  }
}

/**
 * Speaks the incoming payment aloud using offline Text-to-Speech (SpeechSynthesis):
 * e.g., "Payment received, 50 birr from Natnael Birhanu."
 */
export function speakPaymentAnnouncement(amountMinorUnits: number, senderName: string | null): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const birrWhole = Math.floor(amountMinorUnits / 100);
    const cents = amountMinorUnits % 100;
    const amountSpeech =
      cents > 0 ? `${birrWhole} birr and ${cents} cents` : `${birrWhole} birr`;
    const fromSpeech = senderName ? ` from ${senderName}` : '';

    const utterance = new SpeechSynthesisUtterance(
      `Payment received, ${amountSpeech}${fromSpeech}.`
    );
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // SpeechSynthesis unavailable
  }
}

/**
 * Dispatches payment feedback according to the driver's notification settings.
 */
export function dispatchPaymentEffects(
  amountMinorUnits: number,
  senderName: string | null,
  settings: AppSettings
): void {
  if (settings.silent_mode) {
    return;
  }

  if (settings.notification_sound) {
    playOfflineNotificationChime();
  }

  if (settings.notification_vibration) {
    triggerDeviceVibration();
  }

  if (settings.voice_announcement) {
    speakPaymentAnnouncement(amountMinorUnits, senderName);
  }
}
