import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["images.igdb.com"]);
const MAX_CONCURRENT = 3;

// Semaphore — limits simultaneous outbound requests to IGDB
class Semaphore {
  private slots: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.slots = max;
  }

  acquire(): Promise<void> {
    if (this.slots > 0) {
      this.slots--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.slots++;
    }
  }
}

const sem = new Semaphore(MAX_CONCURRENT);

// Request coalescing — if multiple requests arrive for the same image
// while it's in flight, they all wait for the single outbound fetch.
const inflight = new Map<string, Promise<{ data: ArrayBuffer; contentType: string } | null>>();

async function fetchFromIgdb(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  await sem.acquire();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GameXS/1.0" },
      next: { revalidate: 604800 }, // 7 days in Next.js data cache
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const data = await res.arrayBuffer();
    return { data, contentType };
  } catch {
    return null;
  } finally {
    sem.release();
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const cacheKey = parsed.pathname;

  // Coalesce concurrent requests for the same image
  let promise = inflight.get(cacheKey);
  if (!promise) {
    promise = fetchFromIgdb(raw).finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, promise);
  }

  const result = await promise;
  if (!result) {
    return new NextResponse("Upstream error", { status: 502 });
  }

  return new NextResponse(result.data, {
    headers: {
      "Content-Type": result.contentType,
      // Browser caches for 7 days; immutable signals the resource never changes at this URL
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
