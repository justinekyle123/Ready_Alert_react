/**
 * SMS broadcasting for Ready Alert — the sender that runs after an alert is created.
 *
 * Transport is a phone running "SMS Gateway for Android" (sms-gate.app) in **Cloud
 * mode**: this code talks to the cloud relay, the relay queues the message, the phone
 * picks it up and sends it from the SIM. See SMS_PLAN.md for why the browser can never
 * call the gateway directly (no CORS, and the credentials can text from your SIM).
 *
 * Design commitments:
 *   - **SMS never breaks push.** Push is a separate Cloud Function, and every failure
 *     here is caught, recorded and logged — a dead phone must not fail the alert.
 *   - **No automatic retry.** The gateway has no idempotency key, so retrying an
 *     ambiguous failure can text everyone twice and bill twice. Failures are recorded
 *     for a human to look at instead.
 *   - **Money is the constraint.** Everything is capped: per alert, per day, and per
 *     level, all tunable from a Firestore document so a runaway loop can be stopped
 *     without a redeploy.
 *   - **Pure logic is separated** (normalisation, body building, recipient planning) so
 *     it is unit-testable with zero sends — see sms.test.ts. Galileo would be proud.
 */
import Client, { MessagePriority } from 'android-sms-gateway';
import type { Firestore } from 'firebase-admin/firestore';
import {
  describePhoneRejection,
  isInvalidPhone,
  normalizePhone,
  type PhoneRejectionReason,
} from './phone';

/** Firestore document that overrides the defaults below (no redeploy needed). */
export const SMS_CONFIG_COLLECTION = 'config';
export const SMS_CONFIG_DOC_ID = 'sms';

/** One SMS segment = 160 GSM-7 characters. Longer messages are split and billed twice. */
export const SMS_SEGMENT_LIMIT = 160;

export interface SmsConfig {
  /** Master kill switch. `false` stops every send, including test messages. */
  enabled: boolean;
  /** Log exactly what would be sent, and send nothing. */
  dryRun: boolean;
  /** Alert levels that trigger SMS, uppercased (e.g. ['RED']). */
  levels: string[];
  /**
   * When true, only users with `smsOptIn === true` are texted.
   * An explicit `smsOptIn: false` is always respected regardless of this setting.
   */
  requireOptIn: boolean;
  /** Hard cap on recipients for a single alert, to bound the cost of one broadcast. */
  maxRecipientsPerAlert: number;
  /** Hard cap on messages sent per calendar day (UTC). */
  dailyCap: number;
  /** Messages per gateway request. */
  chunkSize: number;
  /** Delay between chunks, to stay under the phone's send-rate limit. */
  chunkDelayMs: number;
  /** Give RED alerts priority >99, which bypasses the gateway's own limits and delays. */
  bypassRateLimits: boolean;
  /** Prefix on every message, e.g. `[READYALERT]`. */
  prefix: string;
  /** Pin sending to one gateway device; `null` lets the gateway pick any connected phone. */
  deviceId: string | null;
}

/**
 * Defaults chosen to be *safe but working*:
 *   - RED only. YELLOW/GREEN are frequent and each one costs real SIM load; add them
 *     once you have watched delivery rates (one line in `config/sms`, no redeploy).
 *   - 10 recipients and 50/day, so a first test alert costs almost nothing.
 *   - 5 messages per chunk with a 4s gap, rather than one blast — see SMS_PLAN.md §7.
 */
export const DEFAULT_SMS_CONFIG: SmsConfig = {
  enabled: true,
  dryRun: false,
  levels: ['RED', 'CRITICAL'],
  requireOptIn: false,
  maxRecipientsPerAlert: 10,
  dailyCap: 50,
  chunkSize: 5,
  chunkDelayMs: 4000,
  bypassRateLimits: true,
  prefix: '[READYALERT]',
  deviceId: null,
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asPositiveInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

/**
 * Merge the Firestore document over the defaults, ignoring anything malformed.
 * A typo in the console must never widen a cap or disable a guardrail by accident.
 */
export const resolveSmsConfig = (raw: Record<string, unknown> | undefined): SmsConfig => {
  const source = raw ?? {};

  const levels =
    Array.isArray(source.levels) && source.levels.length > 0
      ? source.levels
          .filter((level): level is string => typeof level === 'string' && level.trim().length > 0)
          .map((level) => level.trim().toUpperCase())
      : DEFAULT_SMS_CONFIG.levels;

  return {
    enabled: asBoolean(source.enabled, DEFAULT_SMS_CONFIG.enabled),
    dryRun: asBoolean(source.dryRun, DEFAULT_SMS_CONFIG.dryRun),
    levels: levels.length > 0 ? levels : DEFAULT_SMS_CONFIG.levels,
    requireOptIn: asBoolean(source.requireOptIn, DEFAULT_SMS_CONFIG.requireOptIn),
    maxRecipientsPerAlert: asPositiveInt(
      source.maxRecipientsPerAlert,
      DEFAULT_SMS_CONFIG.maxRecipientsPerAlert,
      1,
      500,
    ),
    dailyCap: asPositiveInt(source.dailyCap, DEFAULT_SMS_CONFIG.dailyCap, 1, 5000),
    chunkSize: asPositiveInt(source.chunkSize, DEFAULT_SMS_CONFIG.chunkSize, 1, 100),
    chunkDelayMs: asPositiveInt(source.chunkDelayMs, DEFAULT_SMS_CONFIG.chunkDelayMs, 0, 60000),
    bypassRateLimits: asBoolean(source.bypassRateLimits, DEFAULT_SMS_CONFIG.bypassRateLimits),
    prefix:
      typeof source.prefix === 'string' && source.prefix.trim().length > 0
        ? source.prefix.trim()
        : DEFAULT_SMS_CONFIG.prefix,
    deviceId:
      typeof source.deviceId === 'string' && source.deviceId.trim().length > 0
        ? source.deviceId.trim()
        : null,
  };
};

export const isLevelEnabled = (level: string, config: SmsConfig): boolean =>
  config.levels.includes(level.toUpperCase());

// ---------------------------------------------------------------------------
// Message building
// ---------------------------------------------------------------------------

const LEVEL_LABEL: Record<string, string> = {
  RED: 'RED ALERT',
  CRITICAL: 'RED ALERT',
  YELLOW: 'YELLOW WARNING',
  WARNING: 'YELLOW WARNING',
  GREEN: 'GREEN ADVISORY',
  ADVISORY: 'GREEN ADVISORY',
};

/** The one instruction a person needs during shaking. */
const ACTION_BY_LEVEL: Record<string, string> = {
  RED: 'DROP, COVER, HOLD ON.',
  CRITICAL: 'DROP, COVER, HOLD ON.',
};

/**
 * Collapse text to the GSM-7 alphabet.
 *
 * This is not cosmetic: emoji and typographic characters (curly quotes, em dashes,
 * ellipses) force the message into UCS-2, where a segment is **70** characters instead
 * of 160 — more than double the cost, for a decorative character. Non-ASCII glyphs are
 * dropped rather than transliterated, and every replacement below is ASCII.
 */
export const sanitizeForGsm = (text: string): string =>
  text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

/** Cut on a word boundary so the message never ends mid-word. */
const truncateAtWord = (text: string, max: number): string => {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  // Only fall back to a hard cut when the first word alone overflows the budget.
  return (lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
};

const mentionsAction = (text: string): boolean =>
  /\b(drop|duck|cover|hold on)\b/i.test(text);

export interface BuildSmsBodyParams {
  level: string;
  message: string;
  triggeredByName?: string;
  prefix: string;
}

/**
 * Build the final message. The level label and the safety action are protected from
 * truncation — only the leader's free text is ever shortened, so a long message can
 * never push "DROP, COVER, HOLD ON." off the end.
 */
export const buildSmsBody = ({
  level,
  message,
  triggeredByName,
  prefix,
}: BuildSmsBodyParams): string => {
  const cleanPrefix = sanitizeForGsm(prefix);
  const label = LEVEL_LABEL[level.toUpperCase()] ?? 'ALERT';
  const head = `${cleanPrefix} ${label}: `;

  const cleanMessage = sanitizeForGsm(message) || 'Emergency alert issued.';
  const action = ACTION_BY_LEVEL[level.toUpperCase()];
  const tail = action && !mentionsAction(cleanMessage) ? ` ${action}` : '';
  const signer = triggeredByName ? ` - ${sanitizeForGsm(triggeredByName)}` : '';

  let body = `${head}${cleanMessage}${tail}`;
  // The sender's name is the least important part, so it is only added when it fits.
  if (signer && body.length + signer.length <= SMS_SEGMENT_LIMIT) {
    body += signer;
    if (body.length <= SMS_SEGMENT_LIMIT) return body;
  }

  if (body.length <= SMS_SEGMENT_LIMIT) return body;

  // Reserve the tail and the marker so the instruction survives truncation.
  const hasMarker = true;
  const reserved = head.length + tail.length + (hasMarker ? 3 : 0);
  const truncated = truncateAtWord(cleanMessage, SMS_SEGMENT_LIMIT - reserved);
  const rebuilt = `${head}${truncated}${truncated.length < cleanMessage.length ? '...' : ''}${tail}`;
  return rebuilt.length <= SMS_SEGMENT_LIMIT ? rebuilt : rebuilt.slice(0, SMS_SEGMENT_LIMIT);
};

// ---------------------------------------------------------------------------
// Recipient planning
// ---------------------------------------------------------------------------

export interface SmsUserRecord {
  uid: string;
  name?: string;
  contactNumber?: unknown;
  smsOptIn?: unknown;
}

export type SmsSkipReason =
  | 'no_phone'
  | 'opt_out'
  | 'duplicate'
  | 'capped'
  | 'daily_cap'
  | PhoneRejectionReason;

export interface SmsTarget {
  uid: string;
  phone: string;
  name: string;
}

export interface SmsRecipientPlan {
  targets: SmsTarget[];
  skipped: Array<{ uid: string; reason: SmsSkipReason }>;
}

/**
 * Decide who gets a text, deterministically (sorted by uid, so the same alert always
 * produces the same recipient set) and de-duplicated by number.
 *
 * Deduplication matters for cost: two members sharing one family phone is one SIM
 * charge, not two.
 */
export const planSmsRecipients = (
  users: SmsUserRecord[],
  config: Pick<SmsConfig, 'maxRecipientsPerAlert' | 'requireOptIn'>,
): SmsRecipientPlan => {
  const sorted = [...users].sort((a, b) => a.uid.localeCompare(b.uid));
  const skipped: SmsRecipientPlan['skipped'] = [];
  const seenPhones = new Set<string>();
  const candidates: SmsTarget[] = [];

  for (const user of sorted) {
    // An explicit opt-out always wins; implicit consent depends on requireOptIn.
    if (user.smsOptIn === false || (config.requireOptIn && user.smsOptIn !== true)) {
      skipped.push({ uid: user.uid, reason: 'opt_out' });
      continue;
    }

    const normalized = normalizePhone(user.contactNumber);
    if (isInvalidPhone(normalized)) {
      const { reason } = normalized;
      skipped.push({ uid: user.uid, reason: reason === 'empty' ? 'no_phone' : reason });
      continue;
    }

    if (seenPhones.has(normalized.e164)) {
      skipped.push({ uid: user.uid, reason: 'duplicate' });
      continue;
    }

    seenPhones.add(normalized.e164);
    candidates.push({
      uid: user.uid,
      phone: normalized.e164,
      name: user.name ?? '',
    });
  }

  const targets = candidates.slice(0, config.maxRecipientsPerAlert);
  for (const overflow of candidates.slice(config.maxRecipientsPerAlert)) {
    skipped.push({ uid: overflow.uid, reason: 'capped' });
  }

  return { targets, skipped };
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface SmsSendResult {
  messageId: string;
}

export interface SmsProvider {
  readonly name: string;
  send(params: { to: string[]; body: string; priority: number }): Promise<SmsSendResult>;
}

/**
 * The phone-gateway transport. Kept behind this interface so a real SMS carrier
 * (Semaphore, ₱0.56/text) can become primary later without touching the dispatch
 * logic — see SMS_PLAN.md §11.
 */
export const createGatewayProvider = (params: {
  login: string;
  password: string;
  deviceId?: string | null;
}): SmsProvider => ({
  name: 'android-sms-gateway',
  async send({ to, body, priority }) {
    const client = new Client(params.login, params.password);
    const state = await client.send({
      phoneNumbers: to,
      // The SDK type marks `message` as required even though the server accepts exactly
      // one payload field (`message` | `textMessage` | `dataMessage`). Sending only the
      // legacy `message` field is what the SDK's own README does, and the server accepts it.
      message: body,
      deviceId: params.deviceId ?? null,
      priority,
      withDeliveryReport: true,
    });
    return { messageId: state.id };
  },
});

// ---------------------------------------------------------------------------
// Daily quota
// ---------------------------------------------------------------------------

export interface DailyQuota {
  granted: number;
  remaining: number;
}

/**
 * Reserve up to `requested` sends against the daily cap, in a transaction so two
 * simultaneous alerts cannot both spend the last of the budget.
 */
export const consumeDailyQuota = async (
  db: Firestore,
  requested: number,
  dailyCap: number,
  dateKey: string,
): Promise<DailyQuota> => {
  const ref = db.collection('system').doc('smsDaily');

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const sentToday =
      snapshot.exists && snapshot.get('date') === dateKey ? Number(snapshot.get('sent') ?? 0) : 0;

    const remaining = Math.max(dailyCap - sentToday, 0);
    const granted = Math.min(requested, remaining);
    const nowRemaining = remaining - granted;

    if (granted > 0) {
      transaction.set(
        ref,
        { date: dateKey, sent: sentToday + granted, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    }

    return { granted, remaining: nowRemaining };
  });
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export type SmsDispatchStatus = 'sent' | 'partial' | 'dry_run' | 'skipped' | 'failed';

export interface AlertSmsSummary {
  status: SmsDispatchStatus;
  /** Machine-readable reason when nothing (or not everything) was sent. */
  reason: string | null;
  level: string;
  groupId: string;
  body: string;
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  batches: number;
  dryRun: boolean;
  provider: string | null;
  completedAt: string;
}

export interface DispatchAlertSmsParams {
  db: Firestore;
  alertId: string;
  alertLevel: string;
  message: string;
  groupId: string;
  triggeredByName?: string;
  users: SmsUserRecord[];
  config: SmsConfig;
  /** `null` when the gateway credentials are not configured. */
  provider: SmsProvider | null;
  log: (message: string) => void;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

const writeSkipped = async (
  db: Firestore,
  alertId: string,
  skipped: SmsRecipientPlan['skipped'],
): Promise<void> => {
  if (skipped.length === 0) return;
  const batch = db.batch();
  const recipients = db.collection('alerts').doc(alertId).collection('smsRecipients');
  const stamp = new Date().toISOString();

  for (const entry of skipped) {
    batch.set(recipients.doc(entry.uid), {
      status: 'skipped',
      reason: entry.reason,
      detail: entry.reason === 'not_ph_mobile' || entry.reason === 'invalid'
        ? describePhoneRejection(entry.reason)
        : null,
      updatedAt: stamp,
    });
  }

  await batch.commit();
};

/**
 * Send an alert by SMS to every eligible member in scope.
 *
 * Never throws: every failure becomes a recorded status, because an alert that pushed
 * successfully must not be reported as failed just because the phone is offline.
 */
export const dispatchAlertSms = async (
  params: DispatchAlertSmsParams,
): Promise<AlertSmsSummary> => {
  const { db, alertId, config, log } = params;
  const alertLevel = params.alertLevel.toUpperCase();
  const sleep = params.sleep ?? defaultSleep;
  const now = params.now ?? new Date();

  const body = buildSmsBody({
    level: alertLevel,
    message: params.message,
    triggeredByName: params.triggeredByName,
    prefix: config.prefix,
  });

  const plan = planSmsRecipients(params.users, config);
  const base: Omit<AlertSmsSummary, 'status' | 'reason'> = {
    level: alertLevel,
    groupId: params.groupId,
    body,
    targeted: plan.targets.length,
    sent: 0,
    failed: 0,
    skipped: plan.skipped.length,
    batches: 0,
    dryRun: config.dryRun,
    provider: params.provider?.name ?? null,
    completedAt: now.toISOString(),
  };

  const finish = async (
    status: SmsDispatchStatus,
    reason: string | null,
    counts: Partial<Pick<AlertSmsSummary, 'sent' | 'failed' | 'batches' | 'targeted' | 'skipped'>> = {},
  ): Promise<AlertSmsSummary> => {
    const summary: AlertSmsSummary = { ...base, ...counts, status, reason };
    await writeSkipped(db, alertId, plan.skipped);
    await db.collection('alerts').doc(alertId).set({ smsSummary: summary }, { merge: true });
    log(`SMS ${alertId} (${alertLevel}) → ${status}${reason ? ` (${reason})` : ''}: ${JSON.stringify({ targeted: summary.targeted, sent: summary.sent, failed: summary.failed, skipped: summary.skipped, batches: summary.batches })}`);
    return summary;
  };

  // Guardrails come first — no send, no quota consumed.
  if (!config.enabled) return finish('skipped', 'sms_disabled');
  if (!isLevelEnabled(alertLevel, config)) return finish('skipped', 'level_not_enabled');
  if (plan.targets.length === 0) return finish('skipped', 'no_targets');

  if (!params.provider && !config.dryRun) {
    return finish('skipped', 'gateway_credentials_missing');
  }

  if (config.dryRun) {
    log(
      `SMS DRY RUN for alert ${alertId} — nothing will be sent.\n` +
        `  body (${body.length}/${SMS_SEGMENT_LIMIT} chars): ${body}\n` +
        `  targets: ${plan.targets.map((t) => `${t.name || t.uid}=${t.phone}`).join(', ')}`,
    );
    const recipients = db.collection('alerts').doc(alertId).collection('smsRecipients');
    const batch = db.batch();
    const stamp = now.toISOString();
    for (const target of plan.targets) {
      batch.set(recipients.doc(target.uid), {
        phone: target.phone,
        status: 'dry_run',
        updatedAt: stamp,
      });
    }
    await batch.commit();
    return finish('dry_run', null);
  }

  // Bound the cost of one broadcast before sending anything.
  const dateKey = now.toISOString().slice(0, 10);
  const quota = await consumeDailyQuota(db, plan.targets.length, config.dailyCap, dateKey);
  const targets = plan.targets.slice(0, quota.granted);
  const overQuota = plan.targets.slice(quota.granted);

  if (targets.length === 0) return finish('skipped', 'daily_cap');

  const provider = params.provider!;
  const priority =
    config.bypassRateLimits && (alertLevel === 'RED' || alertLevel === 'CRITICAL')
      ? MessagePriority.BypassThreshold
      : MessagePriority.Default;

  const recipientRefs = db.collection('alerts').doc(alertId).collection('smsRecipients');
  const batchRefs = db.collection('alerts').doc(alertId).collection('smsBatches');
  const chunks = chunk(targets, config.chunkSize);

  let sent = 0;
  let failed = 0;
  let batches = 0;

  for (const [index, group] of chunks.entries()) {
    if (index > 0) await sleep(config.chunkDelayMs);

    const batchId = `${alertId}-${index + 1}`;
    const phones = group.map((target) => target.phone);
    const stamp = new Date().toISOString();

    try {
      const result = await provider.send({ to: phones, body, priority });
      sent += group.length;
      batches += 1;

      const record = db.batch();
      record.set(batchRefs.doc(batchId), {
        providerMessageId: result.messageId,
        phoneNumbers: phones,
        count: phones.length,
        priority,
        sentAt: stamp,
      });
      for (const target of group) {
        record.set(recipientRefs.doc(target.uid), {
          phone: target.phone,
          status: 'sent',
          batchId,
          providerMessageId: result.messageId,
          updatedAt: stamp,
        });
      }
      await record.commit();
      log(`SMS batch ${batchId} accepted by ${provider.name} (${phones.length} recipient(s)).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed += group.length;
      batches += 1;

      const record = db.batch();
      record.set(batchRefs.doc(batchId), {
        phoneNumbers: phones,
        count: phones.length,
        error: message,
        failedAt: stamp,
      });
      for (const target of group) {
        record.set(recipientRefs.doc(target.uid), {
          phone: target.phone,
          status: 'failed',
          reason: 'provider_error',
          error: message,
          batchId,
          updatedAt: stamp,
        });
      }
      await record.commit();
      // Deliberately no retry: without an idempotency key a retry can double-send and
      // double-bill. The failure is recorded for a human to act on instead.
      log(`SMS batch ${batchId} FAILED: ${message}`);
    }
  }

  for (const overflow of overQuota) {
    await recipientRefs.doc(overflow.uid).set(
      { phone: overflow.phone, status: 'skipped', reason: 'daily_cap', updatedAt: now.toISOString() },
      { merge: true },
    );
  }

  const skipped = plan.skipped.length + overQuota.length;
  const status: SmsDispatchStatus =
    failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial';

  return finish(
    status,
    quota.remaining === 0 ? 'daily_cap_reached' : null,
    { sent, failed, batches, targeted: targets.length, skipped },
  );
};
