import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',
  webDir: 'dist',
  bundledWebRuntime: false,

  ios: {
    /**
     * IMPORTANT:
     * This MUST be strictly higher than the last CFBundleVersion
     * that successfully uploaded to App Store Connect.
     *
     * Last accepted was 57, so we are now using 58.
     */
    buildNumber: '58',
  },

  server: {
    /**
     * This is the URL your Capacitor iOS app points to in production.
     * It should match your deployed backend (Replit/autoscale).
     */
    url: 'https://dime-time.com',
    cleartext: false,
  },
};

export default config;
