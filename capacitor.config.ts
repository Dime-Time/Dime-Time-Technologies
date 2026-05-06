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
    buildNumber: '61',
  },

  server: {
    /**
     * IMPORTANT — DO NOT add `url` here.
     *
     * Setting `server.url` makes the native WebView load the ENTIRE
     * HTML/JS/CSS bundle from the network on every cold start. On
     * iOS TestFlight that produced a ~10 second blank/splash delay
     * before the React app could even begin mounting, because the
     * WebView had to download the whole Vite bundle on first launch.
     *
     * With no `url` set, Capacitor loads the JS that was bundled into
     * the IPA at build time (from `webDir` -> `ios/App/App/public/`),
     * so first paint happens in milliseconds.
     *
     * API calls still go to https://dime-time.com — that is handled
     * separately in `client/src/lib/queryClient.ts` via
     * `Capacitor.isNativePlatform()`, which prefixes every fetch with
     * the production host. This split (bundled UI + remote API) is
     * the standard Capacitor pattern.
     */
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
};

export default config;
