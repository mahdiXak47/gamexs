"use client";

import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

// Self-hosted sink: unset defaults to the same-origin collector route so
// metrics are always captured without external service credentials. Point
// NEXT_PUBLIC_WEB_VITALS_ENDPOINT at an external collector to override.
const WEB_VITALS_ENDPOINT = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT ?? "/api/web-vitals";

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  const payload = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: window.location.pathname,
  };

  if (!WEB_VITALS_ENDPOINT) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[web-vitals]", payload);
    }
    return;
  }

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(WEB_VITALS_ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }

  fetch(WEB_VITALS_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {
    // Metrics are diagnostic only; reporting failures should not affect UX.
  });
};

export default function WebVitalsReporter() {
  useReportWebVitals(reportWebVitals);
  return null;
}
