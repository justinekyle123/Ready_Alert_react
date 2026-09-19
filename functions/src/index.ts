/**
 * Ready Alert — FCM sender
 *
 * Triggered whenever a document is created in the `alerts` collection and pushes
 * the alert to every device that registered a token in `users/{uid}.fcmToken`.
 *
 * One multicast call covers all three transports at once — FCM routes each token
 * to the right platform using the same `notification` payload:
 *   - Android  → `android` (high priority + the "Emergency Alerts" channel)
 *   - iOS      → `apns`    (APNs token registered by @capacitor/push-notifications)
 *   - Web      → `webpush` (FCM token registered by the browser service worker)
 *
 * Token registration happens client side:
 *   - native: src/utils/nativePush.ts
 *   - web:    src/utils/notification.ts
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  getMessaging,
  type MulticastMessage,
  type SendResponse,
} from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

initializeApp();

const db = getFirestore();

/**
 * Must match the location of your Firestore database, otherwise deployment fails.
 * Change it if you created the database outside the US (e.g. `asia-southeast1`
 * for the Philippines or `europe-west1` for Europe).
 */
const REGION = 'us-central1';

/** Mirrors EMERGENCY_CHANNEL_ID in src/utils/nativePush.ts and strings.xml */
const EMERGENCY_CHANNEL_ID = 'readyalert_emergency';

/** Mirrors the client-side scope check in src/hooks/useActiveAlert.ts */
const GLOBAL_SCOPE = 'GLOBAL_ALL';

/** FCM rejects multicast batches larger than 500 tokens */
const MULTICAST_LIMIT = 500;

/** Errors that mean the token is dead and should be removed from Firestore */
const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const TITLE_BY_ALERT_LEVEL: Record<string, string> = {
  RED: '🚨 RED ALERT - EARTHQUAKE EMERGENCY',
  CRITICAL: '🚨 RED ALERT - EARTHQUAKE EMERGENCY',
  YELLOW: '⚠️ YELLOW ALERT - EARTHQUAKE WARNING',
  WARNING: '⚠️ YELLOW ALERT - EARTHQUAKE WARNING',
  GREEN: '🟢 GREEN ALERT - SAFETY ADVISORY',
};

interface AlertRecord {
  alertLevel?: string;
  message?: string;
  groupId?: string;
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredByRole?: string;
  isBackupAlert?: boolean;
  active?: boolean;
  timestamp?: string;
}

interface Recipient {
  uid: string;
  token: string;
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Devices to notify for an alert: the whole user base for global alerts,
 * otherwise only the members of the alert's volunteer group.
 */
const fetchRecipients = async (groupId: string): Promise<Recipient[]> => {
  const usersRef = db.collection('users');
  const snapshot =
    groupId && groupId !== GLOBAL_SCOPE
      ? await usersRef.where('groupId', '==', groupId).get()
      : await usersRef.get();

  const recipients: Recipient[] = [];
  snapshot.forEach((userDoc) => {
    const token = userDoc.get('fcmToken');
    if (typeof token === 'string' && token.length > 0) {
      recipients.push({ uid: userDoc.id, token });
    }
  });

  return recipients;
};

/**
 * Build the platform-specific message. The `notification` block is what makes
 * delivery work while the app is closed on every platform; the `data` block
 * feeds the in-app siren/vibration handlers and the alert banner.
 */
const buildMessage = (params: {
  alertId: string;
  alertLevel: string;
  title: string;
  body: string;
  groupId: string;
  alert: AlertRecord;
}): Omit<MulticastMessage, 'tokens'> => ({
  notification: {
    title: params.title,
    body: params.body,
  },
  data: {
    alertId: params.alertId,
    alertLevel: params.alertLevel,
    groupId: params.groupId,
    // FCM requires every data value to be a string
    isBackupAlert: String(Boolean(params.alert.isBackupAlert)),
    triggeredByName: params.alert.triggeredByName ?? '',
    triggeredByRole: params.alert.triggeredByRole ?? '',
    title: params.title,
    body: params.body,
  },
  android: {
    priority: 'high',
    notification: {
      channelId: EMERGENCY_CHANNEL_ID,
      sound: 'default',
      priority: 'max',
      visibility: 'public',
      defaultVibrateTimings: true,
    },
  },
  apns: {
    headers: {
      'apns-priority': '10',
      'apns-push-type': 'alert',
    },
    payload: {
      aps: {
        sound: 'default',
      },
    },
  },
  webpush: {
    headers: {
      Urgency: 'high',
      TTL: '3600',
    },
    notification: {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 500],
      tag: `readyalert-${params.alertId}`,
    },
    fcmOptions: {
      link: '/',
    },
  },
});

/**
 * Delete tokens FCM rejected so every later broadcast gets cheaper and more
 * accurate. A token is only cleared when it is still the one stored on the
 * profile — never when the user has since registered a newer device.
 */
const pruneStaleTokens = async (
  responses: SendResponse[],
  batchTokens: string[],
  uidByToken: Map<string, string>,
): Promise<void> => {
  const staleTokensByUid = new Map<string, Set<string>>();

  responses.forEach((response, index) => {
    if (response.success) return;

    const code = response.error?.code ?? '';
    if (!STALE_TOKEN_CODES.has(code)) return;

    const token = batchTokens[index];
    const uid = uidByToken.get(token);
    if (!uid) return;

    const staleTokens = staleTokensByUid.get(uid) ?? new Set<string>();
    staleTokens.add(token);
    staleTokensByUid.set(uid, staleTokens);
  });

  if (staleTokensByUid.size === 0) return;

  const batch = db.batch();
  let cleared = 0;

  for (const [uid, staleTokens] of staleTokensByUid) {
    const userRef = db.collection('users').doc(uid);
    const snapshot = await userRef.get();
    const storedToken = snapshot.get('fcmToken');

    if (typeof storedToken === 'string' && staleTokens.has(storedToken)) {
      batch.update(userRef, { fcmToken: FieldValue.delete() });
      cleared += 1;
    }
  }

  if (cleared > 0) {
    await batch.commit();
    logger.info(`Removed ${cleared} stale FCM token(s).`);
  }
};

export const sendAlertPush = onDocumentCreated(
  { document: 'alerts/{alertId}', region: REGION },
  async (event) => {
    const alertId = event.params.alertId;
    const alert = event.data?.data() as AlertRecord | undefined;

    if (!alert) {
      logger.warn(`Alert ${alertId} had no data — no push sent.`);
      return;
    }

    // Only active alarms are broadcast; resolved history stays silent.
    if (alert.active === false) {
      logger.info(`Alert ${alertId} is not active — no push sent.`);
      return;
    }

    const alertLevel = String(alert.alertLevel ?? 'GREEN').toUpperCase();
    const groupId = String(alert.groupId ?? GLOBAL_SCOPE);
    const title = TITLE_BY_ALERT_LEVEL[alertLevel] ?? '🚨 READY ALERT EMERGENCY';
    const message =
      typeof alert.message === 'string' && alert.message.trim().length > 0
        ? alert.message.trim()
        : 'New earthquake alert issued.';
    const body = alert.triggeredByName ? `${message} — ${alert.triggeredByName}` : message;

    const recipients = await fetchRecipients(groupId);

    if (recipients.length === 0) {
      logger.info(`No registered device for scope "${groupId}" — no push sent.`);
      return;
    }

    // One device token can appear on several profiles (shared phone) — send once.
    const uidByToken = new Map<string, string>();
    for (const recipient of recipients) {
      if (!uidByToken.has(recipient.token)) {
        uidByToken.set(recipient.token, recipient.uid);
      }
    }
    const tokens = [...uidByToken.keys()];

    const messagePayload = buildMessage({ alertId, alertLevel, title, body, groupId, alert });

    let delivered = 0;
    let failed = 0;

    for (const tokenBatch of chunk(tokens, MULTICAST_LIMIT)) {
      const response = await getMessaging().sendEachForMulticast({
        ...messagePayload,
        tokens: tokenBatch,
      });

      delivered += response.successCount;
      failed += response.failureCount;

      await pruneStaleTokens(response.responses, tokenBatch, uidByToken);
    }

    logger.info(
      `Alert ${alertId} (${alertLevel} / ${groupId}) → ${delivered} delivered, ` +
        `${failed} failed out of ${tokens.length} device(s).`,
    );
  },
);
