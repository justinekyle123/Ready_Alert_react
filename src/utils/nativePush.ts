// src/utils/nativePush.ts
// Native (Android / iOS) push notifications for the Capacitor builds, powered by
// @capacitor/push-notifications. The browser path lives in ./notification.ts.
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed
} from '@capacitor/push-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Android notification channel used for closed-app emergency broadcasts.
 * Must stay in sync with `default_notification_channel_id` in
 * android/app/src/main/res/values/strings.xml.
 */
export const EMERGENCY_CHANNEL_ID = 'readyalert_emergency';

const NATIVE_PERMISSION_KEY = 'readyalert_native_push_granted';

export type NativePushPermission = 'granted' | 'denied' | 'needs-prompt' | 'unsupported';

export type NativeAlertPayload = {
  title: string;
  body: string;
  /** Raw alert level from the FCM data payload (RED / YELLOW / GREEN / CRITICAL / ...) */
  level: string;
  data: Record<string, string>;
};

export type NativePushOptions = {
  /** Ask the OS for permission when it has not been requested yet */
  prompt?: boolean;
  /** Called for every push received while the app is in the foreground */
  onForegroundAlert?: (payload: NativeAlertPayload) => void;
};

const LEVEL_TITLES: Record<string, string> = {
  RED: '🚨 RED ALERT - EARTHQUAKE EMERGENCY',
  CRITICAL: '🚨 RED ALERT - EARTHQUAKE EMERGENCY',
  YELLOW: '⚠️ YELLOW ALERT - EARTHQUAKE WARNING',
  WARNING: '⚠️ YELLOW ALERT - EARTHQUAKE WARNING',
  GREEN: '🟢 GREEN ALERT - SAFETY ADVISORY',
  ADVISORY: '🟢 GREEN ALERT - SAFETY ADVISORY'
};

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const getNativePlatform = (): string => Capacitor.getPlatform();

/**
 * Whether the Android build had `android/app/google-services.json` at build time.
 *
 * Without that file `android/app/build.gradle` does not apply the Google Services
 * plugin, so no FirebaseApp is initialized. `PushNotifications.register()` then calls
 * `FirebaseMessaging.getInstance()` as its first statement on the main thread, which
 * throws and takes the whole process down — the user just sees the app close.
 *
 * Defaults to `true` when the constant was not injected, so only an explicit `false`
 * disables the native path.
 */
const ANDROID_FIREBASE_CONFIGURED: boolean =
  typeof __ANDROID_FIREBASE_CONFIGURED__ === 'undefined'
    ? true
    : __ANDROID_FIREBASE_CONFIGURED__ !== false;

/**
 * False only for Android builds without a native Firebase config, where any call that
 * touches FirebaseMessaging would crash the process. iOS is unaffected: the Capacitor
 * plugin uses APNs there, not Firebase.
 */
export const isNativePushUsable = (): boolean =>
  !(getNativePlatform() === 'android' && !ANDROID_FIREBASE_CONFIGURED);

let warnedMissingAndroidConfig = false;

/**
 * Logged once per session. On a physical phone there is no console, so the same reason
 * is also surfaced in the Push Diagnostics panel (see PushDiagnostics.tsx).
 */
const warnMissingAndroidConfig = () => {
  if (warnedMissingAndroidConfig) return;
  warnedMissingAndroidConfig = true;
  console.error(
    'Native push disabled: android/app/google-services.json was missing when this app was built, ' +
      'so the Google Services plugin did not run and FirebaseApp is not initialized. Calling ' +
      'PushNotifications.register() in that state kills the app, so native push is skipped. ' +
      'Fix: Firebase Console → Project settings → Your apps → Android app (package name ' +
      'com.example.app) → download google-services.json → save to android/app/ → rebuild. ' +
      'See FIREBASE_SETUP.md.'
  );
};

/** Sync read of the cached native permission state (for UI rendering) */
export const getStoredNativePermission = (): boolean => {
  try {
    return localStorage.getItem(NATIVE_PERMISSION_KEY) === 'true';
  } catch {
    return false;
  }
};

const setStoredNativePermission = (granted: boolean) => {
  try {
    localStorage.setItem(NATIVE_PERMISSION_KEY, granted ? 'true' : 'false');
  } catch {
    // localStorage unavailable — permission state simply won't be cached
  }
};

/**
 * Ask the OS (not the browser) for the current notification permission.
 * Also refreshes the cached flag used by the sync getter.
 */
export const checkNativePushPermission = async (): Promise<NativePushPermission> => {
  if (!isNativePlatform()) return 'unsupported';

  if (!isNativePushUsable()) {
    warnMissingAndroidConfig();
    setStoredNativePermission(false);
    return 'unsupported';
  }

  try {
    const status = await PushNotifications.checkPermissions();
    if (status.receive === 'granted') {
      setStoredNativePermission(true);
      return 'granted';
    }
    setStoredNativePermission(false);
    return status.receive === 'denied' ? 'denied' : 'needs-prompt';
  } catch (err) {
    console.warn('Native push: permission check failed:', err);
    return 'unsupported';
  }
};

const toDataRecord = (data: unknown): Record<string, string> => {
  if (!data || typeof data !== 'object') return {};
  return Object.entries(data as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
      return acc;
    },
    {}
  );
};

// Listeners are attached once per app session; the active uid is kept in a
// module variable so the `registration` event always writes to the current user.
let listenersAttached = false;
let currentUid: string | null = null;
let foregroundHandler: ((payload: NativeAlertPayload) => void) | null = null;

const saveTokenToProfile = async (token: string) => {
  if (!currentUid) {
    console.warn('Native push: token received but no signed-in user to attach it to.');
    return;
  }
  await updateDoc(doc(db, 'users', currentUid), {
    fcmToken: token,
    fcmPlatform: getNativePlatform(),
    fcmUpdatedAt: new Date().toISOString()
  });
  console.log(`Native push: ${getNativePlatform()} token saved to users/${currentUid}`);
};

const ensureAndroidChannel = async () => {
  if (getNativePlatform() !== 'android') return;
  try {
    await PushNotifications.createChannel({
      id: EMERGENCY_CHANNEL_ID,
      name: 'Emergency Alerts',
      description: 'Earthquake tri-alarm broadcasts (RED / YELLOW / GREEN).',
      importance: 5, // IMPORTANCE_HIGH — heads-up notification
      visibility: 1, // VISIBILITY_PUBLIC — visible on the lockscreen
      vibration: true,
      lights: true,
      lightColor: '#dc2626'
    });
  } catch (err) {
    console.warn('Native push: Android channel creation failed:', err);
  }
};

const attachListeners = async () => {
  if (listenersAttached) return;
  listenersAttached = true;

  await PushNotifications.addListener('registration', async (token: Token) => {
    console.log('Native push registration token:', token.value);
    try {
      await saveTokenToProfile(token.value);
    } catch (err) {
      console.warn('Native push: failed to save token to Firestore:', err);
    }
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.warn('Native push registration error:', error.error);
  });

  await PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      const data = toDataRecord(notification.data);
      const level = data.alertLevel || data.level || 'CRITICAL';

      foregroundHandler?.({
        title: notification.title || LEVEL_TITLES[level] || '🚨 READY ALERT EMERGENCY',
        body: notification.body || data.body || 'New earthquake alert issued.',
        level,
        data
      });
    }
  );

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      // The app opens on the role dashboard; the active alert banner is driven by
      // the real-time Firestore listener, so no extra navigation is required here.
      console.log('Native push tapped:', action.actionId, toDataRecord(action.notification?.data));
    }
  );
};

/**
 * Register this device for native push notifications and store its token on the
 * signed-in user's profile so FCM can reach it while the app is closed.
 */
export const initNativePush = async (
  uid: string,
  options: NativePushOptions = {}
): Promise<NativePushPermission> => {
  if (!isNativePlatform()) return 'unsupported';

  // Must run before attachListeners()/register(): `register` is the call that throws.
  if (!isNativePushUsable()) {
    warnMissingAndroidConfig();
    return 'unsupported';
  }

  currentUid = uid;
  if (options.onForegroundAlert) {
    foregroundHandler = options.onForegroundAlert;
  }

  await attachListeners();
  await ensureAndroidChannel();

  let permission = await checkNativePushPermission();

  if (permission === 'needs-prompt') {
    if (!options.prompt) return permission;
    try {
      const requested = await PushNotifications.requestPermissions();
      permission = requested.receive === 'granted' ? 'granted' : 'denied';
      setStoredNativePermission(permission === 'granted');
    } catch (err) {
      console.warn('Native push: permission request failed:', err);
      return 'denied';
    }
  }

  if (permission !== 'granted') return permission;

  try {
    // Triggers the 'registration' event with the FCM (Android) / APNs (iOS) token
    await PushNotifications.register();
  } catch (err) {
    console.warn('Native push: registration failed:', err);
    return 'denied';
  }

  return 'granted';
};

/**
 * Keep the module's user reference fresh across login / logout.
 */
export const setNativePushUser = (uid: string | null) => {
  currentUid = uid;
};
