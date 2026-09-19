# SMS Integration Plan (SMS_PLAN.md)

Plan for adding SMS delivery to **Ready Alert**, alongside the existing FCM push pipeline.

**Decisions already made**

| Decision | Choice |
| :--- | :--- |
| SMS transport | **Your own Android phone as the gateway** (SMS Gateway for Android™) — no commercial provider |
| Which alerts trigger SMS | **All levels** (GREEN / YELLOW / RED) — ⚠️ see §7 for the risk this carries |
| Where the sender lives | Server side (Cloud Function), **not** the browser |

---

## 1. Direct answers to your two questions

> *"I think I should host this sms on cloud?"*

**Not necessarily — and you probably shouldn't host anything.** The app has three work modes and only one of them needs a server you own:

| Mode | How it works | Reachable from your Cloud Function? |
| :--- | :--- | :--- |
| **Local Server** | HTTP API on the phone itself (`http://<phone-ip>:8080`) | ❌ **No** |
| **Cloud Server** (default) | Phone connects outbound to `api.sms-gate.app`; you call that cloud API | ✅ Yes |
| **Private Server** | Self-hosted server (Docker image `capcom6/sms-gateway`); phone registers to it | ✅ Yes |

The docs are explicit that this rules out local mode for us:

> *"External services like Google Apps Script, AWS Lambda, or other cloud functions cannot directly access Local Server API endpoints due to network constraints."*

So: **Cloud mode** to start (zero hosting, the phone dials out, no port forwarding, works behind CGNAT/mobile data), and **Private Server** only if you later want the traffic on your own infrastructure.

> *"and call it by react?"*

**No. Call it from the existing Cloud Function.** Three hard reasons:

1. **No CORS.** The official client's README states it plainly: *"the API does not provide CORS headers, so the library cannot run in a browser."* A fetch from React would be blocked by the browser.
2. **Credentials.** The gateway login/password can send SMS from your personal SIM. In the browser bundle, anyone can read it out of DevTools and text whoever they want on your load.
3. **You already have the right chokepoint.** `alerts/{alertId}` → `sendAlertPush` is where alerts already become notifications. SMS belongs beside the push fan-out: same trigger, same recipient query, one place for caps, logging and idempotency.

```
React (browser / APK)                    ← only writes an alert document
   │
   │  writes alerts/{alertId}  (already implemented)
   ▼
Cloud Function  sendAlertPush            ← server side, holds the secret
   ├── push fan-out  → users/{uid}.fcmToken          (already built)
   └── SMS fan-out   → android-sms-gateway SDK  →  api.sms-gate.app
                                                        │  (outbound connection)
                                                        ▼
                                                   Your Android phone
                                                        │ SEND_SMS
                                                        ▼
                                              Volunteers' mobile numbers
```

### What is hosted, and what is NOT

You do **not** need to host anything new. You need exactly one piece of server-side code, and it already exists in this repo (`functions/`).

| Component | Who runs it | Do you host it? |
| :--- | :--- | :--- |
| `api.sms-gate.app` (gateway cloud relay) | The project's maintainers | ❌ No — free public service, or self-host `capcom6/sms-gateway` if you want Private mode |
| **`functions/`** (the caller) | Firebase Cloud Functions | ✅ Yes — **already deployed by you**, this is the only "host" |
| Your Android phone + gateway app | You | ❌ No — in Cloud mode the phone connects **outbound**, so no public IP, no port forwarding, no ngrok, works behind CGNAT and mobile data |
| Webhook receiver (delivery receipts) | Firebase Cloud Functions | ✅ Same deployment — one extra `onRequest` function in the same folder |

**Do not create a separate `sms/` service.** Reasons:

1. It is a **second deployment** with a **second copy of the same secrets** — more places to leak the credentials that can text from your SIM.
2. It is a **second always-on process** that can silently die, right when an alert needs it.
3. The Cloud Function already reads the alert document and already knows the recipients, so a separate service would have to re-implement `fetchRecipients()` and subscribe to Firestore again.
4. One trigger, one log stream (`firebase functions:log`), one deploy command.

**If Cloud Functions is off the table** (it needs the Blaze plan, and any always-on host with a free tier now needs a card too), the options are:

- A **Cloud Run** service or small VPS polling Firestore every N seconds and calling the gateway — still "hosting something", plus a background reader and its own credentials. Only worth it if the phone or the gateway goes fully independent of this app.
- A **Google Apps Script** trigger (free, no billing card) polling Firestore REST and calling the Cloud API. Viable in a pinch, but: 1-minute minimum polling granularity, a second codebase to maintain, and it's a worse fit for a system that must fire within seconds. Treat it as a last resort, not the plan.

Note the call direction that makes all of this cheap: **your server calls the gateway cloud; the phone never accepts inbound connections.** The only inbound direction is the optional delivery-receipt webhook, and that lives in the same `functions/` deployment.

---

## 2. What the gateway API gives us (verified)

| Feature | Why it matters here |
| :--- | :--- |
| Official TS client: `npm install android-sms-gateway` | Typed, Node 18+, no hand-rolled REST |
| Basic auth **or** JWT with scopes (`messages:send`) | JWT is recommended — short TTL, revocable |
| `client.send({ phoneNumbers: [...], message })` | **One call to many numbers** — no per-recipient loop needed |
| Message state tracking + webhooks | Delivery receipts per message → audit trail |
| Built-in **send rate limiting** ("e.g. per 30 minutes") | Protect the SIM from operator throttling |
| Multi-SIM and multi-device | Messages distribute across connected devices |
| End-to-end encryption of content + recipients | Message text is decrypted on the device (optional hardening) |
| Customizable base URL | That's the Private Server path |
| Cost | ₱0 in API fees — you spend your own SIM load/promo |

> 🔑 **Finding worth remembering for Phase 3:** `MessagePriority.BypassThreshold = 100`. The library documents that *"messages with values greater than 99 will bypass limits and delays"*. For a RED alert you can set `priority: 100+` to skip the gateway's own rate limiter and send-interval delays. Carrier throttling is still outside our control, but this makes the fan-out far faster than the naive plan assumed — use it for RED, and keep normal priority for GREEN/YELLOW so you don't exhaust the SIM's goodwill on routine messages.

**Verified usage** (from the client README):

```ts
import Client, { MessagePriority } from 'android-sms-gateway';

const client = new Client(
  process.env.ANDROID_SMS_GATEWAY_LOGIN!,
  process.env.ANDROID_SMS_GATEWAY_PASSWORD!
);

const state = await client.send({
  phoneNumbers: ['+639171234567'],
  message: 'RED ALERT — Earthquake shaking detected. DROP, COVER, HOLD ON.',
  priority: MessagePriority.Default,
});
console.log('Message ID:', state.id);
```

---

## 3. Why the phone-as-gateway approach is a real risk for *this* app

I'm not talking you out of it — it's free, needs no registration, and works on PH numbers. But for an **earthquake** alert system the failure mode is the disaster itself:

| Risk | Impact |
| :--- | :--- |
| One phone = one point of failure | If that phone is dead, off, or buried when the quake hits, **no SMS goes out at all** |
| Android battery optimisation | OEMs (Xiaomi, Oppo, Vivo…) aggressively kill background apps — the gateway must be exempted or it silently stops |
| Android 15+ restrictions | The project has a dedicated note about newer Android background limits |
| Operator throttling | The project's own README warns: *"It is not recommended to use this for batch sending due to potential mobile operator restrictions"* |
| Network congestion after a quake | Cell networks overload exactly when you need them; sending is slow and may fail |
| SIM load / promo ToS | Bulk sending on an "unlimited text" promo typically violates carrier terms → throttle or block |
| Public network visibility | A 24/7 on-line phone running an SMS API is a target if credentials leak |

**Recommended mitigation** (cheap to build now, expensive to retrofit): put SMS behind the same provider interface as a commercial API, so `Semaphore` (₱0.56/text) can become the primary sender and the phone a fallback — or the reverse. The gateway even ships a **Twilio Fallback Service** if you later want automatic failover.

Also note: **SMS fan-out is inherently slow.** If the gateway is limited to, say, 10/min, 100 volunteers take ~10 minutes to notify. Push is instant. So SMS should stay the *safety net for members without data*, not the primary channel.

---

## 4. Data model changes

Today `contactNumber` is **free text with zero validation** and the demo accounts hold US placeholders (`+1 800 555 0199`, `authService.ts:104`) — those will fail or waste load. Normalisation is not optional.

```
users/{uid}
  contactNumber: "+639171234567"   // normalised E.164 — 09xx/9xx/+63 9xx all collapse here
  smsOptIn: true                   // consent — required for broadcast messaging
  smsUpdatedAt: "..."

alerts/{alertId}
  smsSummary: { targeted, sent, failed, skipped, batches }

alerts/{alertId}/smsRecipients/{uid}
  phone, status: "queued"|"sent"|"delivered"|"failed"|"skipped",
  reason ("no_phone" | "opt_out" | "duplicate" | "invalid"), batchId

alerts/{alertId}/smsBatches/{batchId}
  providerMessageId, phoneNumbers[], count, sentAt   ← webhooks map a message ID back to these
```

Normalisation rules: `0917…` → `+63917…`, `917…` → `+63917…`, strip spaces/dashes/parens, reject landlines (`+63 2 …`), reject non-PH country codes, and **de-duplicate** (two members sharing a family phone = one SMS = one charge).

---

## 5. Message design

160 characters per segment (**billed per segment**), and the gateway's auto-partitioning splits longer text. Keep it to one segment:

```
[READYALERT] RED ALERT: Earthquake shaking detected. DROP, COVER, HOLD ON.
```

`[READYALERT] RED ALERT: ` is 25 chars — leaves ~135 for the leader's message. Truncate the leader's free-text message at a word boundary and always append the level + action.

Content rules to respect (they carry over from PH regulations even on a personal SIM): **no shortened URLs, no phone numbers in the body**.

---

## 6. Implementation phases

| Phase | Deliverable | Cost | Gate |
| :--- | :--- | :--- | :--- |
| **✅ 0a. Gateway health check** *(done)* | `functions/src/gateway.ts` (probe) + `monitorGatewayHealth` (5-min heartbeat) + `checkGatewayHealth` (callable "Check now") + `useGatewayHealth` → status card in the Host overview and a readiness strip in the Tri-Alarm panel | ₱0 | Works today: reports `unconfigured` until the secrets are set, so it is safe to deploy before the phone is ready |
| **0. Gateway setup** | Phone in Cloud (or Private) mode, credentials copied, `READYALERT`-style sender verified, battery optimisation disabled, send-rate limit configured, test SMS to your own number | ₱0 | You can send one SMS via the API by hand (curl/clients) |
| **✅ 1. Phone hygiene** *(done)* | `functions/src/phone.ts` — `normalizePhone()` collapses `09xx`, `9xx`, `+63 9xx`, `0063…` and `(0917)…` to one E.164 value, and rejects landlines, foreign numbers and placeholders (including the US numbers in `authService.ts`). `smsOptIn` is on the user type. | ₱0 | ✅ **21 unit tests** — `npm test` |
| **✅ 2. Sender + dry run** *(done)* | `functions/src/sms.ts` — provider behind an interface, message builder, recipient planner, caps, batch/recipient recording. Runs in a **separate `sendAlertSms` trigger**, not inside `sendAlertPush`, so a slow or dead gateway can never delay or fail the push. `dryRun` is a config flag, not an env var. | ₱0 | ✅ Dry run recorded 2 targets + 5 skips, sent nothing |
| **✅ 3. Real sends** *(code done — needs your live test)* | Chunked fan-out honouring the send-rate limit, `priority > 99` on RED to bypass the gateway's own delays, per-recipient + per-batch records, and **no retry by design** (the gateway has no idempotency key, so retrying an ambiguous failure can text everyone twice and bill twice). | SIM load | ⬜ Tap **Send test SMS** in the Host overview |
| **⏳ 4. Status & UI** *(partial)* | ✅ `alerts/{id}.smsSummary` + `smsRecipients/{uid}` recorded, and typed on the client. ✅ **Send test SMS** button in the gateway card. ⬜ Delivery-receipt webhook; "SMS 18/20 sent" on the alert banner/history. | ₱0 | Records verified in Firestore; banner UI next |
| **✅ 5. Guardrails** *(done)* | `config/sms`, read **at send time** so it needs no redeploy: kill switch, levels, `requireOptIn`, `maxRecipientsPerAlert`, `dailyCap`, `chunkSize`, `chunkDelayMs`, `prefix`, `deviceId`. A malformed value falls back to the default instead of widening a cap. | ₱0 | ✅ All 3 guardrail paths + the daily cap verified |
| **6. Optional failover** | Swap in `Semaphore` as primary when the phone is unhealthy (health check via the client) | ₱0.56/text | — |

Phases 1, 2 and 5 are done and **entirely verifiable for ₱0** (`npm test`, plus a `dryRun` alert). Phase 3 is written but unproven until one real SMS arrives — see §12 for the two-command way to prove it.

---

## 7. ⚠️ Guardrails for your "all levels" choice

You chose **all levels**, which is the most expensive and riskiest setting with a personal SIM. Concretely:

- One broadcast to 100 volunteers = **100 SMS from your SIM**. A drill with 5 alerts where 3 are GREEN = 300 messages, all of which the phone must physically send through the operator.
- The operator's anti-spam systems see a personal SIM sending hundreds of identical texts. That is the exact pattern that gets a SIM throttled or blocked — and you'd discover it during an incident, not a drill.
- The gateway's README explicitly does not recommend batch sending for this reason.

The plan therefore builds in: a **config document** (change behaviour without a redeploy), a **hard recipient cap per alert**, a **daily cap**, and **rate-limited chunking** rather than one blast. I'd still suggest starting at RED-only in the config and only widening once you've watched real delivery rates — that's a config change, not a code change.

---

## 8. Security & privacy requirements

1. **Never ship gateway credentials to the client.** Store them with `defineSecret('ANDROID_SMS_GATEWAY_LOGIN')` / `defineSecret('..._PASSWORD')` and `firebase functions:secrets:set`. Never in `firebase-applet-config.json`, never in `.env.local` for the Vite bundle.
2. **Prefer JWT over Basic auth** — scope it to `messages:send` only, short TTL, generated server-side.
3. **Authenticate the webhook** before trusting delivery status. The gateway exposes a `signingKey` setting (`SettingsWebhooks.signingKey`) that signs webhook payloads — verify that signature, don't trust an unauthenticated POST. Expose the receiving endpoint as a Firebase Functions `onRequest` in the same `functions/` folder (region must match).
4. **🔴 Pre-existing issue this work makes worse:** `firestore.rules` currently has `allow read, write: if true` on `users`. Every member's **phone number is already world-readable** to anyone who knows the project ID. Centralising phone numbers for SMS increases the exposure. Locking down `users` reads (owner + same-group leader + host) should be treated as part of this work, not a later nice-to-have.
5. **Kill switch** in `config/sms` so a runaway loop can be stopped without deploying.

---

## 9. Testing plan (₱0 where possible)

| Test | How | Expect |
| :--- | :--- | :--- |
| Normalisation | Unit tests on `normalizePhone()` | `0917…`/`917…`/`+63 917…` → `+63917…`; landlines rejected |
| Dry run | `SMS_DRY_RUN=true`, create a test alert | Logs recipients + final 160-char body, **zero** SMS |
| Single send | Send to **your own number only** via the API | Message arrives, `state.id` returned |
| End-to-end | RED alert with 2–3 opted-in test numbers | Push instant, SMS within the rate window |
| Failure path | Airplane mode / wrong password | Alert still pushes; SMS marked failed; no crash |
| Duplicate guard | Re-run the trigger | No second SMS to anyone |
| Opt-out | `smsOptIn: false` | `skipped`, reason `opt_out` |

---

## 10. Open items I need from you

**Status: all of these are now resolved.** The credentials were provided and verified against the live relay, the phone is confirmed in **Cloud mode** and reporting in. The answers are recorded in §12; the original questions are kept below for context.

1. **Confirm which app/mode** — is it *SMS Gateway for Android™* (sms-gate.app)? Which mode is the phone in: Cloud, Local, or Private? (Local changes the design: we'd need a tunnel, and it's not reachable from Cloud Functions.)
2. **Gateway credentials** for the Cloud Function secrets — send them separately, and only after you've confirmed the mode. These are real secrets: they let anyone send SMS from your SIM.
3. **Confirm the SIM's rate limit setting** in the app (messages per period) — the plan's chunking uses this number.
4. **Decision on the "all levels" guardrail** — starting RED-only in config with a cap, or genuinely every level from day one?
5. **Do you have a spare/idle phone + SIM** for this, rather than your daily driver? Strongly recommended.

---

## 11. Decision log

| Option | Verdict |
| :--- | :--- |
| **SMS Gateway for Android (phone)** | ✅ Chosen. ₱0 API cost, no sender-ID registration, PH numbers work, one call to many numbers |
| **Semaphore** (PH, ₱0.56/text) | Kept as the recommended failover/primary if reliability matters more than cost |
| **Twilio** | Rejected for now: PH Sender ID registration is mandatory and unregistered IDs are blocked; US-format demo numbers would need rework |
| **Knock** (recommended by the Gravity Index) | ❌ Rejected. An orchestration layer that still needs Twilio underneath — an extra vendor and an extra bill for a one-way broadcast |
| **Native `sms:` deep link / Capacitor SMS plugin** | Useful **demo-only** fallback: opens the phone's composer pre-filled, ₱0, but it's one manual message per recipient — never automated broadcast |
| **Calling the gateway from React** | ❌ Rejected on three grounds: no CORS, credentials exposed, wrong layer |
| **Bolting SMS onto `sendAlertPush`** | ❌ Rejected. SMS fan-out is rate-limited and slow; a separate `sendAlertSms` trigger keeps a dead phone from delaying or failing the push |
| **Auto-retrying a failed batch** | ❌ Rejected. No idempotency key ⇒ a retry can double-text and double-bill. Failures are recorded for a human instead |

---

## 12. Runbook — turning SMS on (verified)

### What was confirmed for you

| Check | Result |
| :--- | :--- |
| Credentials | ✅ Authenticated against `https://api.sms-gate.app/3rdparty/v1` |
| Relay | ✅ `pass`, v1.47.4 |
| Phone | ✅ `realme/RMX3269`, id `ev2jZcN38E8O0zkWjHpfz`, reporting in ~2 min ago |
| Mode | ✅ **Cloud** — the device is registered with the relay, so the Cloud Function can reach it with no tunnel or port-forwarding |
| Send path | ✅ A probe was rejected server-side with `HTTP 400 {"message":"invalid phone number"}` — auth and payload shape are accepted, and that probe sent nothing |

### 1. Store the credentials as secrets (never in the repo)

These can send SMS from your SIM. They must go into Secret Manager, not into a config file:

```bash
firebase login
firebase use --add                    # pick readyalert-7c4bb
firebase functions:secrets:set ANDROID_SMS_GATEWAY_LOGIN
firebase functions:secrets:set ANDROID_SMS_GATEWAY_PASSWORD
firebase deploy --only functions
```

`ANDROID_SMS_GATEWAY_LOGIN` = the gateway **username**, `..._PASSWORD` = the gateway **password** (not your Firebase password, not the VAPID key).

> Deploying with a secret bound but never created fails, so run both `secrets:set` commands **before** the deploy.

### 2. Optional — override the defaults without a redeploy

Create **`config/sms`** (collection `config`, document `sms`). Anything omitted keeps its default:

```json
{
  "enabled": true,
  "dryRun": false,
  "levels": ["RED", "CRITICAL"],
  "requireOptIn": false,
  "maxRecipientsPerAlert": 10,
  "dailyCap": 50,
  "chunkSize": 5,
  "chunkDelayMs": 4000,
  "bypassRateLimits": true,
  "prefix": "[READYALERT]",
  "deviceId": null
}
```

The two you are most likely to change:

- **Every level instead of RED only** — `"levels": ["RED", "CRITICAL", "YELLOW", "WARNING", "GREEN", "ADVISORY"]`. You originally chose all levels; the default is RED-only because YELLOW/GREEN are frequent and each one costs SIM load. This is a one-line change with no redeploy.
- **`deviceId`** — with more than one phone, pin it to `"ev2jZcN38E8O0zkWjHpfz"` so a spare does not send from its own SIM.

Defaults live in `DEFAULT_SMS_CONFIG` (`functions/src/sms.ts`). A malformed value (a typo, a string where a number belongs) falls back to the default rather than widening a cap.

### 3. Prove it in one tap

1. **My Account & Profile** → set a real `+63` mobile number (the demo placeholders are US numbers and are correctly rejected).
2. **Host overview → SMS Gateway → Send test SMS to my number.** One real SMS, to yourself only. If it does not arrive, the SIM has no load or the gateway app is stopped — the card shows both.
3. Then send a **RED** alert: push instantly, SMS right after (`dryRun: true` first if you want to see the recipients without spending load).

### 4. Where the results are recorded

| Path | Contents |
| :--- | :--- |
| `alerts/{alertId}.smsSummary` | `sent` / `failed` / `skipped` / `batches` totals for the whole broadcast |
| `alerts/{alertId}/smsRecipients/{uid}` | One document per member: `status` + `reason` (`duplicate`, `opt_out`, `no_phone`, `not_ph_mobile`, `capped`, `daily_cap`, `provider_error`) |
| `alerts/{alertId}/smsBatches/{batchId}` | `providerMessageId` + the numbers in that batch — the mapping a delivery webhook needs |
| `system/smsDaily` | `{ date, sent }` — what the daily cap is spent against |
| `system/gatewayHealth` | The 5-minute readiness heartbeat |

### 5. Stopping it

- **Pause everything:** `config/sms` → `"enabled": false`. This also blocks the test button, because a kill switch that has exceptions is not a kill switch.
- **Stop sending but keep the audit trail:** `"dryRun": true`.
- **Nothing is ever retried automatically**, so there is no retry storm to stop.
