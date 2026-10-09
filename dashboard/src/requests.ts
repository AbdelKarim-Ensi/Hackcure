import { api, USE_MOCK } from './api'
import { requests as seed } from './data'

// Valeurs de l'enum BloodGroup du backend (tiret ASCII). À l'écran on affiche « − » via show().
export const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const
export const show = (g: string) => g.replace('-', '−')

export type Urgency = 'normale' | 'urgente' | 'critique'
export const URGENCIES: { key: Urgency; label: string; hint: string }[] = [
  { key: 'normale', label: 'Normale', hint: 'Dans la journée' },
  { key: 'urgente', label: 'Urgente', hint: 'Dans quelques heures' },
  { key: 'critique', label: 'Critique', hint: 'Besoin immédiat' },
]
export const STATUS_LABEL: Record<string, string> = {
  en_revue: 'En revue', active: 'Active', couverte: 'Couverte', cloturee: 'Clôturée', expiree: 'Expirée',
}

export type NewRequest = { bloodGroup: string; quantity: number; urgency: Urgency; deadlineHours: number }
export type RequestRow = { id: string; group: string; qty: number; covered: number; urgency: Urgency; status: string }
type Api = { id: string; bloodGroup: string; quantity: number; urgency: Urgency; status: string }
const fromApi = (r: Api): RequestRow =>
  ({ id: r.id, group: r.bloodGroup, qty: r.quantity, covered: 0, urgency: r.urgency, status: r.status })

const mock: RequestRow[] = seed.map((r) => ({
  id: r.id, group: r.group.replace('−', '-'), qty: r.qty, covered: r.covered,
  urgency: r.urgency.toLowerCase() as Urgency, status: r.status.toLowerCase().replace('ô', 'o'),
}))

export async function listRequests(): Promise<RequestRow[]> {
  if (USE_MOCK) return [...mock]
  return (await api<Api[]>('/requests')).map(fromApi)
}

export async function createRequest(d: NewRequest): Promise<RequestRow> {
  if (USE_MOCK) {
    const row: RequestRow = { id: crypto.randomUUID(), group: d.bloodGroup, qty: d.quantity, covered: 0, urgency: d.urgency, status: 'active' }
    mock.unshift(row)
    return row
  }
  // À CONFIRMER avec openapi.json : corps de POST /requests (noms de champs, délai en `deadline` ISO ou en heures).
  const deadline = new Date(Date.now() + d.deadlineHours * 3_600_000).toISOString()
  return fromApi(await api<Api>('/requests', {
    method: 'POST',
    body: JSON.stringify({ bloodGroup: d.bloodGroup, quantity: d.quantity, urgency: d.urgency, deadline }),
  }))
}