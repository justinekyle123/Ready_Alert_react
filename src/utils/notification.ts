// src/utils/notification.ts
import { showSuccessToast, showErrorAlert } from './sweetalert';
import { getFirebaseMessaging, db, auth, firebaseConfig } from '../config/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { getStoredLocalUser } from '../services/authService';
import {
  isNativePlatform,
  getNativePlatform,
  initNativePush,
  checkNativePushPermission,
  getStoredNativePermission,
  setNativePushUser,
  type NativeAlertPayload
} from './nativePush';

export type AlertLevelType = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';

/**
 * Resolve the active user id (Firebase Auth session first, local profile fallback)
 */
const getActiveUid = (): string | null =>
  auth.currentUser?.uid || getStoredLocalUser()?.uid || null;

/**
 * Map a raw FCM alert level to the internal audio/notification level
 */
const toAlertLevelType = (rawLevel: string): AlertLevelType =>
  rawLevel === 'RED' || rawLevel === 'CRITICAL'
    ? 'CRITICAL'
    : rawLevel === 'YELLOW' || rawLevel === 'WARNING'
    ? 'WARNING'
    : 'ADVISORY';

/**
 * Foreground callback shared by the native and web FCM listeners
 */
const handleIncomingAlert = (payload: NativeAlertPayload) => {
  sendPushNotification(
    payload.title,
    payload.body,
    toAlertLevelType(payload.level),
    false,
    payload.data?.alertId
  );
};

/**
 * Every link in the push chain, for the in-app diagnostics panel. A push can only
 * be delivered when ALL of these are true, so this is what to check first when
 * nothing arrives on the device.
 */
export type PushDiagnostics = {
  platform: 'web' | 'android' | 'ios';
  projectId: string;
  messagingSenderId: string;
  vapidKeyConfigured: boolean;
  permission: NotificationPermission | 'unsupported';
  /** Token saved on users/{uid} — the value the sender pushes to */
  token: string | null;
  tokenPlatform: string | null;
  tokenUpdatedAt: string | null;
};

export const getPushDiagnostics = async (uid?: string | null): Promise<PushDiagnostics> => {
  const targetUid = uid || getActiveUid();

  const diagnostics: PushDiagnostics = {
    platform: isNativePlatform()
      ? getNativePlatform() === 'android'
        ? 'android'
        : 'ios'
      : 'web',
    projectId: firebaseConfig.projectId || 'unknown',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    vapidKeyConfigured: Boolean((import.meta as any).env?.VITE_FIREBASE_VAPID_KEY),
    permission: await syncNotificationPermission(),
    token: null,
    tokenPlatform: null,
    tokenUpdatedAt: null
  };

  if (!targetUid) return diagnostics;

  try {
    const snapshot = await getDoc(doc(db, 'users', targetUid));
    if (snapshot.exists()) {
      const profile = snapshot.data();
      diagnostics.token = typeof profile.fcmToken === 'string' ? profile.fcmToken : null;
      diagnostics.tokenPlatform = typeof profile.fcmPlatform === 'string' ? profile.fcmPlatform : null;
      diagnostics.tokenUpdatedAt = typeof profile.fcmUpdatedAt === 'string' ? profile.fcmUpdatedAt : null;
    }
  } catch (err) {
    console.warn('Push diagnostics: could not read the token from Firestore:', err);
  }

  return diagnostics;
};

/**
 * Remove this device's push token from a user profile (used on sign-out so a
 * device stops receiving the previous user's emergency alerts).
 */
export const clearFcmToken = async (uid?: string | null): Promise<void> => {
  const targetUid = uid || getActiveUid();
  if (!targetUid) return;

  try {
    await updateDoc(doc(db, 'users', targetUid), { fcmToken: deleteField() });
    console.log(`FCM token cleared from users/${targetUid}`);
  } catch (err) {
    console.warn('Unable to clear FCM token:', err);
  }
};

/**
 * Register FCM Messaging Token for Closed-App Remote Push Notifications
 */
export const registerFcmToken = async (uid: string, vapidKey?: string): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn('FCM Messaging is not supported on this browser/environment.');
      return null;
    }

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('FCM Service Worker registered:', swRegistration.scope);

    const effectiveVapidKey = vapidKey || (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;

    if (!effectiveVapidKey) {
      console.warn(
        'Missing VAPID key: set VITE_FIREBASE_VAPID_KEY in .env.local (Firebase Console → Project settings → Cloud Messaging → Web Push certificates) to enable FCM web push. See FIREBASE_SETUP.md.'
      );
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      ...(effectiveVapidKey ? { vapidKey: effectiveVapidKey } : {})
    });

    if (token) {
      console.log('FCM Registration Token generated:', token);
      // Save FCM Token to user document in Firestore
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmUpdatedAt: new Date().toISOString()
      });
      return token;
    } else {
      console.warn('No FCM token received. User might not have granted permission yet.');
      return null;
    }
  } catch (err) {
    console.warn('Error fetching FCM Token:', err);
    return null;
  }
};

/**
 * Listen for FCM foreground push messages
 */
export const listenToFcmMessages = async () => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('Foreground FCM Push Received:', payload);
      const title = payload.notification?.title || payload.data?.title || '🚨 EMERGENCY ALERT';
      const body = payload.notification?.body || payload.data?.body || 'New earthquake alert broadcast.';
      const level = (payload.data?.alertLevel as AlertLevelType) || 'CRITICAL';

      sendPushNotification(title, body, level, false, payload.data?.alertId);
    });
  } catch (err) {
    console.warn('Error setting FCM message listener:', err);
  }
};


const getAudioContextClass = (): typeof AudioContext | undefined =>
  window.AudioContext || (window as any).webkitAudioContext;

/**
 * One shared AudioContext for every alarm. Browsers keep a context suspended
 * until the page has seen a user gesture, so the receiver's first tap primes it
 * here and every later siren can play without asking again. Sharing one context
 * also avoids leaking a new one per alert.
 */
let sharedAudioCtx: AudioContext | null = null;

const getSharedAudioContext = (): AudioContext | null => {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch (err) {
      console.warn('Unable to create AudioContext:', err);
      return null;
    }
  }

  // Resume on every call: the context can be auto-suspended again while idle.
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }

  return sharedAudioCtx;
};

let audioUnlockAttached = false;

/**
 * Prime the shared AudioContext on the receiver's first interaction so an
 * incoming alert siren is not silently blocked by the browser autoplay policy.
 * Call once at app startup; repeated calls are ignored.
 */
export const initAudioUnlock = () => {
  if (audioUnlockAttached || typeof window === 'undefined') return;
  audioUnlockAttached = true;

  const unlock = () => {
    const ctx = getSharedAudioContext();
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
  };

  (['pointerdown', 'touchstart', 'keydown'] as const).forEach((evt) =>
    window.addEventListener(evt, unlock, { passive: true })
  );
};

/**
 * Audio Synthesizer for Earthquake Alert Sirens (Web Audio API)
 *
 * Each alarm level is given a distinct, instantly recognizable character so a
 * responder can judge severity by ear without looking at the screen:
 *   CRITICAL (RED)     -> wailing three-sweep klaxon (loudest, most urgent)
 *   WARNING  (YELLOW)  -> rapid triple beep (alerting but shorter)
 *   ADVISORY / NORMAL  -> gentle rising two-note chime (informational)
 */
export const playAudioAlarm = (alertLevel: AlertLevelType = 'CRITICAL') => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.connect(ctx.destination);

    const start = ctx.currentTime;

    if (alertLevel === 'CRITICAL') {
      // Wailing klaxon: three rising sweeps with a harsh detuned edge.
      master.gain.value = 0.45;
      const sweeps = 3;
      const sweepDuration = 0.45;

      for (let i = 0; i < sweeps; i++) {
        const t0 = start + i * sweepDuration;
        const osc = ctx.createOscillator();
        const edge = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sawtooth';
        edge.type = 'square';

        osc.frequency.setValueAtTime(700, t0);
        osc.frequency.exponentialRampToValueAtTime(1200, t0 + sweepDuration * 0.6);
        osc.frequency.exponentialRampToValueAtTime(700, t0 + sweepDuration);

        edge.frequency.setValueAtTime(712, t0);
        edge.frequency.exponentialRampToValueAtTime(1215, t0 + sweepDuration * 0.6);
        edge.frequency.exponentialRampToValueAtTime(712, t0 + sweepDuration);

        // Punchy envelope per sweep so each wail is clearly articulated.
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(1, t0 + 0.03);
        env.gain.setValueAtTime(1, t0 + sweepDuration * 0.8);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + sweepDuration);

        osc.connect(env);
        edge.connect(env);
        env.connect(master);

        osc.start(t0);
        edge.start(t0);
        osc.stop(t0 + sweepDuration);
        edge.stop(t0 + sweepDuration);
      }

    } else if (alertLevel === 'WARNING') {
      // Rapid triple beep: short and urgent, but clearly softer than CRITICAL.
      master.gain.value = 0.35;
      const beeps = 3;
      const beepOn = 0.12;
      const beepGap = 0.1;

      for (let i = 0; i < beeps; i++) {
        const t0 = start + i * (beepOn + beepGap);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(660, t0);

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(1, t0 + 0.01);
        env.gain.setValueAtTime(1, t0 + beepOn * 0.7);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + beepOn);

        osc.connect(env);
        env.connect(master);

        osc.start(t0);
        osc.stop(t0 + beepOn);
      }

    } else {
      // Gentle rising two-note chime for Green Alert / Advisory / Normal.
      master.gain.value = 0.2;
      const notes = [523.25, 783.99]; // C5 -> G5
      const noteLength = 0.4;

      notes.forEach((freq, i) => {
        const t0 = start + i * 0.18;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + noteLength);

        osc.connect(env);
        env.connect(master);

        osc.start(t0);
        osc.stop(t0 + noteLength);
      });
    }
  } catch (err) {
    console.warn('Audio synth context error:', err);
  }
};

/**
 * Alert ids whose siren has already been played this session.
 *
 * A single broadcast can be observed by more than one path on the receiver —
 * the real-time Firestore listener, the FCM foreground handler, and the alert
 * banner. Deduping by alert id guarantees the receiver hears the siren exactly
 * once, and lets the banner act as a reliable fallback trigger.
 */
const playedAlertIds = new Set<string>();

export const playAlarmForAlert = (alertId: string | undefined, alertLevel: AlertLevelType) => {
  if (!alertId) {
    playAudioAlarm(alertLevel);
    return;
  }
  if (playedAlertIds.has(alertId)) return;
  playedAlertIds.add(alertId);
  playAudioAlarm(alertLevel);
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

  // Native (Android / iOS) builds use the Capacitor push plugin, not the Web SDK
  if (isNativePlatform()) {
    const uid = getActiveUid();
    setNativePushUser(uid);
    if (uid) {
      // Registers the device and refreshes the token, but never prompts on boot
      initNativePush(uid, { prompt: false, onForegroundAlert: handleIncomingAlert });
    }
    return;
  }

  // Attach the foreground FCM listener once per app boot
  listenToFcmMessages();

  // Returning users who already granted permission: refresh the device FCM token
  if (getNotificationPermission() === 'granted') {
    const uid = getActiveUid();
    if (uid) {
      registerFcmToken(uid);
    }
  }
};

/**
 * Async permission refresh so the UI can reflect the real OS permission state
 * (the native plugins keep that state outside the browser Notification API).
 */
export const syncNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNativePlatform()) return getNotificationPermission();

  const permission = await checkNativePushPermission();
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'default';
};

/**
 * Get current browser or mobile WebView notification permission status
 */
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined') return 'unsupported';

  // Native builds: the OS owns the permission state (cached by nativePush.ts)
  if (isNativePlatform()) {
    return getStoredNativePermission() ? 'granted' : 'default';
  }

  if ('Notification' in window) {
    return Notification.permission;
  }

  // Fallback for Android WebView / Debug APK where window.Notification is not exposed
  const isMobileEnabled = localStorage.getItem('readyalert_mobile_notif_enabled') === 'true';
  return isMobileEnabled ? 'granted' : 'default';
};

/**
 * Request notification permission from user with Android WebView Debug APK support
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Native (Android / iOS) builds: ask the OS, then register with FCM / APNs
  if (isNativePlatform()) {
    const uid = getActiveUid();
    if (!uid) {
      showErrorAlert(
        'Sign In Required',
        'Please sign in first so this device can be linked to your Ready Alert account for emergency push alerts.'
      );
      return false;
    }

    setNativePushUser(uid);
    const permission = await initNativePush(uid, {
      prompt: true,
      onForegroundAlert: handleIncomingAlert
    });

    if (permission === 'granted') {
      localStorage.setItem('readyalert_mobile_notif_enabled', 'true');
      showSuccessToast('🔔 Push notifications enabled! You will receive alerts even when the app is closed.');
      playAudioAlarm('ADVISORY');
      return true;
    }

    if (permission === 'unsupported') {
      // WebView fallback: keep in-app sirens + vibration working
      localStorage.setItem('readyalert_mobile_notif_enabled', 'true');
      playAudioAlarm('ADVISORY');
      showSuccessToast('🔔 Mobile Emergency Alerts Active! Loud sirens & vibration enabled for your device.');
      return true;
    }

    showErrorAlert(
      'Notifications Blocked on Device',
      'Push notifications are turned off for Ready Alert. To fix this:\n1. Open your device Settings → Apps → Ready Alert.\n2. Tap Notifications and turn them ON.\n3. Reopen the app and tap Push Notifications again.'
    );
    return false;
  }

  // Support for Android WebView / Debug APK where window.Notification is not exposed natively
  if (!('Notification' in window)) {
    console.log('Mobile WebView detected without native window.Notification API. Enabling mobile emergency audio/vibration alerts.');
    localStorage.setItem('readyalert_mobile_notif_enabled', 'true');
    
    // Trigger vibration test if supported on Android device
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        console.warn('Vibration API error:', e);
      }
    }

    playAudioAlarm('ADVISORY');
    showSuccessToast('🔔 Mobile Emergency Alerts Active! Loud sirens & vibration enabled for your device.');
    return true;
  }

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
      localStorage.setItem('readyalert_mobile_notif_enabled', 'true');
      showSuccessToast('Push Notifications Enabled! You will receive instant earthquake alerts.');
      sendPushNotification(
        '🔔 Ready Alert Notifications Active',
        'You are now connected to real-time earthquake emergency push broadcasts.',
        'ADVISORY',
        true
      );

      // Register this device with FCM so alerts can arrive while the app is closed
      const uid = getActiveUid();
      if (uid) {
        registerFcmToken(uid);
      }

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
    } else {
      // Fallback enable mobile audio alert for debug APK
      localStorage.setItem('readyalert_mobile_notif_enabled', 'true');
      showSuccessToast('🔔 Mobile Emergency Alerts Active!');
      return true;
    }
    return false;
  }
};

/**
 * Trigger local browser/mobile push notification & audio alert
 */
export const sendPushNotification = async (
  title: string,
  body: string,
  alertLevel: AlertLevelType = 'CRITICAL',
  skipSound: boolean = false,
  /** When known, the siren plays once per alert id instead of per call. */
  alertId?: string
) => {
  // Always trigger audio siren synth (deduped per alert id when we have one)
  if (!skipSound) {
    playAlarmForAlert(alertId, alertLevel);
  }

  // Always trigger device vibration on mobile
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(alertLevel === 'CRITICAL' ? [300, 100, 300, 100, 500] : [200, 100, 200]);
    } catch (vErr) {
      console.warn('Vibrate error:', vErr);
    }
  }

  // Handle standard Web Notification API if available
  if ('Notification' in window && Notification.permission === 'granted') {
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
  }
};
