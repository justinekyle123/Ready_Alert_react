/**
 * Ready Alert — broadcast sender (FCM push + SMS)
 *
 * Triggered whenever a document is created in the `alerts` collection:
 *   - `sendAlertPush` pushes to every device that registered `users/{uid}.fcmToken`
 *   - `sendAlertSms`  texts every member in scope with a usable PH mobile number
 *
 * The two are deliberately **separate functions**. SMS fan-out is slow (rate-limited
 * chunks) and can fail on its own; keeping them apart means a dead gateway phone can
 * never delay or fail the push, and each channel can be deployed or disabled alone.
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
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { probeGateway } from './gateway';
import { describePhoneRejection, isInvalidPhone, normalizePhone } from './phone';
import {
  SMS_CONFIG_COLLECTION,
  SMS_CONFIG_DOC_ID,
  buildSmsBody,
  consumeDailyQuota,
  createGatewayProvider,
  dispatchAlertSms,
  resolveSmsConfig,
  type SmsConfig,
  type SmsProvider,
  type SmsUserRecord,
} from './sms';
import { MessagePriority } from 'android-sms-gateway';

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

/**
 * SMS gateway credentials (SMS Gateway for Android — see SMS_PLAN.md).
 * Set with:
 *   firebase functions:secrets:set ANDROID_SMS_GATEWAY_LOGIN
 *   firebase functions:secrets:set ANDROID_SMS_GATEWAY_PASSWORD
 * Never commit these — they can send SMS from your SIM.
 */
const GATEWAY_LOGIN = defineSecret('ANDROID_SMS_GATEWAY_LOGIN');
const GATEWAY_PASSWORD = defineSecret('ANDROID_SMS_GATEWAY_PASSWORD');

/** Firestore document the app subscribes to for gateway status */
const GATEWAY_HEALTH_COLLECTION = 'system';
const GATEWAY_HEALTH_DOC_ID = 'gatewayHealth';

const writeGatewayHealth = (health: Awaited<ReturnType<typeof probeGateway>>) =>
  db.collection(GATEWAY_HEALTH_COLLECTION).doc(GATEWAY_HEALTH_DOC_ID).set(health);

/**
 * SMS behaviour comes from `config/sms` (see SMS_PLAN.md §7) so levels, caps and the
 * dry-run switch can be changed from the console **without a redeploy** — the point
 * being that a runaway broadcast can be stopped while it is happening.
 */
const loadSmsConfig = async (): Promise<SmsConfig> => {
  const snapshot = await db.collection(SMS_CONFIG_COLLECTION).doc(SMS_CONFIG_DOC_ID).get();
  return resolveSmsConfig(snapshot.exists ? (snapshot.data() as Record<string, unknown>) : undefined);
};

/**
 * Build the transport, or return `null` when the secrets are not available yet —
 * a missing secret should surface as `gateway_credentials_missing`, not an exception.
 */
const buildSmsProvider = (config: SmsConfig): SmsProvider | null => {
  try {
    const login = GATEWAY_LOGIN.value();
    const password = GATEWAY_PASSWORD.value();
    if (!login || !password) return null;
    return createGatewayProvider({ login, password, deviceId: config.deviceId });
  } catch (err) {
    logger.warn('SMS gateway secrets are not readable — SMS disabled for now.', err);
    return null;
  }
};

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
/**
 * Users inside an alert's scope: the whole user base for global alerts, otherwise
 * only the members of the alert's volunteer group. Shared by push and SMS so both
 * channels always address the same audience.
 */
const fetchUsersInScope = async (groupId: string) => {
  const usersRef = db.collection('users');
  return groupId && groupId !== GLOBAL_SCOPE
    ? await usersRef.where('groupId', '==', groupId).get()
    : await usersRef.get();
};

const fetchRecipients = async (groupId: string): Promise<Recipient[]> => {
  const snapshot = await fetchUsersInScope(groupId);

  const recipients: Recipient[] = [];
  snapshot.forEach((userDoc) => {
    const token = userDoc.get('fcmToken');
    if (typeof token === 'string' && token.length > 0) {
      recipients.push({ uid: userDoc.id, token });
    }
  });

  return recipients;
};

/** SMS candidates for an alert — phone numbers are normalised later, in sms.ts. */
const fetchSmsCandidates = async (groupId: string): Promise<SmsUserRecord[]> => {
  const snapshot = await fetchUsersInScope(groupId);

  const candidates: SmsUserRecord[] = [];
  snapshot.forEach((userDoc) => {
    candidates.push({
      uid: userDoc.id,
      name: userDoc.get('name'),
      contactNumber: userDoc.get('contactNumber'),
      smsOptIn: userDoc.get('smsOptIn'),
    });
  });

  return candidates;
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

/**
 * Heartbeat so the app always has a reasonably fresh gateway status, even if
 * nobody has opened it. Writes `system/gatewayHealth`, which the client reads
 * in real time via useGatewayHealth().
 */
export const monitorGatewayHealth = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: REGION,
    secrets: [GATEWAY_LOGIN, GATEWAY_PASSWORD],
  },
  async () => {
    const health = await probeGateway({
      source: 'scheduled',
      login: GATEWAY_LOGIN.value(),
      password: GATEWAY_PASSWORD.value(),
    });

    await writeGatewayHealth(health);

    if (health.status === 'online' || health.status === 'degraded') {
      logger.info(`SMS gateway ${health.status} — ${health.onlineDeviceCount} device(s) online.`);
    } else {
      logger.warn(`SMS gateway ${health.status}: ${health.error}`);
    }
  },
);

/**
 * On-demand probe for the "Check now" button. Requires a signed-in user and
 * refreshes the same Firestore document, so every client updates at once.
 */
export const checkGatewayHealth = onCall(
  { region: REGION, secrets: [GATEWAY_LOGIN, GATEWAY_PASSWORD] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to check the SMS gateway status.');
    }

    const health = await probeGateway({
      source: 'manual',
      login: GATEWAY_LOGIN.value(),
      password: GATEWAY_PASSWORD.value(),
    });

    await writeGatewayHealth(health);

    return health;
  },
);

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

/**
 * SMS broadcast for a new alert. Runs independently of `sendAlertPush`, honours
 * `config/sms` (levels, caps, dry run, kill switch) and records a per-recipient
 * outcome on the alert. Never throws — a gateway failure is a status, not a crash.
 */
export const sendAlertSms = onDocumentCreated(
  {
    document: 'alerts/{alertId}',
    region: REGION,
    secrets: [GATEWAY_LOGIN, GATEWAY_PASSWORD],
    // SMS is rate-limited in chunks, so this needs far more headroom than push.
    timeoutSeconds: 300,
  },
  async (event) => {
    const alertId = event.params.alertId;
    const alert = event.data?.data() as AlertRecord | undefined;

    if (!alert) {
      logger.warn(`Alert ${alertId} had no data — no SMS sent.`);
      return;
    }

    // Only active alarms are broadcast; resolved history stays silent.
    if (alert.active === false) {
      logger.info(`Alert ${alertId} is not active — no SMS sent.`);
      return;
    }

    const alertLevel = String(alert.alertLevel ?? 'GREEN').toUpperCase();
    const groupId = String(alert.groupId ?? GLOBAL_SCOPE);
    const message =
      typeof alert.message === 'string' && alert.message.trim().length > 0
        ? alert.message.trim()
        : 'New earthquake alert issued.';

    try {
      const config = await loadSmsConfig();
      const users = await fetchSmsCandidates(groupId);

      const summary = await dispatchAlertSms({
        db,
        alertId,
        alertLevel,
        message,
        groupId,
        triggeredByName: alert.triggeredByName,
        users,
        config,
        provider: buildSmsProvider(config),
        log: (line) => logger.info(line),
      });

      if (summary.status === 'skipped') {
        logger.info(`Alert ${alertId}: SMS skipped (${summary.reason}).`);
      }
    } catch (err) {
      // Push already went out — this must not look like the alert failed.
      logger.error(`SMS dispatch failed for alert ${alertId}. Push was unaffected.`, err);
    }
  },
);

/** `+639171234567` → `+6391712****7`, so logs and toasts never leak a full number. */
const maskPhone = (e164: string): string =>
  e164.length <= 8 ? e164 : `${e164.slice(0, 7)}****${e164.slice(-2)}`;

/**
 * Send ONE real SMS to the signed-in user's own number, to prove the whole chain
 * (credentials → relay → phone → SIM) works before an emergency does.
 *
 * Deliberately ignores `dryRun` — verifying the gateway is the whole point — but the
 * `enabled` kill switch still applies, and the send is charged against the daily cap
 * so a test cannot be looped to bypass it.
 */
export const sendTestSms = onCall(
  { region: REGION, secrets: [GATEWAY_LOGIN, GATEWAY_PASSWORD] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to send a test SMS.');
    }

    const config = await loadSmsConfig();

    if (!config.enabled) {
      throw new HttpsError(
        'failed-precondition',
        'SMS is switched off (config/sms → enabled: false). Turn it on before testing.',
      );
    }

    const provider = buildSmsProvider(config);
    if (!provider) {
      throw new HttpsError(
        'failed-precondition',
        'Gateway credentials are not configured. Run: firebase functions:secrets:set ANDROID_SMS_GATEWAY_LOGIN (and ..._PASSWORD), then redeploy.',
      );
    }

    const profile = await db.collection('users').doc(request.auth.uid).get();
    const normalized = normalizePhone(profile.get('contactNumber'));

    if (isInvalidPhone(normalized)) {
      throw new HttpsError(
        'failed-precondition',
        `This account has no usable Philippine mobile number (${describePhoneRejection(normalized.reason)}). Add one in My Account & Profile first.`,
      );
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const quota = await consumeDailyQuota(db, 1, config.dailyCap, dateKey);
    if (quota.granted < 1) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily SMS limit reached (${config.dailyCap}). Raise dailyCap in config/sms to keep testing.`,
      );
    }

    const body = buildSmsBody({
      level: 'GREEN',
      message: 'TEST ONLY - Ready Alert SMS is working on this account. No emergency.',
      prefix: config.prefix,
    });

    const result = await provider.send({
      to: [normalized.e164],
      body,
      priority: MessagePriority.Default,
    });

    logger.info(`Test SMS sent via ${provider.name} to ${maskPhone(normalized.e164)} (${result.messageId}).`);

    return {
      messageId: result.messageId,
      to: maskPhone(normalized.e164),
      body,
      remainingToday: quota.remaining,
    };
  },
);
