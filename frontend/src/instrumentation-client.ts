// Browser errors -> Sentry (project gamexs-frontend). The SDK is ~60 KB gzip,
// so it is not in the initial bundle: two tiny listeners queue errors and the
// SDK is downloaded only when the first one happens; once loaded, Sentry's
// own handlers take over. Errors only: no tracing, no replay. The DSN is
// public by design (it only allows sending events).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const queued: unknown[] = [];
  let loaded = false;
  let loading: Promise<void> | null = null;

  const report = (error: unknown) => {
    if (loaded || error == null) return;
    queued.push(error);
    loading ??= import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({ dsn, environment: process.env.NODE_ENV, sendDefaultPii: false, tracesSampleRate: 0 });
      loaded = true;
      for (const e of queued.splice(0)) Sentry.captureException(e);
    });
  };

  window.addEventListener("error", (event) => report(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => report(event.reason));
}
