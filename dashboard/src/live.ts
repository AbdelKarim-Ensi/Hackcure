// Suivi en direct d'une demande : état initial par REST, mises à jour par Socket.IO (namespace /live).
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

// Charge l'état initial puis applique les événements gauge, donor_en_route et wave_started.
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
    socket.on('gauge', (p: { gauge: Gauge }) => {
      if (alive) setLive((s) => (s ? { ...s, gauge: p.gauge } : s))
    })
    socket.on('donor_en_route', (p: { donor: DonorEnRoute }) => {
      if (alive) setLive((s) => (s && !s.donorsEnRoute.some((d) => d.anonymousId === p.donor.anonymousId)
        ? { ...s, donorsEnRoute: [...s.donorsEnRoute, p.donor] } : s))
    })
    socket.on('wave_started', (p: { wave: Wave }) => {
      if (alive) setLive((s) => (s && !s.waves.some((w) => w.number === p.wave.number)
        ? { ...s, waves: [...s.waves, p.wave], currentRadiusKm: p.wave.radiusKm } : s))
    })
    return () => {
      alive = false
      socket.emit('unsubscribe', { requestId })
      socket.disconnect()
    }
  }, [requestId])

  return { live, error, connected }
}
