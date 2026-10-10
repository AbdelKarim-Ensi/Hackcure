import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLive } from './live'
import { useProfile } from './profiles'
import { listRequests, show, STATUS_LABEL, type RequestRow } from './requests'

const POLL_MS = 5000

// Complète `covered` avec la jauge réelle (gauge.accepted) ; en cas d'échec, la ligne garde sa valeur.
async function withGauge(rows: RequestRow[], only?: (r: RequestRow) => boolean): Promise<RequestRow[]> {
  return Promise.all(rows.map(async (r) => {
    if (only && !only(r)) return r
    try { return { ...r, covered: (await fetchLive(r.id)).gauge.accepted } } catch { return r }
  }))
}

export function Requests() {
  const { profile } = useProfile()
  const [rows, setRows] = useState<RequestRow[] | null>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | undefined
    listRequests()
      .then((list) => withGauge(list))
      .then((list) => {
        if (!alive) return
        setRows(list)
        if (!list.some((r) => r.status === 'active')) return
        // Rafraîchit seulement les demandes actives ; les autres gardent leur valeur déjà chargée.
        timer = setInterval(() => {
          setRows((cur) => {
            if (!cur) return cur
            withGauge(cur, (r) => r.status === 'active').then((next) => { if (alive) setRows(next) })
            return cur
          })
        }, POLL_MS)
      })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false; if (timer) clearInterval(timer) }
  }, [])

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Demandes de sang</h1>
        {profile === 'hopital' && (
          <Link to="/demandes/nouvelle" className="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">Nouvelle demande</Link>
        )}
      </div>
      {rows === null && <p className="text-muted">Chargement…</p>}
      {rows?.length === 0 && <p className="text-muted">Aucune demande pour le moment.</p>}
      <ul className="space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-serum p-4">
            <p className="font-display text-3xl font-bold text-primary">{show(r.group)}</p>
            <p>{r.covered}/{r.qty} unités, urgence {r.urgency}</p>
            <span className="rounded-md bg-primary-soft px-2 py-1 text-sm font-semibold text-primary-dark">{STATUS_LABEL[r.status] ?? r.status}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
