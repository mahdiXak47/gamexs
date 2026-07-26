const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getToken(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getToken('gx_refresh')
  if (!refresh) return null
  try {
    const res = await fetch(`${BASE}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) {
      localStorage.removeItem('gx_access')
      localStorage.removeItem('gx_refresh')
      return null
    }
    const data = await res.json()
    localStorage.setItem('gx_access', data.access)
    if (data.refresh) localStorage.setItem('gx_refresh', data.refresh)
    return data.access
  } catch {
    return null
  }
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken('gx_access')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE}${path}`, { ...options, headers })

  // On 401, attempt one silent token refresh then retry (skip for auth endpoints)
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`
      return fetch(`${BASE}${path}`, { ...options, headers })
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
