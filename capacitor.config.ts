import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dimetime.mobile',
  appName: 'Dime Time',

  /**
   * Must match your built frontend output folder for Capacitor.
   *
   * Right now your Vite build outputs into "dist" (with assets under
   * dist/public). Capacitor will copy whatever is under `webDir`
   * into ios/App/App/public when you run `npx cap sync ios`.
   *
   * Using "dist" here is correct for your current setup.
   */
  webDir: 'dist',

  bundledWebRuntime: false,

  ios: {
    /**
     * CFBundleVersion / buildNumber
     *
     * Apple is rejecting builds if the bundle version is not higher
     * than the previously uploaded one:
     *
     *   "The bundle version must be higher than the previously
     *    uploaded version: '57'."
     *
     * Here we set buildNumber to "60". Capacitor will write this
     * into Info.plist as CFBundleVersion when you run:
     *   - npm run build
     *   - npx cap sync ios
     * and then build the iOS project in Codemagic.
     *
     * If Apple ever rejects "60" as already used, bump this again
     * (to "61", "62", etc.), commit, push, and rebuild on Codemagic.
     */
    buildNumber: '60',
  },

  server: {
    /**
     * Production backend URL for the app.
     * This should be the same host your web app is deployed to.
     *
     * In your case this is your Replit autoscale app with the custom
     * domain wired in:
     *
     *   https://dime-time.com
     */
    url: 'https://dime-time.com',
    cleartext: false,
  },
};

export default config;
