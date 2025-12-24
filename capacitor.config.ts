import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',

  /**
   * This must match your built frontend output folder.
   * Vite builds into "dist" which is correct here.
   */
  webDir: 'dist',

  bundledWebRuntime: false,

  ios: {
    /**
     * CFBundleVersion / buildNumber
     *
     * IMPORTANT:
     * Apple is currently rejecting builds because the bundle version
     * is not higher than 57:
     *
     *   "The bundle version must be higher than the previously
     *    uploaded version: '57'."
     *
     * Here we set buildNumber to "58". This value is what Capacitor
     * uses for CFBundleVersion when you run `npx cap sync ios` and
     * then build the iOS project in Codemagic.
     *
     * If Apple ever rejects 58 as already used, bump this again
     * (to "59", "60", etc.), commit, push, and rebuild on Codemagic.
     */
    buildNumber: '58',
  },

  server: {
    /**
     * Production backend URL for the app.
     * This should match your deployed Replit/Autoscale endpoint.
     */
    url: 'https://dime-time.com',
    cleartext: false,
  },
};

export default config;
