"use client";

import Link from "next/link";

// Root error boundary: catches failures in the root layout itself, which
// app/error.tsx cannot. Must render its own <html>/<body> and stay
// independent of providers that might have failed.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, background: "#020e24", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main id="main-content" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ maxWidth: 560, width: "100%", textAlign: "right" }}>
            <p style={{ margin: "0 0 1rem", fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700, color: "#bfdbfe" }}>500</p>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, margin: "0 0 1rem" }}>
              مشکلی در سایت پیش آمد
            </h1>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.9, color: "#dbeafe", margin: "0 0 1rem" }}>
              خطا می‌تواند موقت باشد. دوباره تلاش کنید؛ اگر ادامه یافت، کمی بعد بازگردید.
            </p>
            {error.digest && (
              <p dir="ltr" style={{ margin: "0 0 1.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#93c5fd" }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{
                  cursor: "pointer",
                  height: 44,
                  padding: "0 1.25rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#fff",
                  color: "#003087",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                }}
              >
                تلاش دوباره
              </button>
              <Link
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 44,
                  padding: "0 1.25rem",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.4)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                }}
              >
                بازگشت به بازی‌ها
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
