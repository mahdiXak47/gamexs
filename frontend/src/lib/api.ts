const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('gx_access')
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}${path}`, { ...options, headers })
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
