const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

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
  return fetch(`${BASE}/api/auth/csrf/`, { credentials: "include" })
    .then(() => readCookie("csrftoken"))
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
