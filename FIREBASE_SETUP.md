# Firebase & API Keys Setup Guide (FIREBASE_SETUP.md)

Everything you need to know about **where the keys live** in this project and how to **replace the current Firebase account with your own**, so that push notifications (FCM) belong to your account and work on your devices.

---

## 1. TL;DR — Where every key/config is

| What | Where it lives | Used by |
| :--- | :--- | :--- |
| Firebase project config (apiKey, projectId, appId, authDomain, messagingSenderId, firestoreDatabaseId, storageBucket, oAuthClientId) | `firebase-applet-config.json` (project root) | `src/config/firebase.ts`, `public/firebase-messaging-sw.js` |
| FCM Web Push VAPID key | `.env.local` → `VITE_FIREBASE_VAPID_KEY` (template in `.env.example`) | `src/utils/notification.ts` |
| Gemini API key | `.env.local` → `GEMINI_API_KEY` (template in `.env.example`) | AI Studio runtime secrets (no Gemini call in `src/` yet) |
| App URL | `.env.local` → `APP_URL` | AI Studio runtime |
| Android native FCM config | `android/app/google-services.json` (**missing — you must add this**) | `android/app/build.gradle` (auto-applies `com.google.gms.google-services` when present) |
| iOS native FCM config | `ios/App/App/GoogleService-Info.plist` — **optional**, the Capacitor plugin uses APNs directly | Only if you adopt the Firebase iOS SDK |
| FCM service worker | `public/firebase-messaging-sw.js` | Browser background/closed-app push |
| Native push module (Android/iOS) | `src/utils/nativePush.ts` + `@capacitor/push-notifications` | Native FCM (Android) / APNs (iOS) tokens, Android notification channel |
| FCM sender (server side) | `functions/src/index.ts` + `firebase.json` | Firebase Cloud Functions — pushes to every saved `fcmToken` |
| Firestore security rules | `firestore.rules` | Firestore |
| Database schema / entities | `firebase-blueprint.json`, `schema.md` | Reference docs |

> **`.env.local` does not exist yet.** Vite ignores `.env*` files in git (see `.gitignore`), so create it locally from `.env.example`.

---

## 2. The problem with the current setup

The app is currently wired to an **AI Studio–provisioned Firebase project**, not yours:

```
projectId:                ninth-theme-vjkjx
firestoreDatabaseId:      ai-studio-readyalert-de20df8c-54e7-4bd3-9b13-17c47fd29c17
messagingSenderId:        1078242048412
```

Because the sender ID and VAPID key belong to that project, **you can never deliver push notifications from your account** — FCM only allows sending from the project that owns the registration token. You must:

1. Create your own Firebase project.
2. Point `firebase-applet-config.json` at it.
3. Generate your own VAPID key and put it in `.env.local`.
4. Add `google-services.json` for the Android build (§4). iOS needs an APNs key uploaded to Firebase instead (§5).
5. Deploy the **sender** Cloud Function to *your* project — it already exists in `functions/` (§6).

---

## 3. Step-by-step: connect your own Firebase project (Web)

### Step 1 — Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it (e.g. `ready-alert-prod`) and finish the wizard.

### Step 2 — Register a Web App and copy the config
1. In the project, click the **Web** icon (`</>`) → register an app (e.g. `ready-alert-web`).
2. Copy the `firebaseConfig` values into **`firebase-applet-config.json`**, keeping the existing key names:

```json
{
  "projectId": "YOUR_PROJECT_ID",
  "appId": "1:YOUR_SENDER_ID:web:YOUR_APP_HASH",
  "apiKey": "YOUR_WEB_API_KEY",
  "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "YOUR_PROJECT_ID.firebasestorage.app",
  "messagingSenderId": "YOUR_SENDER_ID",
  "measurementId": "",
  "oAuthClientId": "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "recaptchaSiteKey": ""
}
```

**Field mapping notes**

* `firestoreDatabaseId` — set it to `"(default)"` if you create the standard `(default)` Firestore database. `src/config/firebase.ts` treats `"(default)"` as "use the default DB", so both work.
* `authDomain` — usually `<projectId>.firebaseapp.com`.
* `oAuthClientId` / `recaptchaSiteKey` — only needed if you use Google sign-in / reCAPTCHA. Leave `""` otherwise.

> `apiKey` here is **not a secret** — it identifies your project to Google and is safe to ship to browsers. Never put the Admin SDK service account (Step 8) in this file.

### Step 3 — Enable Authentication
In **Build → Authentication → Sign-in method**, enable **Email/Password**.

The app has a Firestore-only fallback in `src/services/authService.ts` (it can log users in straight from the `users` collection), but a **real Firebase Auth UID is required for FCM** — tokens are stored at `users/{uid}`, so use real accounts.

### Step 4 — Create Firestore and deploy rules
1. **Build → Firestore Database → Create database**.
2. Deploy the existing rules:
```bash
firebase deploy --only firestore:rules
```

### Step 5 — Generate your VAPID key (this is the one that unlocks Web Push)
1. **Project settings → Cloud Messaging** tab.
2. Under **Web Push certificates**, click **Generate key pair**.
3. Create `.env.local` in the project root:

```bash
# .env.local
VITE_FIREBASE_VAPID_KEY="BEl...your_public_vapid_key..."
```

Do **not** commit this file (already git-ignored, except `.env.example`).

### Step 6 — Restart the dev server / rebuild
Vite inlines `VITE_*` variables at build time, so `.env.local` changes need a restart:

```bash
npm run dev      # local development
npm run build    # production build — re-run after ANY config/key change
```

### Step 7 — Re-seed the demo data
Your new Firestore is empty. On app boot, `seedDemoAccounts()` (in `src/services/authService.ts`) recreates the demo users and `GRP-001`, so the demo logins in `schema.md` keep working. For real accounts, use the Host dashboard's **Create System User** flow.

---

## 4. Android (Capacitor) — `google-services.json`

Native FCM on Android needs a native Firebase config file, **not** just the JSON in `firebase-applet-config.json`.

1. In Firebase console → **Project settings → Add app → Android**.
   * **Android package name** must match `appId` in `capacitor.config.ts` (currently `com.example.app`).
   * ⚠️ `com.example.app` is a placeholder. Pick your real reverse-DNS ID (e.g. `ph.readyalert.app`) and change **both** `capacitor.config.ts` and `android/app/build.gradle` (`namespace` + `applicationId`) before building a release. Google Play rejects `com.example.*`.
2. Download **`google-services.json`** and place it at:

```
android/app/google-services.json
```

3. No Gradle edits needed — `android/app/build.gradle` already does this:

```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

The Google Services plugin classpath is already declared in `android/build.gradle` (`com.google.gms:google-services:4.4.4`).

4. Sync and rebuild:

```bash
npm run build
npx cap sync android     # already run in this repo — re-run after installing plugins or editing capacitor.config.ts
npx cap open android     # then Run / Build APK in Android Studio
```

### Android plumbing already done for you

`@capacitor/push-notifications@8.1.2` is installed and registered natively. `npx cap sync` generated:

```
android/capacitor.settings.gradle      → include ':capacitor-push-notifications'
android/app/capacitor.build.gradle     → implementation project(':capacitor-push-notifications')
```

`android/app/src/main/AndroidManifest.xml` declares the runtime permissions the plugin needs (it does **not** add them itself):

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />  <!-- Android 13+ -->
<uses-permission android:name="android.permission.VIBRATE" />
```

A dedicated high-importance notification channel is used so emergency alerts arrive as heads-up notifications even in Doze-friendly conditions:

```xml
<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id"
           android:value="@string/default_notification_channel_id" />
```

The channel itself (`readyalert_emergency`) is created at runtime in `src/utils/nativePush.ts` via `PushNotifications.createChannel()` — the manifest id and the `EMERGENCY_CHANNEL_ID` constant must stay in sync (`android/app/src/main/res/values/strings.xml`).

5. Send the sender-side messages with **Android priority high** so they wake the device (see §6).

---

## 5. iOS — APNs (+ optional `GoogleService-Info.plist`)

**The Capacitor plugin talks to APNs directly**, so `GoogleService-Info.plist` is **not required** for the plugin path (you only need it if you use the Firebase iOS SDK directly). What iOS actually needs:

1. **Project settings → Add app → iOS** in Firebase with a bundle ID matching the Xcode target (`ios/App`).
2. In Apple Developer → **Keys**, create an **APNs Auth Key (.p8)** and upload it in Firebase console → **Project settings → Cloud Messaging → Apple app configuration**. This is what lets Firebase deliver to iOS devices.
3. In Xcode, on the App target → **Signing & Capabilities**, add:
   * **Push Notifications**
   * **Background Modes → Remote notifications**
4. `ios/App/App/AppDelegate.swift` already forwards the APNs token to the plugin:

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}

func application(_ application: UIApplication,
                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

Without those two methods the plugin rejects with *"event capacitorDidRegisterForRemoteNotifications not called"*.

5. `npx cap sync ios` (already run — it added the plugin to `ios/App/CapApp-SPM/Package.swift`) and run on a **real device** (push does not work in the iOS Simulator).

---

## 6. How an alert actually reaches a closed phone

Right now this repo has **no backend sender** (there is no `server.js`/Express app and no `firebase-admin` dependency). What exists:

| Path | Works when | Where |
| :--- | :--- | :--- |
| Firestore `onSnapshot` listener → local notification + siren | App is **open** | `src/hooks/useActiveAlert.ts` |
| `onMessage` foreground FCM handler (web) | App is **open (browser)** | `src/utils/notification.ts` |
| `firebase-messaging-sw.js` background handler | Browser tab in background | `public/firebase-messaging-sw.js` |
| `pushNotificationReceived` foreground handler (native) | App is **open (Android/iOS)** | `src/utils/nativePush.ts` |
| FCM/APNs push drawn by the OS | App **closed / killed** (Android & iOS) | Native notification shade |
| **Sender** — `sendAlertPush` Cloud Function | always, once deployed | `functions/src/index.ts` |

Both halves are now implemented: devices register a token in `users/{uid}.fcmToken`, and `functions/src/index.ts` pushes to those tokens whenever an `alerts` document is created. Sending needs a **service account**, which is exactly why it lives on Cloud Functions and never in the client bundle.

### The sender: `functions/src/index.ts`

TypeScript, Node 22 runtime, wired through `firebase.json`. What it does on every new `alerts/{alertId}` document:

| Behaviour | Detail |
| :--- | :--- |
| Ignores inactive alerts | Skips documents where `active === false`, matching the client's `useActiveAlert` filter |
| Scopes the audience | `GLOBAL_ALL` (or missing) → every user; otherwise only users whose `groupId` matches — same rule the client applies |
| Deduplicates tokens | One shared phone with several profiles receives the push once |
| Batches | Chunks into 500-token calls (FCM's multicast limit) |
| Covers web + Android + iOS in one call | `notification` + `data` payload with per-platform blocks: `android` (high priority, `readyalert_emergency` channel), `apns` (`apns-priority: 10`), `webpush` (`Urgency: high`) |
| Prunes dead tokens | Removes `fcmToken` from profiles whose token FCM reports as unregistered/invalid — but only if it is still the token on file |

> The `notification` block is what makes delivery work while an app is **closed** on all three platforms. The `data` block drives the in-app siren/vibration handlers and the alert banner.
>
> **Intentional redundancy:** while an app is *open*, both this push and the client-side Firestore listener (`useActiveAlert.ts`) react to the same alert document, so the siren may sound twice in quick succession. That is deliberate for an emergency alarm — if you would rather hear it once, gate `sendPushNotification()` in the `onSnapshot` handler on `document.visibilityState === 'hidden'`.

**Configure the region before deploying.** `REGION` at the top of the file must match your Firestore location or the deploy is rejected:

```ts
// functions/src/index.ts
const REGION = 'us-central1';   // e.g. 'asia-southeast1' for the Philippines
```

**Deploy:**

```bash
npm --prefix functions install     # once
firebase login
firebase use --add                 # pick YOUR project (creates .firebaserc)
firebase deploy --only functions   # builds via predeploy, then uploads
firebase deploy --only firestore:rules
```

> ⚠️ **Cloud Functions requires the Blaze (pay-as-you-go) plan**, which needs a billing account / card on file. Per Firebase's pricing docs, "Access to Cloud Functions" is a Blaze-only feature — **Cloud Messaging (FCM) itself is a no-cost product available on Spark**. So without Blaze you can still test push delivery manually (see §11, Path A); only the automatic sender needs Blaze. The free allowance (2M invocations/month) covers this app many times over — set a budget alert if you enable Blaze.

`firebase.json` runs `npm --prefix "$RESOURCE_DIR" run build` automatically before upload, so the compiled `functions/lib` is always current. First-time deploy prompts to enable the Cloud Functions, Cloud Build and Artifact Registry APIs — accept.

Alternative: any server (Express, Cloud Run) using the **FCM HTTP v1 API** with a service account JSON kept in server-side env vars only.

---

## 7. Token registration — what the app does now

Everything is dispatched from `src/utils/notification.ts`, which routes to the right SDK per platform:

**Web (browser):**

1. `initNotificationService()` registers `/sw.js`, attaches the foreground FCM listener, and **auto-refreshes the FCM token on boot** if permission was already granted.
2. `requestNotificationPermission()` requests permission, then **saves the device's FCM token** to `users/{uid}` (`fcmToken`, `fcmUpdatedAt`).
3. `registerFcmToken()` warns clearly if `VITE_FIREBASE_VAPID_KEY` is missing, since `getToken()` cannot succeed without it.

**Native (Android / iOS)** — via `src/utils/nativePush.ts`:

1. `initNativePush(uid)` checks the **OS** permission (`PushNotifications.checkPermissions()`), creates the Android emergency channel, attaches the `registration` / `registrationError` / `pushNotificationReceived` / `pushNotificationActionPerformed` listeners, then calls `PushNotifications.register()`.
2. The `registration` event writes the token to `users/{uid}` as `fcmToken` **plus `fcmPlatform`** (`android` / `ios`), so the sender knows which transport to use.
3. On boot the token is silently re-registered when permission was already granted (`prompt: false` — no surprise dialogs); permission is only requested from the **Push Notifications** button or the first-run modal (`prompt: true`).
4. Foreground pushes are passed to `sendPushNotification()`, so the in-app siren + vibration still fire while the app is open.
5. **Sign-out calls `clearFcmToken()`** so a shared phone stops receiving the previous user's alerts.

⚠️ **Auto-registration caveat (web only):** without `VITE_FIREBASE_VAPID_KEY` the console shows:

```
Missing VAPID key: set VITE_FIREBASE_VAPID_KEY in .env.local to enable FCM web push...
```

That's expected until Step 5 of §3 is done. On native builds the VAPID key is irrelevant — APNs/FCM tokens are used instead.

---

## 8. Verifying it works

**Config is actually yours**
```bash
grep projectId firebase-applet-config.json     # your new project id
```
Open DevTools → Console → register for notifications, then check for `FCM Registration Token generated:`.

**Token reached Firestore**
Firebase console → Firestore → `users` → your user doc → confirm an `fcmToken` field exists.

**Delivery**
1. Send a test from Firebase console → **Messaging → Send test message**, pasting a token from above (works for both `fcmToken`s).
2. Or create an `alerts` doc with `active: true` and confirm the push arrives with the app closed.
3. Foreground path (web): DevTools → Application → Service Workers → `firebase-messaging-sw.js` must be **activated**.

**Native builds**
1. `npm run build && npx cap sync`, then install on a **real device** (iOS push never works in the Simulator).
2. Tap **Push Notifications** in the avatar dropdown → the OS permission dialog must appear (first time only).
3. Console should log `Native push registration token:` followed by `Native push: android token saved to users/…`.
4. Check the token field has a matching `fcmPlatform`: `android` or `ios`.
5. Android only: Settings → Apps → Ready Alert → Notifications → the **Emergency Alerts** channel should exist with High importance.
6. Kill the app completely and send a test message — it must appear in the notification shade.

**The sender (Cloud Function)**
1. `firebase functions:log` right after a deploy — a created alert should log `Alert <id> (RED / GLOBAL_ALL) → N delivered, M failed out of K device(s).`
2. To test without the UI: create a document in the `alerts` collection from the Firebase console with `active: true`, `alertLevel: "RED"`, and a `message` — every registered device should receive it.
3. Emulator run: `npm --prefix functions run serve` (loads the Firestore + Functions emulators).
4. If it logs `No registered device for scope "..."`, no profile in that group has an `fcmToken` yet — enable push on a device first.

---

## 9. Troubleshooting

| Symptom | Cause / Fix |
| :--- | :--- |
| `Messaging is not supported` warning | Browser/WebView lacks FCM support (or the app is in a preview iframe). Open in a real tab / real Chrome / HTTPS. |
| `Missing VAPID key` | Set `VITE_FIREBASE_VAPID_KEY` in `.env.local` and restart `npm run dev`. |
| `getToken` throws `permission-blocked` | User denied permission. Reset via the lock icon → Notifications → Allow. |
| Token registers but no push arrives | No sender exists yet (§6), **or** the token belongs to the *old* project. Clear the `fcmToken` field and re-register after switching projects. |
| Android build says "Push Notifications won't work" | `android/app/google-services.json` missing or its package name doesn't match `appId`. |
| iOS build fails on push capability | Push Notifications capability not enabled on the Xcode target, or the APNs `.p8` key was never uploaded to Firebase. |
| Permission popup never appears | Inside a preview iframe browsers block it — click **Open in New Tab ↗️**. |
| `Failed to load module script: ... MIME type of "application/json"` | Something is serving raw JSON at `/firebase-applet-config.json` for the app's `import` too. Vite fetches that path **with `?import`** as a JS module — the dev middleware in `vite.config.ts` must answer only the bare path (`query === undefined`). Restart the dev server after editing that file. |
| `updateDoc` fails when saving the token | The `users/{uid}` doc doesn't exist (Firestore-only fallback login). Log in with a real Firebase Auth account. |
| Native: `event capacitorDidRegisterForRemoteNotifications not called` | The two APNs delegate methods are missing from `AppDelegate.swift` (see §5) or the Push Notifications capability is off. |
| Native: no permission dialog appears | Android 13+ without `POST_NOTIFICATIONS` in `AndroidManifest.xml`, or permission was already denied — re-enable it in device Settings. |
| Native: token logged but no notification | No sender yet (§6). Also confirm Android messages are sent with priority `high` (`android: { priority: 'high' }`). |
| Native: alerts stop after signing out | Expected — `clearFcmToken()` detaches the device. Tap **Push Notifications** again to re-register. |
| Deploy fails: "Cannot create trigger ... region" | `REGION` in `functions/src/index.ts` doesn't match your Firestore database location. |
| Deploy fails: Node runtime unsupported | `functions/package.json` pins Node 22 (required by `firebase-admin` v14). Update your `firebase-tools` version. |
| Function logs `No registered device for scope` | No user in scope has an `fcmToken` — the client never granted permission, or you switched Firebase projects and the old tokens are stale. |
| Function logs failures but no cleanup | Only `registration-token-not-registered`, `invalid-registration-token` and `invalid-argument` are treated as dead tokens; other errors are left for you to inspect. |

---

## 10. Security & hygiene

* **Safe to commit:** `firebase-applet-config.json`, VAPID public key, `google-services.json`, `GoogleService-Info.plist`. They are project identifiers, not credentials.
* **Never commit:** `.env.local`, Admin SDK / service-account JSON, APNs `.p8`. `.gitignore` already excludes `.env*` (keeping `.env.example`).
* Restrict who can write `alerts` and `users` via `firestore.rules`, since the client can write directly to Firestore.
* If you keep the AI Studio project alongside your own, expect **two separate** user/token stores — tokens are not portable between projects.

---

## 11. Android test runbook (real device, first push)

Follow this in order. Each phase ends with something you can actually see, so a failure is easy to localize.

### Phase 1 — Firebase console (laptop, ~10 minutes)

1. <https://console.firebase.google.com> → **Create project** (e.g. `ready-alert`). Analytics optional.
2. **Add the Android app:** Project settings → General → *Your apps* → Android icon.
   * **Android package name:** `com.example.app` — it must match `applicationId` in `android/app/build.gradle` exactly. (`com.example.app` is fine for testing; rename it before publishing to Play.)
   * Register the app → **download `google-services.json`** → save it to `android/app/google-services.json`.
3. **Add a Web app too — this is required.** The Capacitor app runs your Vite bundle, so Firestore/Auth use the *web* config even on the phone: *Your apps* → Web `</>` → register → copy the whole `firebaseConfig` object.
4. **Authentication** → Get started → Email/Password → **Enable**. (Without it the app falls back to the Firestore-only login path.)
5. **Firestore Database** → Create database → **pick a location and write it down** — it must match `REGION` in `functions/src/index.ts`.
6. **Cloud Messaging** tab → *Web Push certificates* → **Generate key pair** → copy the key (needed for web, harmless to have now).
7. iOS/APNs can wait (§5).

### Phase 2 — fill in the three config locations

| Value from the console | Goes into |
| :--- | :--- |
| Web `firebaseConfig` object | `firebase-applet-config.json` |
| Web Push certificate key | `.env.local` → `VITE_FIREBASE_VAPID_KEY` |
| Firestore location | `REGION` in `functions/src/index.ts` |
| `google-services.json` (download) | `android/app/google-services.json` |

### Phase 3 — build and install the APK

```bash
npm run build
npx cap sync android
```

Then either open Android Studio and press **Run** (`npx cap open android`), or build from the CLI:

```bash
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Phase 4 — register the device on the phone

1. Open the app and **sign in** (use the demo accounts from `schema.md`, or create a user from the Host dashboard).
2. Tap the avatar → **Push Notifications** → allow the system prompt.
3. Open the avatar → **My Account & Profile** → scroll to **Push Diagnostics**.
4. Every row must be green, especially **Device token saved: yes** with **Token platform: android**.

If a row is red, that row *is* the problem:

| Red row | Meaning |
| :--- | :--- |
| Firebase project | `firebase-applet-config.json` still points at the AI Studio project |
| Permission | OS-level block — Settings → Apps → Ready Alert → Notifications |
| Device token saved | Registration failed: `google-services.json` missing/mismatched package name, or not signed in |
| Token platform | Token was saved by web, not native — you are running the browser build, not the APK |

### Phase 5 — test delivery

**Path A — Spark plan (no card needed).** Proves the token + FCM + closed-app rendering.

1. In the diagnostics panel tap **Copy** to copy the FCM token.
2. On the laptop: Firebase console → **Messaging** → **Send test message** → paste the token → Send.
3. **Swipe the app away** on the phone first, then send. The alert must appear in the notification shade.

**Path B — Blaze plan (full automated flow).**

1. `firebase deploy --only functions` (from Phase 2 values).
2. On the laptop: Firestore → `alerts` → **Add document** with:
   * `alertLevel` (string) = `RED`
   * `message` (string) = `TEST - drop cover and hold`
   * `active` (boolean) = `true`
   * `groupId` (string) = `GLOBAL_ALL`
   * `timestamp` (string) = any ISO date
3. The phone must receive the push **with the app closed**.
4. Confirm the trigger fired: `firebase functions:log` should show `Alert <id> (RED / GLOBAL_ALL) → N delivered…`.

> The same document also makes the app show its in-app siren + banner when someone opens it — that part works without Blaze because it uses the Firestore listener, not push.

### Phase 6 — clean up the test

Deactivate the test alert so it does not stay on every dashboard:

* Firestore → `alerts` → open the document → set `active` to `false`.

---

## 12. Files you will touch for a full switch

```
firebase-applet-config.json     ← your Web app config (§3, Step 2)
.env.local                      ← VITE_FIREBASE_VAPID_KEY (§3, Step 5)
android/app/google-services.json← Android native config (§4)
firebase.json + functions/      ← FCM sender (§6) — set REGION, then deploy
capacitor.config.ts + android/app/build.gradle ← only if you change the Android app ID

// Already configured for native push in this repo:
src/utils/nativePush.ts                            ← native permission + token registration
src/utils/notification.ts                          ← platform router + clearFcmToken()
android/app/src/main/AndroidManifest.xml           ← POST_NOTIFICATIONS, VIBRATE, channel meta-data
android/app/src/main/res/values/strings.xml        ← default_notification_channel_id
ios/App/App/AppDelegate.swift                      ← APNs delegate forwarding
ios/App/CapApp-SPM/Package.swift                   ← plugin registration (generated)
```
