// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',
  /**
   * This should match the directory where your web assets are built
   * for the mobile app bundle. If your Vite build for the app outputs
   * somewhere else, update this to that folder.
   */
  webDir: 'dist',

  server: {
    androidScheme: 'https'
  },

  ios: {
    /**
     * Important:
     * This becomes CFBundleVersion in the iOS app.
     * It must be strictly greater than the last version in App Store Connect.
     *
     * Previous max = 55, so set this higher.
     */
    buildNumber: '56'
  }
};

export default config;
