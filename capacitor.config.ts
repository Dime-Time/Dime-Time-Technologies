import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',
  webDir: 'dist',
  bundledWebRuntime: false,

  ios: {
    // IMPORTANT: This must always be strictly higher than the last build
    // that successfully uploaded to App Store Connect.
    buildNumber: '58',
  },

  server: {
    // Your production backend
    url: 'https://dime-time.com',
    cleartext: false,
  },
};

export default config;
