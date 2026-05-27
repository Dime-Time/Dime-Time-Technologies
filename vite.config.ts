import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Sentry source-map upload is opt-in: only active in production builds AND
// when all three secrets are configured. Otherwise the plugin is omitted so
// dev/preview builds remain identical to today.
const sentryUploadEnabled =
  process.env.NODE_ENV === "production" &&
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

const sentryPlugins = sentryUploadEnabled
  ? [
      await import("@sentry/vite-plugin").then(({ sentryVitePlugin }) =>
        sentryVitePlugin({
          org: process.env.SENTRY_ORG!,
          project: process.env.SENTRY_PROJECT!,
          authToken: process.env.SENTRY_AUTH_TOKEN!,
          release: { name: process.env.SENTRY_RELEASE },
          // Delete the generated .map files after they're uploaded so the
          // production server never has them on disk to serve. The static
          // handler in server/index.ts also 404s `.map` requests as a second
          // layer of defense.
          sourcemaps: {
            filesToDeleteAfterUpload: ["**/*.map"],
          },
        }),
      ),
    ]
  : [];

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
    ...sentryPlugins,
  ],

  // The frontend lives in the /client directory
  root: path.resolve(import.meta.dirname, "client"),

  // ⭐ FIXED BUILD OUTPUT — works on Replit AND Codemagic
  build: {
    outDir: "../dist/public",    // <-- relative path ALWAYS works
    emptyOutDir: true,
    // Source maps are only generated when the Sentry upload pipeline is
    // active. The Sentry plugin deletes the .map files after upload, and
    // server/index.ts denies .map requests in case anything slips through.
    sourcemap: sentryUploadEnabled ? "hidden" : false,
  },

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
