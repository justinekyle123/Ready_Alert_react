<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/de20df8c-54e7-4bd3-9b13-17c47fd29c17

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase & Push Notifications

This project ships connected to an AI Studio–provisioned Firebase project. To use **your own** Firebase account (required if you want push notifications delivered from your own sender ID), follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) — it lists every key location, how to generate your VAPID key, how to add `google-services.json` and the APNs key, and how to add the backend sender that FCM needs.

Native push is wired through `@capacitor/push-notifications` (`src/utils/nativePush.ts`), so Android/iOS builds can receive alerts while the app is closed.
