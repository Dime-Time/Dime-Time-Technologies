import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";

const app = express();

// Simple health check - first route before any middleware
app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV, time: new Date().toISOString() });
});

// CORS configuration for security
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://dime-time.com', 'https://www.dime-time.com', 'https://dime-time-fintech-debt-reduction-app-bobbyhiddn.replit.app', 'capacitor://localhost', 'ionic://localhost'] 
    : ['http://localhost:5000', 'http://127.0.0.1:5000', 'capacitor://localhost', 'ionic://localhost'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(this, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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
    console.log("Starting server...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Express env:", app.get("env"));
    
    // Setup authentication before routes
    console.log("Setting up auth...");
    await setupAuth(app);
    console.log("Auth setup complete");
    
    console.log("Registering routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static HTML files before setting up Vite or catch-all routes
  app.use(express.static("public"));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log("Checking environment for static file setup...");
  console.log("app.get('env'):", app.get("env"));
  console.log("process.cwd():", process.cwd());
  
  if (app.get("env") === "development") {
    console.log("Setting up Vite for development...");
    await setupVite(app, server);
  } else {
    // Use process.cwd() for production - import.meta.dirname doesn't work in Replit autoscale
    const path = await import("path");
    const fs = await import("fs");
    // Vite outputs to dist/public/, so after copying we have server-dist/public/public/
    let distPath = path.default.resolve(process.cwd(), "server-dist", "public");
    // Check for nested public folder (from Vite's output structure)
    const nestedPath = path.default.resolve(distPath, "public");
    if (fs.default.existsSync(path.default.resolve(nestedPath, "index.html"))) {
      distPath = nestedPath;
    }
    console.log("Production static path:", distPath);
    
    if (fs.default.existsSync(distPath)) {
      console.log("Found static files at:", distPath);
      app.use(express.static(distPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.default.resolve(distPath, "index.html"));
      });
      console.log("Static file serving configured.");
    } else {
      console.error("Static files not found at:", distPath);
      // Fallback to serveStatic
      serveStatic(app);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
})();
