// Client API : adresse en variable d'environnement, jetons en sessionStorage, renouvellement automatique.
const BASE = import.meta.env.VITE_API_URL as string | undefined
// Sans VITE_API_URL (ou avec VITE_USE_MOCK=true), tout est simulé dans session.ts.
export const USE_MOCK = !BASE || import.meta.env.VITE_USE_MOCK === 'true'

export type Tokens = { access: string; refresh: string }
const KEY = 'damm.tokens'

export function getTokens(): Tokens | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export function setTokens(t: Tokens | null) {
  if (t) sessionStorage.setItem(KEY, JSON.stringify(t)); else sessionStorage.removeItem(KEY)
}

// À CONFIRMER avec openapi.json : noms exacts des champs de jetons renvoyés par /auth/login et /auth/refresh.
export function readTokens(body: unknown): Tokens {
  const b = body as { accessToken?: string; refreshToken?: string; access_token?: string; refresh_token?: string }
  return { access: b.accessToken ?? b.access_token ?? '', refresh: b.refreshToken ?? b.refresh_token ?? '' }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

function call(path: string, init: RequestInit, token?: string) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let t = getTokens()
  let res = await call(path, init, t?.access)
  if (res.status === 401 && t?.refresh) {
    const r = await call('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: t.refresh }) })
    if (r.ok) { t = readTokens(await r.json()); setTokens(t); res = await call(path, init, t.access) } else setTokens(null)
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(res.status, b?.message ?? res.statusText)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}