// client/main.tsx or src/main.tsx (your entry point)

import React from "react";
import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import App from "./App";
import "./index.css";

// Initialize Sentry as early as possible so the SDK can catch errors thrown
// during module evaluation. No-op when VITE_SENTRY_DSN is unset.
initSentry();

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
