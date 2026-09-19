/**
 * Unit tests for the pure SMS logic — **no network, no Firestore, no sends**.
 *
 * Run from the project root:  npm test
 *
 * These cover exactly the parts where a mistake costs money (a mis-normalised number,
 * a message that spills into a second segment, a recipient counted twice), so they can
 * be run freely even with a live SIM in the gateway phone.
 *
 * Not covered here: `dispatchAlertSms`, which needs a Firestore database. That path is
 * verified with `dryRun: true` against a real alert (SMS_PLAN.md §9).
 */
import assert from 'node:assert/strict';
import { describePhoneRejection, isInvalidPhone, normalizePhone } from './phone';
import {
  DEFAULT_SMS_CONFIG,
  SMS_SEGMENT_LIMIT,
  buildSmsBody,
  chunk,
  isLevelEnabled,
  planSmsRecipients,
  resolveSmsConfig,
  sanitizeForGsm,
  type SmsUserRecord,
} from './sms';

let passed = 0;
const failures: string[] = [];

const test = (name: string, fn: () => void): void => {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push(`${name}\n    ${err instanceof Error ? err.message : String(err)}`);
  }
};

const e164Of = (value: unknown): string => {
  const result = normalizePhone(value);
  assert.equal(result.ok, true, `expected ${JSON.stringify(value)} to normalise, got ${JSON.stringify(result)}`);
  return result.ok ? result.e164 : '';
};

const reasonOf = (value: unknown): string => {
  const result = normalizePhone(value);
  assert.equal(result.ok, false, `expected ${JSON.stringify(value)} to be rejected`);
  return result.ok ? 'ok' : result.reason;
};

// ---------------------------------------------------------------------------
// Phone normalisation — the same person must never be billed twice
// ---------------------------------------------------------------------------

const CANONICAL = '+639171234567';

test('normalises every common PH mobile spelling to one E.164 value', () => {
  for (const input of [
    '09171234567',
    '9171234567',
    '+639171234567',
    '639171234567',
    '+63 917 123 4567',
    '63-917-123-4567',
    '0063 917 123 4567',
    '(0917) 123.4567',
    '  0917 123 4567  ',
    '+63 (917) 123/4567',
  ]) {
    assert.equal(e164Of(input), CANONICAL, `failed for ${JSON.stringify(input)}`);
  }
});

test('accepts other mobile prefixes and rejects landlines', () => {
  assert.equal(e164Of('09981234567'), '+639981234567');
  assert.equal(e164Of('+639451234567'), '+639451234567');
  assert.equal(e164Of('0917 000 0000'), '+639170000000');

  // PH landlines use area codes starting with 2-8 (Manila +63 2, Cebu +63 32).
  assert.equal(reasonOf('+63 2 81234567'), 'not_ph_mobile');
  assert.equal(reasonOf('(032) 123 4567'), 'not_ph_mobile');
});

test('rejects the US placeholder numbers in the seeded demo data', () => {
  assert.equal(reasonOf('+1 800 555 0199'), 'not_ph_mobile');
  assert.equal(reasonOf('+1 555 012 3456'), 'not_ph_mobile');
});

test('rejects blanks and non-numbers without throwing', () => {
  assert.equal(reasonOf(''), 'empty');
  assert.equal(reasonOf('   '), 'empty');
  assert.equal(reasonOf(undefined), 'empty');
  assert.equal(reasonOf(null), 'empty');
  assert.equal(reasonOf(9171234567), 'empty'); // numbers are stored as strings

  assert.equal(reasonOf('n/a'), 'invalid');
  assert.equal(reasonOf('12345'), 'invalid');
  assert.equal(reasonOf('+'), 'invalid');
});

test('the rejection type guard distinguishes both branches', () => {
  assert.equal(isInvalidPhone(normalizePhone('n/a')), true);
  assert.equal(isInvalidPhone(normalizePhone('+1 800 555 0199')), true);
  assert.equal(isInvalidPhone(normalizePhone('09171234567')), false);
});

test('describePhoneRejection explains every reason', () => {
  for (const reason of ['empty', 'invalid', 'not_ph_mobile'] as const) {
    assert.equal(typeof describePhoneRejection(reason), 'string');
    assert.ok(describePhoneRejection(reason).length > 5);
  }
});

// ---------------------------------------------------------------------------
// Message building — one segment, always ASCII, action protected
// ---------------------------------------------------------------------------

const ACTION = 'DROP, COVER, HOLD ON.';
const GSM7 = /^[\x20-\x7E]+$/;

test('builds a single-segment message with the level and the safety action', () => {
  const body = buildSmsBody({
    level: 'RED',
    message: 'Earthquake shaking detected.',
    triggeredByName: 'Juan Dela Cruz',
    prefix: '[READYALERT]',
  });

  assert.ok(body.startsWith('[READYALERT] RED ALERT: '), body);
  assert.ok(body.includes(ACTION), body);
  assert.ok(body.includes('Juan Dela Cruz'), body);
  assert.ok(body.length <= SMS_SEGMENT_LIMIT, `${body.length} chars: ${body}`);
  assert.ok(GSM7.test(body), `non-GSM character in: ${body}`);
});

test('truncates a long message but never the action', () => {
  const body = buildSmsBody({
    level: 'RED',
    message: 'word '.repeat(120),
    triggeredByName: 'A Very Long Barangay Captain Name',
    prefix: '[READYALERT]',
  });

  assert.ok(body.length <= SMS_SEGMENT_LIMIT, `${body.length} chars`);
  assert.ok(body.includes(ACTION), 'the safety action must survive truncation');
  assert.ok(body.includes('...'), 'the cut should be marked');
  assert.ok(GSM7.test(body), body);
});

test('does not repeat the action when the leader already wrote it', () => {
  const body = buildSmsBody({
    level: 'RED',
    message: 'Magnitude 6.2. DROP, COVER, HOLD ON now!',
    prefix: '[READYALERT]',
  });

  const occurrences = body.split('DROP').length - 1;
  assert.equal(occurrences, 1, `action duplicated: ${body}`);
  assert.ok(body.length <= SMS_SEGMENT_LIMIT, body);
});

test('collapses typographic characters that would force a second segment', () => {
  // em dash, curly quotes and ellipsis each push the whole SMS into UCS-2 (70 chars),
  // so they are transliterated to ASCII; the accented letter cannot be, so it is dropped.
  assert.equal(sanitizeForGsm('caf\u00e9 \u2014 \u201Cquoted\u201D\u2026'), 'caf - "quoted"...');
  assert.equal(sanitizeForGsm('\uD83D\uDEA8 ALERT \u2014 drop now\u2026'), 'ALERT - drop now...');
  assert.ok(GSM7.test(sanitizeForGsm('\uD83D\uDEA8 ALERT \u2014 drop now\u2026')));
  assert.equal(sanitizeForGsm('\uD83D\uDEA8'), '');
  assert.equal(sanitizeForGsm('line1\n\n  line2'), 'line1 line2');
});

test('falls back to a sensible body for an empty message and unknown level', () => {
  const body = buildSmsBody({ level: 'PURPLE', message: '   ', prefix: '[READYALERT]' });
  assert.ok(body.includes('ALERT'), body);
  assert.ok(body.length <= SMS_SEGMENT_LIMIT, body);
});

// ---------------------------------------------------------------------------
// Recipient planning — who is texted, who is skipped, and why
// ---------------------------------------------------------------------------

const users: SmsUserRecord[] = [
  { uid: 'u1', name: 'Ana', contactNumber: '09171234567' },
  { uid: 'u2', name: 'Ben', contactNumber: '+63 917 123 4567' }, // same phone as Ana
  { uid: 'u3', name: 'Cara', contactNumber: '' }, // no number
  { uid: 'u4', name: 'Dan', contactNumber: '09981234567', smsOptIn: false }, // opted out
  { uid: 'u5', name: 'Eve', contactNumber: '9451234567' },
  { uid: 'u6', name: 'Fay', contactNumber: '+1 800 555 0199' }, // US placeholder
];

test('de-duplicates a shared phone and reports every skip reason', () => {
  const plan = planSmsRecipients(users, { maxRecipientsPerAlert: 10, requireOptIn: false });

  assert.deepEqual(
    plan.targets.map((target) => target.phone),
    ['+639171234567', '+639451234567'],
  );

  const reasons = Object.fromEntries(plan.skipped.map((entry) => [entry.uid, entry.reason]));
  assert.equal(reasons.u2, 'duplicate');
  assert.equal(reasons.u3, 'no_phone');
  assert.equal(reasons.u4, 'opt_out');
  assert.equal(reasons.u6, 'not_ph_mobile');
});

test('an explicit opt-out is honoured even when consent is not required', () => {
  const plan = planSmsRecipients(users, { maxRecipientsPerAlert: 10, requireOptIn: false });
  assert.ok(!plan.targets.some((target) => target.uid === 'u4'));
});

test('requireOptIn only texts users who explicitly consented', () => {
  const withConsent = users.map((user) =>
    user.uid === 'u1' ? { ...user, smsOptIn: true } : user,
  );
  const plan = planSmsRecipients(withConsent, { maxRecipientsPerAlert: 10, requireOptIn: true });

  assert.deepEqual(plan.targets.map((target) => target.uid), ['u1']);
  const reasons = Object.fromEntries(plan.skipped.map((entry) => [entry.uid, entry.reason]));
  assert.equal(reasons.u5, 'opt_out');
});

test('caps the recipient list and marks the overflow as capped', () => {
  const plan = planSmsRecipients(users, { maxRecipientsPerAlert: 1, requireOptIn: false });

  assert.equal(plan.targets.length, 1);
  assert.equal(plan.skipped.filter((entry) => entry.reason === 'capped').length, 1);
});

test('is deterministic regardless of input order', () => {
  const first = planSmsRecipients(users, { maxRecipientsPerAlert: 10, requireOptIn: false });
  const shuffled = planSmsRecipients([...users].reverse(), {
    maxRecipientsPerAlert: 10,
    requireOptIn: false,
  });

  assert.deepEqual(
    first.targets.map((target) => target.uid),
    shuffled.targets.map((target) => target.uid),
  );
});

// ---------------------------------------------------------------------------
// Config parsing — a typo must not widen a guardrail
// ---------------------------------------------------------------------------

test('falls back to defaults when the config document is missing', () => {
  assert.deepEqual(resolveSmsConfig(undefined), DEFAULT_SMS_CONFIG);
});

test('ignores malformed values instead of trusting them', () => {
  const config = resolveSmsConfig({
    enabled: 'yes', // not a boolean
    levels: 'RED', // not an array
    maxRecipientsPerAlert: 99999, // above the hard maximum
    dailyCap: -5, // below the hard minimum
    chunkSize: 0,
    deviceId: '   ',
  });

  assert.equal(config.enabled, DEFAULT_SMS_CONFIG.enabled);
  assert.deepEqual(config.levels, DEFAULT_SMS_CONFIG.levels);
  assert.equal(config.maxRecipientsPerAlert, 500);
  assert.equal(config.dailyCap, 1);
  assert.equal(config.chunkSize, 1);
  assert.equal(config.deviceId, null);
});

test('reads real overrides, normalising level names', () => {
  const config = resolveSmsConfig({
    enabled: false,
    dryRun: true,
    levels: ['red', ' yellow '],
    prefix: '[RA]',
    deviceId: 'ev2jZcN38E8O0zkWjHpfz',
  });

  assert.equal(config.enabled, false);
  assert.equal(config.dryRun, true);
  assert.deepEqual(config.levels, ['RED', 'YELLOW']);
  assert.equal(config.prefix, '[RA]');
  assert.equal(config.deviceId, 'ev2jZcN38E8O0zkWjHpfz');
});

test('level gating is case-insensitive', () => {
  const config = resolveSmsConfig({ levels: ['RED'] });
  assert.equal(isLevelEnabled('red', config), true);
  assert.equal(isLevelEnabled('RED', config), true);
  assert.equal(isLevelEnabled('GREEN', config), false);
});

test('chunk splits into batches of the configured size', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(chunk([], 3), []);
  assert.deepEqual(chunk([1], 5), [[1]]);
});

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\u2717 ${failures.length} failing, ${passed} passing\n`);
  for (const failure of failures) console.error(`  \u2717 ${failure}\n`);
  process.exitCode = 1;
} else {
  console.log(`\u2713 all ${passed} SMS logic tests passed (nothing was sent)`);
}
