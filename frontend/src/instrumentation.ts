import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Node.js native fetch (undici) does not respect HTTPS_PROXY env vars.
  // Set a global ProxyAgent so all server-side fetch calls go through the proxy.
  if (process.env.HTTPS_PROXY) {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  }

  // Server errors -> sentry.hamravesh.com (project gamexs-frontend). Sentry's
  // own transport uses node:http and only reads lowercase https_proxy, so it
  // goes straight to the Iranian host, not through the foreign proxy.
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn, environment: process.env.SENTRY_ENVIRONMENT ?? "production", sendDefaultPii: false, tracesSampleRate: 0 });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
