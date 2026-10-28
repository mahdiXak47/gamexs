import { apiBaseUrl } from "./api-base"

let csrfToken: string | null = null
let csrfPromise: Promise<string | null> | null = null

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
  return value ? decodeURIComponent(value.split("=")[1]) : null
}

function bootstrap(): Promise<string | null> {
  // The cookie is set by the API host, so this page can't read it: use the
  // token from the response body (it pairs with that cookie).
  return fetch(`${apiBaseUrl()}/api/auth/csrf/`, { credentials: "include" })
    .then((response) => response.json())
    .then((body: { csrfToken?: string }) => body.csrfToken ?? readCookie("csrftoken"))
    .then((token) => {
      csrfToken = token
      return token
    })
    .catch(() => null)
}

// Returns a CSRF token for unsafe requests, bootstrapping the `csrftoken`
// cookie on first use. Safe methods never need it.
export function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return Promise.resolve(csrfToken)
  const existing = readCookie("csrftoken")
  if (existing) {
    csrfToken = existing
    return Promise.resolve(existing)
  }
  if (!csrfPromise) {
    csrfPromise = bootstrap().finally(() => {
      csrfPromise = null
    })
  }
  return csrfPromise
}

export default ensureCsrfToken
