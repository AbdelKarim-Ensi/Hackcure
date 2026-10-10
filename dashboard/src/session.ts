import { api, ApiError, getTokens, readTokens, setTokens, USE_MOCK } from './api'

export type InstType = 'hopital' | 'banque_sang' | 'centre_transfusion' | 'croissant_rouge'
export type Validation = 'en_attente' | 'valide' | 'rejete'
export type Me = {
  id: string; role: string; phone: string; fullName: string | null; status: string
  institution: { id: string; name: string; type: InstType; validationStatus: Validation } | null
}
export type Pending = {
  id: string; name: string; type: InstType
  declarantName?: string; declarantPhone?: string; recognized?: boolean
}

// ---------- Mode démo : comptes fictifs (numéros fixes inventés), mot de passe Demo1234! ----------
const acc = (n: number, role: string, inst: Me['institution']): Me =>
  ({ id: `u${n}`, role, phone: `+2167100000${n}`, fullName: `Compte démo ${n}`, status: 'actif', institution: inst })
const accounts: Record<string, Me> = {}
;[
  acc(1, 'hopital', { id: 'i1', name: 'CHU Charles Nicolle', type: 'hopital', validationStatus: 'valide' }),
  acc(2, 'hopital', { id: 'i2', name: 'Banque de sang de La Rabta', type: 'banque_sang', validationStatus: 'valide' }),
  acc(3, 'crt', { id: 'i3', name: 'CNTS Tunis', type: 'centre_transfusion', validationStatus: 'valide' }),
  acc(4, 'hopital', { id: 'i4', name: 'Clinique Test (fictive)', type: 'hopital', validationStatus: 'en_attente' }),
  acc(5, 'hopital', null),
  acc(9, 'admin', null),
].forEach((m) => { accounts[m.phone] = m })
export const DEMO_ACCOUNTS = Object.values(accounts).map((m) => ({ phone: m.phone, label: m.fullName ?? '', role: m.role }))
const KNOWN = ['CHU Charles Nicolle', 'Banque de sang de La Rabta', 'CNTS Tunis', 'CHU La Rabta', 'CHU Habib Thameur']

// ---------- Mode réel : adaptation des réponses du backend ----------
const USER_KEY = 'damm.user'
type LoginUser = { id: string; role: string; phone: string; fullName?: string | null; institutionId?: string | null; institution?: unknown }

// Accepte plusieurs variantes de noms de champs (validationStatus / validation_status / status).
function normInstitution(raw: unknown): Me['institution'] {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = r.id as string | undefined
  if (!id) return null
  const status = (r.validationStatus ?? r.validation_status ?? r.status ?? 'en_attente') as Validation
  return { id, name: String(r.name ?? ''), type: (r.type ?? 'hopital') as InstType, validationStatus: status }
}

async function toMe(u: LoginUser): Promise<Me> {
  let institution = normInstitution(u.institution)
  if (!institution && u.institutionId) {
    try { institution = normInstitution(await api<unknown>(`/institutions/${u.institutionId}`)) } catch { /* établissement illisible */ }
  }
  return { id: u.id, role: u.role, phone: u.phone, fullName: u.fullName ?? null, status: 'actif', institution }
}

const saveUser = (u: LoginUser | null) => {
  if (u) sessionStorage.setItem(USER_KEY, JSON.stringify(u)); else sessionStorage.removeItem(USER_KEY)
}
const cachedUser = (): LoginUser | null => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null') } catch { return null }
}
export const clearSession = () => { setTokens(null); saveUser(null) }

/** Connexion. Renvoie l'utilisateur si le backend le fournit dans la réponse, sinon null (fetchMe prendra le relais). */
export async function login(phone: string, password: string): Promise<Me | null> {
  if (USE_MOCK) {
    if (!accounts[phone] || password !== 'Demo1234!') throw new ApiError(401, 'Identifiants incorrects')
    setTokens({ access: `mock:${phone}`, refresh: '' })
    return null
  }
  const body = await api<{ user?: LoginUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
  const tokens = readTokens(body)
  if (!tokens.access) throw new ApiError(500, 'Réponse /auth/login inattendue (jeton introuvable) : ' + JSON.stringify(body))
  setTokens(tokens)
  // AJOUT : fix login - /auth/login ne renvoie que institutionId et GET /institutions/:id n'existe pas (404) :
  // toMe() donnait institution=null -> écran "Déclarer un établissement" pour un hôpital déjà rattaché. On laisse fetchMe() (GET /users/me) charger l'établissement.
  // Ligne d'origine : if (body.user) { saveUser(body.user); return toMe(body.user) }
  if (body.user) { saveUser(body.user); return null }
  return null
}

export async function fetchMe(): Promise<Me> {
  if (USE_MOCK) {
    const m = accounts[getTokens()?.access.replace('mock:', '') ?? '']
    if (!m) throw new ApiError(401, 'Session expirée')
    return structuredClone(m)
  }
  try {
    const raw = await api<LoginUser & { institution?: unknown }>('/users/me')
    saveUser(raw)
    return toMe(raw)
  } catch (err) {
    // Route /users/me absente (404/501) : on retombe sur l'utilisateur reçu au login.
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
      const u = cachedUser()
      if (u) return toMe(u)
    }
    throw err
  }
}

export async function declareInstitution(me: Me, d: { name: string; type: InstType; address: string }): Promise<void> {
  if (USE_MOCK) {
    accounts[me.phone].institution = { id: `i${Date.now()}`, name: d.name, type: d.type, validationStatus: 'en_attente' }
    return
  }
  await api('/institutions', { method: 'POST', body: JSON.stringify(d) })
}

export async function listPending(): Promise<Pending[]> {
  if (USE_MOCK) {
    return Object.values(accounts).filter((m) => m.institution?.validationStatus === 'en_attente').map((m) => ({
      id: m.institution!.id, name: m.institution!.name, type: m.institution!.type,
      declarantName: m.fullName ?? undefined, declarantPhone: m.phone, recognized: KNOWN.includes(m.institution!.name),
    }))
  }
  return api<Pending[]>('/institutions?validationStatus=en_attente')
}

// À CONFIRMER avec openapi.json : corps attendu par PATCH /institutions/:id/validate.
export async function decide(id: string, validationStatus: 'valide' | 'rejete'): Promise<void> {
  if (USE_MOCK) {
    const m = Object.values(accounts).find((x) => x.institution?.id === id)
    if (m?.institution) m.institution.validationStatus = validationStatus
    return
  }
  await api(`/institutions/${id}/validate`, { method: 'PATCH', body: JSON.stringify({ validationStatus }) })
}