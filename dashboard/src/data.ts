export type Stock = { group: string; qty: number; threshold: number }
export const stocks: Stock[] = [
  { group: 'O−', qty: 4, threshold: 15 }, { group: 'B−', qty: 3, threshold: 8 },
  { group: 'A−', qty: 11, threshold: 15 }, { group: 'AB−', qty: 9, threshold: 8 },
  { group: 'O+', qty: 52, threshold: 30 }, { group: 'A+', qty: 41, threshold: 30 },
  { group: 'B+', qty: 19, threshold: 15 }, { group: 'AB+', qty: 12, threshold: 8 },
]

export function level(s: Stock) {
  if (s.qty <= s.threshold / 3) return { label: 'Critique', fill: 'bg-primary', badge: 'bg-primary-dark text-white' }
  if (s.qty < s.threshold) return { label: 'Bas', fill: 'bg-warning', badge: 'bg-warning text-ink' }
  return { label: 'Normal', fill: 'bg-success', badge: 'bg-success text-white' }
}

export const requests = [
  { id: 'r1', group: 'O−', qty: 4, covered: 3, urgency: 'Critique', status: 'Active' },
  { id: 'r2', group: 'B−', qty: 2, covered: 2, urgency: 'Urgente', status: 'Couverte' },
  { id: 'r3', group: 'A+', qty: 3, covered: 3, urgency: 'Normale', status: 'Clôturée' },
]

export type EventItem = { id: string; title: string; place: string; date: string; filled: number; capacity: number }
export const events0: EventItem[] = [
  { id: 'e1', title: 'Collecte de sang, CNTS Tunis', place: 'Centre National de Transfusion Sanguine', date: '2026-10-10', filled: 35, capacity: 60 },
  { id: 'e2', title: 'Collecte de sang, Le Bardo', place: 'Centre Militaire de Transfusion Sanguine', date: '2026-10-17', filled: 8, capacity: 60 },
]