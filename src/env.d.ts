// src/env.d.ts
// Build-time constants injected by Vite (see the `define` block in vite.config.ts).
// `export {}` keeps this file a module under tsconfig's `moduleDetection: "force"`,
// which is required for `declare global` to augment the global scope.

declare global {
  /**
   * Whether `android/app/google-services.json` existed when this bundle was built.
   *
   * Without that file the Google Services Gradle plugin is not applied, so no
   * FirebaseApp exists on Android and the push plugin's `register()` throws natively
   * (IllegalStateException on the main thread), killing the app. `undefined` means the
   * constant was not injected at all (e.g. a non-Vite bundler) — treated as configured.
   */
  const __ANDROID_FIREBASE_CONFIGURED__: boolean | undefined;
}

export {};
