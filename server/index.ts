// Sentry MUST be initialized before anything else so the Node SDK can install
// its global instrumentation hooks. The init shim is a tiny no-op when
// SENTRY_DSN is unset — the @sentry/node SDK itself is only imported (via
// dynamic import) when a DSN is configured.
import { initSentry, setupExpressErrorHandler as setupSentryExpressErrorHandler } from "./lib/sentry";
import { validateProductionSecrets } from "./lib/validateEnv";

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";

const app = express();

// Defense-in-depth: never serve source maps publicly, even if a future build
// step accidentally emits them into the static dir. Returns 404 before
// express.static gets a chance to read them off disk.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.endsWith(".map")) {
    return res.status(404).end();
  }
  next();
});

/**
 * Simple health check – kept first so it works even if other middleware misbehaves.
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

/**
 * CORS configuration
 *
 * - In production, allow:
 *   - Your main domain: https://dime-time.com and https://www.dime-time.com
 *   - Your public Replit domain (for web testing)
 *   - Capacitor / Ionic origins used by the native app shell
 *
 * - In development, allow localhost (browser) + Capacitor/Ionic.
 */
const allowedOriginsProd = [
  "https://dime-time.com",
  "https://www.dime-time.com",
  "https://dime-time-2sdmp44chp.replit.app",
  "https://dime-time-fintech-debt-reduction-app-bobbyhiddn.replit.app",
  "capacitor://localhost",
  "ionic://localhost",
];

const allowedOriginsDev = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const env = process.env.NODE_ENV || "development";
    const allowed = env === "production" ? allowedOriginsProd : allowedOriginsDev;

    // Allow non-browser requests (no Origin header) and anything from the allowed list.
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }

    // In development, also allow any Replit preview/dev subdomain
    if (env !== "production" && origin && origin.endsWith(".replit.dev")) {
      return callback(null, true);
    }

    console.warn("Blocked CORS origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Production security headers. CSP is intentionally omitted for now
// (Capacitor WebView + Stripe.js compatibility risk); these headers are
// safe for the SPA and API responses.
if (process.env.NODE_ENV === "production") {
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

// Capture raw body for Plaid webhook signature verification before JSON parsing.
// IMPORTANT: `/webhooks/stripe` is EXCLUDED — that route installs its own
// `express.raw({ type: "application/json" })` parser because Stripe's
// signature is computed over the exact raw bytes and consuming the stream
// here first (even to JSON.parse) corrupts verification.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/webhooks/') && req.path !== '/webhooks/stripe') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { data += chunk; });
    req.on('end', () => {
      (req as any).rawBody = data;
      try { req.body = JSON.parse(data); } catch { req.body = {}; }
      next();
    });
  } else {
    next();
  }
});

// `/webhooks/stripe` MUST receive the untouched raw body for Stripe's
// signature verification — the route registers its own
// `express.raw({ type: "application/json" })`. If the global JSON parser
// runs first it consumes the stream and `req.body` becomes an object,
// which makes `Stripe.webhooks.constructEvent` reject every request.
// Both global parsers below short-circuit for that single path; the
// route-level raw parser then populates `req.body` as a Buffer.
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: false });
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/webhooks/stripe') return next();
  return jsonParser(req, res, next);
});
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/webhooks/stripe') return next();
  return urlencodedParser(req, res, next);
});

/**
 * API logging middleware – capture JSON responses for /api/* calls.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          // ignore JSON stringify errors
        }
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize Sentry first. No-op when SENTRY_DSN is unset (the @sentry/node
    // SDK is not even imported in that case).
    await initSentry();

    // Fail fast in production if required secrets are missing — better to
    // refuse to boot than to accept money-movement requests that will throw
    // (or, worse, silently misbehave) at runtime. No-op outside production.
    validateProductionSecrets();

    console.log("Starting server...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Express env:", app.get("env"));

    /**
     * 1) Auth / sessions
     * Make sure auth is fully configured before routes.
     */
    console.log("Setting up auth...");
    await setupAuth(app);
    console.log("Auth setup complete");

    /**
     * 2) API routes
     */
    console.log("Registering routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered");

    /**
     * 3) Global error handler – catches thrown errors from routes/middleware
     */
    // Sentry's Express error handler is installed BEFORE our own handler so
    // 5xxs are captured. No-op when SENTRY_DSN is unset.
    setupSentryExpressErrorHandler(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;

      // Full details go to server logs (and Sentry) only. 5xx responses must
      // never leak internal error text (DB/provider messages) to clients.
      console.error("Unhandled error:", err);
      const message =
        status >= 500 ? "Internal Server Error" : err.message || "Request failed";
      res.status(status).json({ message });
    });

    /**
     * 4) Static hosting
     *
     * In development:
     *   - Use Vite dev server.
     *
     * In production:
     *   - Serve built SPA from server-dist/public
     *     (which you populate via `npm run build` and your package.json script:
     *      vite → dist/public → cp dist/public/* server-dist/public/)
     *   - Catch-all (*) returns index.html for client-side routing.
     */
    console.log("Checking environment for static file setup...");
    console.log("app.get('env'):", app.get("env"));
    console.log("process.cwd():", process.cwd());

    if (app.get("env") === "development") {
      console.log("Setting up Vite for development...");
      await setupVite(app, server);
    } else {
      const path = await import("path");
      const fs = await import("fs");

      // Final static directory for production SPA:
      const distPath = path.default.resolve(process.cwd(), "server-dist", "public");
      console.log("Production static path:", distPath);

      const indexHtmlPath = path.default.resolve(distPath, "index.html");

      if (fs.default.existsSync(indexHtmlPath)) {
        console.log("Found static files at:", distPath);

        // Serve static assets (JS, CSS, images, etc.)
        app.use(express.static(distPath));

        // SPA catch-all: let React handle all non-API routes
        app.use("*", (_req, res) => {
          res.sendFile(indexHtmlPath);
        });

        console.log("Static file serving configured.");
      } else {
        console.error("Static files not found at:", distPath);
        console.error("Falling back to serveStatic helper (./vite).");
        serveStatic(app);
      }
    }

    /**
     * 5) Start HTTP server
     *
     * Use the environment PORT (Replit / Codemagic / production) or default 5000.
     */
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
})();
