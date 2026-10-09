import { api, ApiError, getTokens, readTokens, setTokens, USE_MOCK } from './api'

export type InstType = 'hopital' | 'banque_sang' | 'centre_transfusion' | 'croissant_rouge'
export type Validation = 'en_attente' | 'valide' | 'rejete'
export type Me = {
  id: string; role: string; phone: string; fullName: string | null; status: string
  institution: { id: string; name: string; type: InstType; validationStatus: Validation } | null
}
export type Pending = {
  id: string; name: string; type: InstType
  declarantPhone?: string; declarantName?: string | null
  recognized?: boolean // mode démo uniquement
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
  acc(6, 'crt', { id: 'i6', name: 'Croissant-Rouge Tunis', type: 'croissant_rouge', validationStatus: 'valide' }),
  acc(9, 'admin', null),
].forEach((m) => { accounts[m.phone] = m })
export const DEMO_ACCOUNTS = Object.values(accounts).map((m) => ({ phone: m.phone, label: m.fullName ?? '', role: m.role }))
const KNOWN = ['CHU Charles Nicolle', 'Banque de sang de La Rabta', 'CNTS Tunis', 'CHU La Rabta', 'CHU Habib Thameur']

export async function login(phone: string, password: string): Promise<void> {
  if (USE_MOCK) {
    if (!accounts[phone] || password !== 'Demo1234!') throw new ApiError(401, 'Identifiants incorrects')
    setTokens({ access: `mock:${phone}`, refresh: '' })
    return
  }
  setTokens(readTokens(await api('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })))
}

export async function fetchMe(): Promise<Me> {
  if (USE_MOCK) {
    const m = accounts[getTokens()?.access.replace('mock:', '') ?? '']
    if (!m) throw new ApiError(401, 'Session expirée')
    return structuredClone(m)
  }
  return api<Me>('/users/me') // disponible côté backend (M1) : protégée, tous les rôles
}

export async function declareInstitution(me: Me, d: { name: string; type: InstType; address: string }): Promise<void> {
  if (USE_MOCK) {
    accounts[me.phone].institution = { id: `i${Date.now()}`, name: d.name, type: d.type, validationStatus: 'en_attente' }
    return
  }
  // À CONFIRMER avec openapi.json : corps attendu (name, type, address supposés).
  await api('/institutions', { method: 'POST', body: JSON.stringify(d) })
}

export async function listPending(): Promise<Pending[]> {
  if (USE_MOCK) {
    return Object.values(accounts).filter((m) => m.institution?.validationStatus === 'en_attente').map((m) => ({
      id: m.institution!.id, name: m.institution!.name, type: m.institution!.type,
      declarantPhone: m.phone, declarantName: m.fullName,
      recognized: KNOWN.includes(m.institution!.name),
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