import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',
  webDir: 'dist',
  bundledWebRuntime: false,

  ios: {
    /**
     * IMPORTANT:
     * This must be strictly higher than the last CFBundleVersion
     * that successfully uploaded to App Store Connect.
     *
     * Last successful upload used 57, so set this to 58 now.
     */
    buildNumber: '58',
  },

  server: {
    // Your production backend URL
    url: 'https://dime-time.com',
    cleartext: false,
  },
};

export default config;
