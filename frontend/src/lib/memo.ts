// In-process stale-while-revalidate cache for catalog reads. Server-only.
//
// Catalog data only changes when the scraper loads (a few times a day), yet
// every page is dynamic (per-request CSP nonce) and the listing aggregate costs
// ~300 ms of DB time. Results are kept as live objects (no JSON round trip, so
// Dates survive) and shared between requests: callers must not mutate them.
// After `ttlMs` the next call still gets the old value instantly while one
// refresh runs in the background; a failed refresh keeps serving the old value.
// ponytail: per-process, so each replica warms its own copy; move to a shared
// store (Redis) only if replicas multiply.

const DEFAULT_TTL_MS = 5 * 60_000; // same as the CDN s-maxage in next.config.ts
const MAX_ENTRIES = 2000; // per function; oldest key is evicted first

type Entry<R> = { at: number; value: Promise<R>; settled: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memo<F extends (...args: any[]) => Promise<unknown>>(fn: F, ttlMs = DEFAULT_TTL_MS): F {
  type A = Parameters<F>;
  type R = Awaited<ReturnType<F>>;
  const store = new Map<string, Entry<R>>();

  // `stale` is the entry still being served while this load refreshes it.
  const load = (key: string, args: A, stale?: Entry<R>): Promise<R> => {
    const entry: Entry<R> = { at: Date.now(), value: fn(...args) as Promise<R>, settled: false };
    if (!stale) store.set(key, entry); // concurrent cold calls share one query
    entry.value.then(
      () => {
        entry.settled = true;
        store.delete(key); // re-insert so eviction order follows freshness
        store.set(key, entry);
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
      },
      () => {
        if (stale) stale.at = 0; // retry on the next call, keep serving the stale value
        else if (store.get(key) === entry) store.delete(key); // never cache a failure
      },
    );
    return entry.value;
  };

  return ((...args: A): Promise<R> => {
    const key = JSON.stringify(args);
    const hit = store.get(key);
    if (!hit) return load(key, args);
    if (hit.settled && Date.now() - hit.at >= ttlMs) {
      hit.at = Date.now(); // one background refresh at a time
      load(key, args, hit).catch(() => {}); // handled above
    }
    return hit.value;
  }) as F;
}
