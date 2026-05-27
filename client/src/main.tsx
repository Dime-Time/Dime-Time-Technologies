// client/main.tsx or src/main.tsx (your entry point)

import React from "react";
import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./index.css";

// Initialize Sentry as early as possible. When VITE_SENTRY_DSN is unset (the
// vite config sources it from the SENTRY_DSN secret at build time) the SDK
// is never imported — this is just a tiny shim. Fire-and-forget: the dynamic
// import resolves shortly after first paint.
void initSentry();

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element with id 'root' not found");
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
