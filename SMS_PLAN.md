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
| **1. Phone hygiene** | `normalizePhone()` + validation; `smsOptIn` in register / host-create-user / edit-user; reseed demo users with real `+63` numbers | ₱0 | Unit-verifiable, no sends |
| **2. Dry-run sender** | `functions/src/sms.ts` provider module (`sendSms(to[], body)`), wired into `sendAlertPush` **after** push, gated by `SMS_DRY_RUN=true` | ₱0 | Logs exact recipients + message, sends nothing |
| **3. Real sends** | Flip dry-run off; batch in chunks (start ~10) honouring the gateway rate limit; record batches + recipients; retry only on 5xx/timeout | SIM load | One RED test alert reaches a small group |
| **4. Status & UI** | Webhook → update `smsRecipients` status; "SMS 18/20 sent" on the alert banner/history; SMS row in the existing `PushDiagnostics` panel | ₱0 | Delivered vs failed visible in-app |
| **5. Guardrails** | `config/sms` doc: master kill switch, which levels trigger SMS, max recipients per alert, daily cap; per-level toggle **without redeploy** | ₱0 | Kill switch verified |
| **6. Optional failover** | Swap in `Semaphore` as primary when the phone is unhealthy (health check via the client) | ₱0.56/text | — |

Phases 0–2 are entirely testable for ₱0 and are where the real work is. Don't start Phase 3 until Phase 0 passes.

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

The **gateway health check is implemented and verified** — the app can already tell you whether the phone is reachable. What is still blocked on you:

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
