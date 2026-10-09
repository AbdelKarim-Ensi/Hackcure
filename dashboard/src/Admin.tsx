import { useCallback, useEffect, useState } from 'react'
import { decide, listPending, type Pending } from './session'
import Screen from './Screen'

export default function Admin() {
  const [list, setList] = useState<Pending[] | null>(null)
  const load = useCallback(() => listPending().then(setList), [])
  useEffect(() => { load() }, [load])
  const act = async (id: string, s: 'valide' | 'rejete') => { await decide(id, s); await load() }
  return (
    <Screen title="Établissements à valider">
      {list === null && <p className="text-muted">Chargement…</p>}
      {list?.length === 0 && <p className="text-muted">Aucune demande en attente.</p>}
      <ul className="space-y-3">
        {list?.map((p) => (
          <li key={p.id} className="rounded-2xl border border-line bg-serum p-5">
            <p className="font-display text-lg font-semibold">{p.name}</p>
            <p className="text-sm text-muted">
  {p.type.replace(/_/g, ' ')}
  {(p.declarantName || p.declarantPhone) && `, déclaré par ${[p.declarantName, p.declarantPhone].filter(Boolean).join(' · ')}`}
</p>
            {p.recognized !== undefined && (
              <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${p.recognized ? 'bg-success text-white' : 'bg-warning text-ink'}`}>
                {p.recognized ? 'Reconnu dans le référentiel' : 'Non reconnu dans le référentiel'}</span>)}
            <div className="mt-3 flex gap-2">
              <button onClick={() => act(p.id, 'valide')} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">Approuver</button>
              <button onClick={() => act(p.id, 'rejete')} className="rounded-lg border border-line px-4 py-2 font-semibold hover:bg-primary-soft">Refuser</button>
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  )
}