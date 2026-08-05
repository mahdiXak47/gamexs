const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    return res.ok
  } catch {
    return false
  }
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })

  // On 401, attempt one silent token refresh then retry (skip for auth endpoints)
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
    }
  }

  return response
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}

export function extractApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'خطایی رخ داد'
  const d = data as Record<string, unknown>
  if (typeof d.detail === 'string') return d.detail
  if (Array.isArray(d.non_field_errors) && d.non_field_errors.length > 0)
    return String(d.non_field_errors[0])
  for (const key of Object.keys(d)) {
    const val = d[key]
    if (Array.isArray(val) && val.length > 0) return String(val[0])
    if (typeof val === 'string') return val
  }
  return 'خطایی رخ داد'
}
