import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  cookieOptions,
  refreshTokens,
  secondsUntilExpiry,
} from "@/lib/session";

// Keeps the session alive: refreshes the 1 h access token before it expires,
// and sends anyone without a session to /login. The authoritative is_staff
// check happens in the panel layout (lib/auth.ts), not here.
export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return NextResponse.redirect(loginUrl);

  if (secondsUntilExpiry(request.cookies.get(ACCESS_COOKIE)?.value) > 60) return NextResponse.next();

  const tokens = await refreshTokens(refresh).catch(() => null);
  if (!tokens) {
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  // Hand the fresh token to this render and persist both for later requests.
  request.cookies.set(ACCESS_COOKIE, tokens.access);
  const response = NextResponse.next({ request });
  response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(REFRESH_MAX_AGE));
  return response;
}

export const config = {
  matcher: ["/((?!login|_next/|favicon.ico|icon.svg).*)"],
};
