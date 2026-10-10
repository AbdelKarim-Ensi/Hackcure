// Carte « Demande en cours » : demande active réelle + jauge, vague courante et donneurs en route en direct.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLive } from './live'
import LaunchWaveButton from './LaunchWaveButton'
import { listRequests, show, URGENCIES, type RequestRow } from './requests'

const R = 44
const C = 2 * Math.PI * R

function Ring({ accepted, needed, percent }: { accepted: number; needed: number; percent: number }) {
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${accepted} sur ${needed} unités couvertes`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-primary-soft" />
        <circle
          cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, percent) / 100)}
        />
      </svg>
      <p className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold">{accepted}/{needed}</p>
    </div>
  )
}

export default function CurrentRequest() {
  const [req, setReq] = useState<RequestRow | null | undefined>(undefined)
  useEffect(() => {
    listRequests().then((rs) => setReq(rs.find((r) => r.status === 'active') ?? null)).catch(() => setReq(null))
  }, [])
  const { live, error, connected } = useLive(req?.id ?? null)
  const urgency = URGENCIES.find((u) => u.key === req?.urgency)?.label.toLowerCase()
  const gauge = live?.gauge
  const needed = gauge?.needed || req?.qty || 0
  const lastWave = live?.waves[live.waves.length - 1]

  return (
    <section className="rounded-2xl border border-line bg-serum p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Demande en cours</h2>
        {req && (
          <span className={`text-sm font-semibold ${connected ? 'text-success' : 'text-muted'}`}>
            {connected ? '● En direct' : '○ Hors ligne'}
          </span>
        )}
      </div>
      {req === undefined && <p className="mt-4 text-muted">Chargement…</p>}
      {req === null && <p className="mt-4 text-muted">Aucune demande en cours.</p>}
      {req && (
        <div className="mt-4 space-y-5">
          <div className="flex items-center gap-5">
            <Ring accepted={gauge?.accepted ?? 0} needed={needed} percent={gauge?.percent ?? 0} />
            <div>
              <p className="font-display text-7xl font-bold leading-none text-primary">{show(req.group)}</p>
              <p className="mt-2 text-muted">{req.qty} unité{req.qty > 1 ? 's' : ''}, urgence {urgency}</p>
            </div>
          </div>
          {lastWave && (
            <p className="text-sm text-muted">
              Vague {lastWave.number} · rayon {lastWave.radiusKm} km · {lastWave.sentTo} donneur{lastWave.sentTo > 1 ? 's' : ''} alerté{lastWave.sentTo > 1 ? 's' : ''}
            </p>
          )}
          <div>
            <h3 className="text-sm font-semibold">Donneurs en route</h3>
            {live && live.donorsEnRoute.length === 0 && <p className="mt-1 text-sm text-muted">Aucun pour le moment.</p>}
            <ul className="mt-1 space-y-1 text-sm">
              {live?.donorsEnRoute.map((d) => (
                <li key={d.anonymousId}>Donneur {show(d.bloodGroup)} · {d.distanceKm} km · en route</li>
              ))}
            </ul>
          </div>
          {error && <p className="text-sm text-warning">Suivi en direct indisponible : {error}</p>}
        </div>
      )}
      {req && (
        <div className="mt-5">
          <LaunchWaveButton variant="card" />
        </div>
      )}
      <Link to="/demandes/nouvelle" className="mt-5 block rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white hover:bg-primary-dark">
        Créer une demande
      </Link>
    </section>
  )
}
