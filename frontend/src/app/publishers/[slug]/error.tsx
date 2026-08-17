"use client";

import CatalogRouteError from "@/components/CatalogRouteError";

export default function Error(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <CatalogRouteError {...props} title="فهرست این ناشر موقتاً در دسترس نیست" />;
}
