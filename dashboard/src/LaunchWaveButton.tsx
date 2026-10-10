// Bouton « Lancer la vague suivante » : lancement manuel, réservé aux demandes critiques.
// Les vagues suivantes partent déjà automatiquement à l'échéance du délai (backend).
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { launchWave, listRequests, type RequestRow } from './requests'

export default function LaunchWaveButton({ variant }: { variant: 'card' | 'sidebar' }) {
  const { pathname } = useLocation()
  const [req, setReq] = useState<RequestRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    listRequests()
      .then((rs) => setReq(rs.find((r) => r.status === 'active') ?? null))
      .catch(() => setReq(null))
  }, [pathname])

  if (!req) return null
  const id = req.id
  const allowed = req.urgency === 'urgente' || req.urgency === 'critique'

  async function onClick() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await launchWave(id)
      setMsg({ ok: true, text: `Vague ${r.waveNumber} lancée (${r.radiusKm} km)` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Lancement impossible' })
    } finally {
      setBusy(false)
    }
  }

  const base = 'cursor-pointer font-semibold disabled:cursor-not-allowed disabled:opacity-50'
  const style =
    variant === 'card'
      ? `${base} block w-full rounded-xl border-2 border-primary px-4 py-3 text-center text-primary hover:bg-primary-soft`
      : `${base} w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary hover:bg-primary-soft`

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={!allowed || busy}
        className={style}
      >
        {busy ? 'Lancement…' : 'Lancer la vague suivante'}
      </button>
      {!allowed && <p className="mt-1 text-xs text-muted">Réservé aux demandes urgentes ou critiques.</p>}
      {msg && <p className={`mt-1 text-xs ${msg.ok ? 'text-success' : 'text-warning'}`}>{msg.text}</p>}
    </div>
  )
}
