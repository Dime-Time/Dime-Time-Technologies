/**
 * Regression guard for honest auth error messages.
 *
 * Login, Signup, ForgotPassword, and ResetPassword must show:
 *   - a 429 response  → "Too many attempts — please wait a few minutes and try again."
 *   - a fetch failure → "Connection problem — please check your internet and try again."
 * and must still surface normal 4xx server validation messages unchanged.
 *
 * A refactor or design-subagent restyle that reverts to generic
 * "Invalid email or password" for rate limits / outages fails here.
 *
 * Runs under `tsx --test` using happy-dom for a real DOM, a mocked global
 * fetch, and real form interactions (typing + submit).
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { register as registerModuleHook } from "node:module";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Stub Vite-only `@assets/...` imports (logo images) so pages load under tsx.
registerModuleHook(new URL("./asset-stub-loader.mjs", import.meta.url));

GlobalRegistrator.register({ url: "https://dime-time.test/" });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import * as React from "react";
// tsx compiles the app's .tsx files with the classic JSX transform, so React
// must be global BEFORE the page components are loaded.
(globalThis as Record<string, unknown>).React = React;

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { useToast } = await import("../../hooks/use-toast");

const { default: Login } = await import("../Login");
const { default: Signup } = await import("../signup");
const { default: ForgotPassword } = await import("../ForgotPassword");
const { default: ResetPassword } = await import("../ResetPassword");

const RATE_LIMIT_MSG = "Too many attempts — please wait a few minutes and try again.";
const NETWORK_MSG = "Connection problem — please check your internet and try again.";

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
  GlobalRegistrator.unregister();
});

// ---------- fetch mocks ----------

function mockFetchStatus(status: number, body: Record<string, unknown> = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

function mockFetchNetworkFailure() {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
}

// ---------- toast capture (ForgotPassword / ResetPassword report via toast) ----------

const capturedToasts: Array<{ title?: unknown; description?: unknown }> = [];
function ToastProbe() {
  const { toasts } = useToast();
  React.useEffect(() => {
    for (const t of toasts) {
      capturedToasts.push({ title: t.title, description: t.description });
    }
  }, [toasts]);
  return null;
}

function lastToastDescription(): string {
  const last = capturedToasts[capturedToasts.length - 1];
  return String(last?.description ?? "");
}

// ---------- DOM helpers ----------

let container: HTMLElement;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  capturedToasts.length = 0;
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  window.history.replaceState({}, "", "/");
});

async function renderPage(Page: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  root = createRoot(container);
  await act(async () => {
    root!.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Page),
        React.createElement(ToastProbe),
      ),
    );
  });
}

const inputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
)!.set!;

function typeInto(testId: string, value: string) {
  const input = container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | null;
  assert.ok(input, `input [data-testid=${testId}] not found`);
  act(() => {
    inputValueSetter.call(input!, value);
    input!.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

async function submitForm() {
  const form = container.querySelector("form");
  assert.ok(form, "form not found");
  await act(async () => {
    form!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    // let the mutation promise chain settle
    await new Promise((r) => setTimeout(r, 20));
  });
}

function visibleError(testId: string): string {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(el, `error element [data-testid=${testId}] not rendered`);
  return el!.textContent ?? "";
}

// ---------- Login ----------

async function submitLogin() {
  await renderPage(Login);
  typeInto("input-email", "user@example.com");
  typeInto("input-password", "password123");
  await submitForm();
}

test("Login: 429 shows the rate-limit message", async () => {
  mockFetchStatus(429);
  await submitLogin();
  assert.equal(visibleError("text-login-error"), RATE_LIMIT_MSG);
});

test("Login: network failure shows the connection message", async () => {
  mockFetchNetworkFailure();
  await submitLogin();
  assert.equal(visibleError("text-login-error"), NETWORK_MSG);
});

test("Login: 401 still shows invalid-credentials message", async () => {
  mockFetchStatus(401, { message: "Invalid email or password" });
  await submitLogin();
  assert.equal(visibleError("text-login-error"), "Invalid email or password. Please try again.");
});

// ---------- Signup ----------

async function submitSignup() {
  await renderPage(Signup);
  typeInto("input-firstname", "Pat");
  typeInto("input-lastname", "Doe");
  typeInto("input-email", "user@example.com");
  typeInto("input-password", "password123");
  await submitForm();
}

test("Signup: 429 shows the rate-limit message", async () => {
  mockFetchStatus(429);
  await submitSignup();
  assert.equal(visibleError("text-signup-error"), RATE_LIMIT_MSG);
});

test("Signup: network failure shows the connection message", async () => {
  mockFetchNetworkFailure();
  await submitSignup();
  assert.equal(visibleError("text-signup-error"), NETWORK_MSG);
});

test("Signup: 4xx server validation message surfaces unchanged", async () => {
  mockFetchStatus(400, { message: "An account with this email already exists" });
  await submitSignup();
  assert.equal(visibleError("text-signup-error"), "An account with this email already exists");
});

// ---------- ForgotPassword (errors surface via toast) ----------

async function submitForgotPassword() {
  await renderPage(ForgotPassword);
  typeInto("input-email", "user@example.com");
  await submitForm();
}

test("ForgotPassword: 429 shows the rate-limit message", async () => {
  mockFetchStatus(429);
  await submitForgotPassword();
  assert.equal(lastToastDescription(), RATE_LIMIT_MSG);
});

test("ForgotPassword: network failure shows the connection message", async () => {
  mockFetchNetworkFailure();
  await submitForgotPassword();
  assert.equal(lastToastDescription(), NETWORK_MSG);
});

test("ForgotPassword: 4xx server validation message surfaces unchanged", async () => {
  mockFetchStatus(400, { message: "Please enter a valid email address" });
  await submitForgotPassword();
  assert.equal(lastToastDescription(), "Please enter a valid email address");
});

// ---------- ResetPassword (errors surface via toast; needs ?token=) ----------

async function submitResetPassword() {
  window.history.replaceState({}, "", "/reset-password?token=test-token-123");
  await renderPage(ResetPassword);
  typeInto("input-new-password", "newpassword123");
  typeInto("input-confirm-password", "newpassword123");
  await submitForm();
}

test("ResetPassword: 429 shows the rate-limit message", async () => {
  mockFetchStatus(429);
  await submitResetPassword();
  assert.equal(lastToastDescription(), RATE_LIMIT_MSG);
});

test("ResetPassword: network failure shows the connection message", async () => {
  mockFetchNetworkFailure();
  await submitResetPassword();
  assert.equal(lastToastDescription(), NETWORK_MSG);
});

test("ResetPassword: 4xx server validation message surfaces unchanged", async () => {
  mockFetchStatus(400, { message: "This reset link has expired" });
  await submitResetPassword();
  assert.equal(lastToastDescription(), "This reset link has expired");
});
