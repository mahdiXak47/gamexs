"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  apiPost,
  cookieOptions,
  fetchProfile,
  tokensFromSetCookie,
} from "./session";

export type LoginState = { error?: string; phone?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  if (!phone || !password) return { error: "Enter your phone number and password.", phone };

  let response: Response;
  try {
    response = await apiPost("/api/auth/login/", { phone_number: phone, password });
  } catch {
    return { error: "The GameXS API is unreachable. Try again in a moment.", phone };
  }
  if (response.status === 403) {
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    if (body.code === "phone_not_verified") return { error: "This phone number is not verified yet.", phone };
  }
  if (response.status === 429) return { error: "Too many attempts. Wait a minute and try again.", phone };
  if (!response.ok) return { error: "Phone number or password is incorrect.", phone };

  const tokens = tokensFromSetCookie(response);
  const profile = tokens.access ? await fetchProfile(tokens.access) : null;
  if (!profile || !tokens.refresh) return { error: "Login succeeded but no session was issued.", phone };
  if (!profile.is_staff) return { error: "This account is not a GameXS admin.", phone };

  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access!, cookieOptions(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(REFRESH_MAX_AGE));
  // Only same-app relative paths; never an absolute URL from the query string.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // Blacklist the refresh token server-side; ignore failures, cookies go anyway.
    await apiPost("/api/auth/logout/", { refresh }, { Authorization: `Bearer ${store.get(ACCESS_COOKIE)?.value ?? ""}` }).catch(
      () => undefined,
    );
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect("/login");
}
