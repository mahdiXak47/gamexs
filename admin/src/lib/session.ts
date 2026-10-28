// Session plumbing shared by proxy.ts, Server Actions and pages.
// Tokens come from the Django backend (SimpleJWT) and are kept in this app's
// own httpOnly cookies; the browser never sees or sends them to the API.

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const ACCESS_COOKIE = "gx_admin_access";
export const REFRESH_COOKIE = "gx_admin_refresh";

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge,
});

export const ACCESS_MAX_AGE = 60 * 60; // backend access token: 1 h
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // admin sessions: 7 days (backend allows 30)

/** The backend returns tokens only as Set-Cookie (gx_access / gx_refresh). */
export function tokensFromSetCookie(response: Response): { access?: string; refresh?: string } {
  const out: { access?: string; refresh?: string } = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const [name, ...rest] = pair.split("=");
    if (name.trim() === "gx_access") out.access = rest.join("=");
    if (name.trim() === "gx_refresh") out.refresh = rest.join("=");
  }
  return out;
}

/** Seconds until the JWT expires (no signature check — the backend does that). */
export function secondsUntilExpiry(token: string | undefined): number {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp - Date.now() / 1000;
  } catch {
    return 0;
  }
}

/**
 * POST to the backend the way its own browser client does: Django's CSRF
 * middleware guards every unsafe auth endpoint, so fetch a token first and
 * echo it back as the csrftoken cookie + X-CSRFToken header. The Origin is the
 * API's own, which Django's same-origin check accepts without listing this app
 * in CSRF_TRUSTED_ORIGINS.
 */
export async function apiPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  const csrf = await fetch(`${API_URL}/api/auth/csrf/`, { cache: "no-store" });
  const token = ((await csrf.json()) as { csrfToken: string }).csrfToken;
  const cookie = csrf.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("csrftoken="));
  const origin = new URL(API_URL).origin;
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": token,
      Cookie: cookie ?? `csrftoken=${token}`,
      Origin: origin,
      Referer: `${origin}/`,
      ...headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function refreshTokens(refresh: string) {
  const response = await apiPost("/api/auth/token/refresh/", { refresh });
  if (!response.ok) return null;
  const tokens = tokensFromSetCookie(response);
  return tokens.access ? { access: tokens.access, refresh: tokens.refresh ?? refresh } : null;
}

export type StaffProfile = {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  /** The partner store this account may see in the store portal (backend StoreMember), or null. */
  store: { id: number } | null;
};

export async function fetchProfile(access: string): Promise<StaffProfile | null> {
  const response = await fetch(`${API_URL}/api/profile/`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as StaffProfile) : null;
}
