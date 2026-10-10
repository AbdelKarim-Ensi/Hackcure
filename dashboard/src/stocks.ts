import { useEffect, useState } from 'react'
import { api, ApiError, USE_MOCK } from './api'
import { GROUPS } from './requests'
import { stocks as seed } from './data'

export type StockLevel = 'rouge' | 'orange' | 'vert'
export type Stock = { group: string; qty: number; threshold: number; level: StockLevel }

// Niveaux calculés par le backend : rouge sous le seuil, orange jusqu'à 1,5 fois le seuil, vert au-delà.
export const LEVELS: Record<StockLevel, { label: string; fill: string; badge: string }> = {
  rouge: { label: 'Critique', fill: 'bg-primary', badge: 'bg-primary-dark text-white' },
  orange: { label: 'Bas', fill: 'bg-warning', badge: 'bg-warning text-ink' },
  vert: { label: 'Normal', fill: 'bg-success', badge: 'bg-success text-white' },
}
const SEVERITY: Record<StockLevel, number> = { rouge: 0, orange: 1, vert: 2 }
export const bySeverity = (a: Stock, b: Stock) => SEVERITY[a.level] - SEVERITY[b.level] || a.qty - b.qty

const levelOf = (q: number, t: number): StockLevel => (q < t ? 'rouge' : q <= t * 1.5 ? 'orange' : 'vert')

type Line = { bloodGroup: string; quantity: number; alertThreshold: number; level: StockLevel }
type InstitutionStock = { institutionId: string; institutionName: string; stocks: Line[] }
const fromLine = (l: Line): Stock => ({ group: l.bloodGroup, qty: l.quantity, threshold: l.alertThreshold, level: l.level })
const order = (l: Stock[]) => [...l].sort((a, b) => GROUPS.indexOf(a.group as never) - GROUPS.indexOf(b.group as never))

// Mode démo : les données de data.ts, modifiables en mémoire.
const mock: Stock[] = seed.map((s) => ({
  group: s.group.replace('−', '-'), qty: s.qty, threshold: s.threshold, level: levelOf(s.qty, s.threshold),
}))

export async function listStocks(): Promise<Stock[]> {
  if (USE_MOCK) return order(mock)
  const res = await api<InstitutionStock[]>('/stocks')
  return order((res[0]?.stocks ?? []).map(fromLine))
}

export type NewStock = { bloodGroup: string; quantity: number; alertThreshold?: number }

export async function addStock(d: NewStock): Promise<Stock[]> {
  if (USE_MOCK) {
    const s = mock.find((x) => x.group === d.bloodGroup)
    if (s) {
      s.qty += d.quantity
      if (d.alertThreshold) s.threshold = d.alertThreshold
      s.level = levelOf(s.qty, s.threshold)
    }
    return order(mock)
  }
  const res = await api<InstitutionStock>('/stocks', { method: 'POST', body: JSON.stringify(d) })
  return order(res.stocks.map(fromLine))
}

// Ajuste le stock d'un groupe : delta positif pour ajouter, négatif pour retirer (jamais sous 0).
export async function adjustStock(group: string, delta: number): Promise<Stock[]> {
  if (USE_MOCK) {
    const s = mock.find((x) => x.group === group)
    if (s) {
      if (s.qty + delta < 0) throw new ApiError(400, 'Stock insuffisant')
      s.qty += delta
      s.level = levelOf(s.qty, s.threshold)
    }
    return order(mock)
  }
  const res = await api<InstitutionStock>(`/stocks/${encodeURIComponent(group)}`, {
    method: 'PATCH',
    body: JSON.stringify({ delta }),
  })
  return order(res.stocks.map(fromLine))
}

export function useStocks() {
  const [list, setList] = useState<Stock[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    listStocks().then(setList).catch(() => { setError(true); setList([]) })
  }, [])
  return { list, setList, error }
}
