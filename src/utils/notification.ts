// src/utils/notification.ts
import { showSuccessToast, showErrorAlert } from './sweetalert';

export type AlertLevelType = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';

/**
 * Audio Synthesizer for Earthquake Alert Sirens (Web Audio API)
 */
export const playAudioAlarm = (alertLevel: AlertLevelType = 'CRITICAL') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (alertLevel === 'CRITICAL') {
      // Loud Dual Siren Beep for Red Alert
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);

      osc2.frequency.setValueAtTime(950, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    } else if (alertLevel === 'WARNING') {
      // Double Beep for Yellow Alert
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      // Soft Chime for Green Alert / Advisory
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (err) {
    console.warn('Audio synth context error:', err);
  }
};

/**
 * Register Service Worker for Push Notifications
 */
export const initNotificationService = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Ready Alert SW registered with scope:', registration.scope);
    } catch (error) {
      console.warn('SW registration failed:', error);
    }
  }
};

/**
 * Get current browser notification permission status
 */
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    showErrorAlert('Unsupported Feature', 'This browser does not support desktop/mobile push notifications.');
    return false;
  }

  const isIframe = window.self !== window.top;

  try {
    let permission = Notification.permission;

    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (reqErr) {
        console.warn('Notification.requestPermission failed (likely iframe restriction):', reqErr);
      }
    }

    if (permission === 'granted') {
      showSuccessToast('Push Notifications Enabled! You will receive instant earthquake alerts.');
      sendPushNotification(
        '🔔 Ready Alert Notifications Active',
        'You are now connected to real-time earthquake emergency push broadcasts.',
        'ADVISORY',
        true
      );
      return true;
    } else {
      if (isIframe) {
        showErrorAlert(
          'Preview iFrame Restriction',
          'Web browsers block Notification permission popups inside preview frames. Please click the "Open in New Tab" ↗️ icon at the top right of the screen to open Ready Alert in a standalone window, then enable Notifications.'
        );
      } else {
        showErrorAlert(
          'Notifications Blocked in Browser',
          'Push notifications are currently blocked in your browser site settings. To fix this:\n1. Click the lock/tune icon 🔒 next to the website URL.\n2. Set Notifications to "Allow".\n3. Reload the page.'
        );
      }
      return false;
    }
  } catch (err) {
    console.error('Permission request error:', err);
    if (isIframe) {
      showErrorAlert(
        'Preview iFrame Restriction',
        'Web browsers restrict notification permissions inside embedded frames. Please open the app in a NEW TAB ↗️ to grant push permissions.'
      );
    }
    return false;
  }
};

/**
 * Trigger local browser push notification & audio alert
 */
export const sendPushNotification = async (
  title: string,
  body: string,
  alertLevel: AlertLevelType = 'CRITICAL',
  skipSound: boolean = false
) => {
  if (!skipSound) {
    playAudioAlarm(alertLevel);
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options: any = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `readyalert-${Date.now()}`,
    requireInteraction: alertLevel === 'CRITICAL' || alertLevel === 'WARNING',
    vibrate: alertLevel === 'CRITICAL' ? [300, 100, 300, 100, 500] : [200, 100, 200],
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (err) {
    console.warn('Fallback Notification constructor:', err);
    try {
      new Notification(title, options);
    } catch (e) {
      console.error('Push notification trigger error:', e);
    }
  }
};
