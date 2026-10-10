// Suivi en direct d'une demande : état initial par REST, mises à jour par Socket.IO (namespace /live).
// Les événements WS sont minimaux (R4) : gauge met à jour la jauge, les autres déclenchent un rechargement REST.
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getTokens, USE_MOCK } from './api'

export type Gauge = { accepted: number; needed: number; percent: number }
export type Wave = { number: number; radiusKm: number; sentTo: number; coverage: number; createdAt: string }
export type DonorEnRoute = { anonymousId: string; bloodGroup: string; distanceKm: number; respondedAt: string }
export type LiveState = {
  requestId: string
  status: string
  currentRadiusKm: number
  gauge: Gauge
  waves: Wave[]
  donorsEnRoute: DonorEnRoute[]
}

export async function fetchLive(id: string): Promise<LiveState> {
  if (USE_MOCK) {
    return { requestId: id, status: 'active', currentRadiusKm: 5, gauge: { accepted: 0, needed: 0, percent: 0 }, waves: [], donorsEnRoute: [] }
  }
  return api<LiveState>(`/requests/${id}/live`)
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function useLive(requestId: string | null) {
  const [live, setLive] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    setLive(null)
    setError(null)
    setConnected(false)
    if (!requestId) return
    let alive = true
    const load = () =>
      fetchLive(requestId)
        .then((s) => { if (alive) setLive(s) })
        .catch((e: Error) => { if (alive) setError(e.message) })
    load()
    if (USE_MOCK) return () => { alive = false }

    const socket = io(`${import.meta.env.VITE_API_URL as string}/live`, {
      auth: (cb) => cb({ token: getTokens()?.access ?? '' }),
    })
    socket.on('connect', () => {
      socket.emit('subscribe', { requestId }, (ack: { ok: boolean; error?: string }) => {
        if (!alive) return
        setConnected(ack.ok)
        if (!ack.ok) setError(ack.error ?? 'abonnement refusé')
        else load() // resynchronise après une (re)connexion
      })
    })
    socket.on('disconnect', () => { if (alive) setConnected(false) })
    // Charge utile réelle : { requestId, accepted, needed, percent, at }
    socket.on('gauge', (p: Partial<Gauge>) => {
      if (!alive || !num(p?.accepted) || !num(p?.needed) || !num(p?.percent)) return
      const gauge = { accepted: p.accepted, needed: p.needed, percent: p.percent }
      setLive((s) => (s ? { ...s, gauge } : s))
    })
    // Charges utiles minimales : le détail (distance, groupe, vagues) vient du GET /live.
    socket.on('donor_en_route', () => { if (alive) load() })
    socket.on('wave_started', () => { if (alive) load() })
    return () => {
      alive = false
      socket.emit('unsubscribe', { requestId })
      socket.disconnect()
    }
  }, [requestId])

  return { live, error, connected }
}
