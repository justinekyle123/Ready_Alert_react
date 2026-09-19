import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'readyalert',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      // Emergency alerts must stay visible even while the app is in the foreground
      presentationOptions: ['badge', 'sound', 'banner', 'list']
    }
  }
};

export default config;
