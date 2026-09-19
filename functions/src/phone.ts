/**
 * Philippine mobile number normalisation.
 *
 * `users.contactNumber` is collected as free text, so the same person can be
 * stored as `09171234567`, `917 123 4567`, `+63 917 123 4567` or `0063917...`.
 * SMS is billed per recipient, so two spellings of one number would be two
 * charges — every number is collapsed to E.164 before it is used.
 *
 * Deliberately pure (no I/O, no Firebase) so it can be unit-tested: see sms.test.ts.
 */

export type PhoneRejectionReason = 'empty' | 'invalid' | 'not_ph_mobile';

export type PhoneNormalization =
  | { ok: true; e164: string }
  | { ok: false; reason: PhoneRejectionReason };

/**
 * `+63`, a mobile prefix (`9`), then 9 more digits.
 *
 * PH landlines use area codes starting with 2-8 (`+63 2 …` Manila, `+63 32 …`
 * Cebu) and `9` is reserved for mobile, so this single check rejects landlines
 * and every non-PH number without maintaining an area-code list.
 */
const PH_MOBILE_E164 = /^\+639\d{9}$/;

/** Prefix used by PH carriers for all mobile numbers, e.g. 0917 / 0998 / 0945. */
const PH_MOBILE_NATIONAL_LENGTH = 10;

export const isPhMobile = (value: string): boolean => PH_MOBILE_E164.test(value);

/**
 * Normalise any reasonable spelling of a PH mobile number to `+639XXXXXXXXX`.
 *
 * Accepts `0917…`, `917…`, `+63917…`, `63917…`, `0063 917…` and any mix of
 * spaces, dashes, dots, slashes or parentheses.
 */
export const normalizePhone = (raw: unknown): PhoneNormalization => {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };

  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };

  // `0063` is the international dialling prefix for the Philippines.
  const digits = trimmed.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 0) {
    // e.g. "n/a", "-", "none" — a placeholder rather than a phone number.
    return { ok: false, reason: 'invalid' };
  }

  let national: string;
  if (digits.startsWith('63')) {
    national = digits.slice(2); // +63917… / 63917…
  } else if (digits.startsWith('0')) {
    national = digits.slice(1); // 0917…
  } else {
    national = digits; // 917… (already national form)
  }

  const e164 = `+63${national}`;

  if (!PH_MOBILE_E164.test(e164)) {
    // Enough digits to be a phone number, but not a PH mobile: a landline, a
    // foreign number (+1 800 555 0199 is in the seeded demo data), or a typo.
    const enoughDigits = digits.length >= PH_MOBILE_NATIONAL_LENGTH;
    return { ok: false, reason: enoughDigits ? 'not_ph_mobile' : 'invalid' };
  }

  return { ok: true, e164 };
};

/**
 * Type guard for the rejected branch.
 *
 * Used instead of `if (!result.ok)` because the app's tsconfig (`npm run lint`) does not
 * enable `strict`, and without `strictNullChecks` TypeScript will not narrow this union
 * from a boolean discriminant — a user-defined guard narrows under either setting.
 */
export const isInvalidPhone = (
  result: PhoneNormalization,
): result is { ok: false; reason: PhoneRejectionReason } => !result.ok;

/** Short, loggable explanation for a rejection (never includes the number). */
export const describePhoneRejection = (reason: PhoneRejectionReason): string => {
  switch (reason) {
    case 'empty':
      return 'no contact number on the profile';
    case 'invalid':
      return 'not a usable phone number';
    case 'not_ph_mobile':
      return 'not a Philippine mobile number';
  }
};
