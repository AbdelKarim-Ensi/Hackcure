import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from './profiles'
import { listRequests, show, STATUS_LABEL, type RequestRow } from './requests'

export function Requests() {
  const { profile } = useProfile()
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  useEffect(() => { listRequests().then(setRows).catch(() => setRows([])) }, [])
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