import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from './api'
import { createRequest, GROUPS, show, URGENCIES, type RequestRow, type Urgency } from './requests'

const HOURS = [2, 4, 6, 12, 24]
const MAX_UNITS = 20

export default function NewRequest() {
  const [group, setGroup] = useState('')
  const [qty, setQty] = useState(1)
  const [urgency, setUrgency] = useState<Urgency>('urgente')
  const [hours, setHours] = useState(6)
  const [errors, setErrors] = useState<{ group?: string; qty?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<RequestRow | null>(null)

  const reset = () => { setDone(null); setGroup(''); setQty(1); setUrgency('urgente'); setHours(6); setErrors({}) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!group) next.group = 'Choisissez un groupe sanguin.'
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_UNITS) next.qty = `Indiquez un nombre d'unités entre 1 et ${MAX_UNITS}.`
    setErrors(next)
    if (next.group || next.qty) return
    setBusy(true)
    try { setDone(await createRequest({ bloodGroup: group, quantity: qty, urgency, deadlineHours: hours })) }
    catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setErrors({ form: s === 403 ? "Votre établissement n'est pas encore validé : l'administrateur doit l'approuver avant toute demande."
        : s === 400 ? 'Demande invalide : vérifiez les champs.' : 'Impossible d’enregistrer la demande, réessayez.' })
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-line bg-serum p-8 text-center">
        <p className="font-display text-8xl font-bold leading-none text-primary">{show(done.group)}</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Demande enregistrée</h1>
        <p className="mt-2 text-muted">{done.qty} unité{done.qty > 1 ? 's' : ''}, urgence {done.urgency}, réponse souhaitée sous {hours} h.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/demandes" className="rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark">Voir mes demandes</Link>
          <button onClick={reset} className="rounded-xl border border-line px-4 py-3 font-semibold hover:bg-primary-soft">Nouvelle demande</button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Nouvelle demande de sang</h1>
        <p className="mt-1 text-muted">Aucune identité de patient n'est demandée ni transmise aux donneurs.</p>
      </div>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold">Groupe sanguin</legend>
        <div className="grid grid-cols-4 gap-3">
          {GROUPS.map((g) => (
            <button type="button" key={g} aria-pressed={group === g} onClick={() => setGroup(g)}
              className={`rounded-2xl border-2 py-4 font-display text-2xl font-bold transition ${group === g ? 'border-primary bg-primary text-white' : 'border-line bg-serum hover:border-primary'}`}>
              {show(g)}
            </button>
          ))}
        </div>
        {errors.group && <p role="alert" className="mt-2 text-sm font-medium text-primary-dark">{errors.group}</p>}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="font-display text-lg font-semibold">Unités nécessaires</span>
          <input type="number" min={1} max={MAX_UNITS} value={qty} onChange={(e) => setQty(e.target.valueAsNumber)}
            className="mt-2 w-full rounded-xl border border-line bg-serum px-4 py-3 text-2xl font-bold" />
          {errors.qty && <p role="alert" className="mt-2 text-sm font-medium text-primary-dark">{errors.qty}</p>}
        </label>
        <label className="block">
          <span className="font-display text-lg font-semibold">Délai souhaité</span>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-line bg-serum px-4 py-3 text-2xl font-bold">
            {HOURS.map((h) => <option key={h} value={h}>{h} heures</option>)}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold">Niveau d'urgence</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {URGENCIES.map((u) => (
            <label key={u.key} className="cursor-pointer">
              <input type="radio" name="urgency" className="peer sr-only" checked={urgency === u.key} onChange={() => setUrgency(u.key)} />
              <span className="block rounded-2xl border-2 border-line bg-serum p-4 peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                <span className="block font-display text-lg font-bold">{u.label}</span>
                <span className="text-sm text-muted">{u.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {errors.form && <p role="alert" className="rounded-xl bg-primary-soft px-4 py-3 font-medium text-primary-dark">{errors.form}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-4 text-lg font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
        {busy ? 'Envoi…' : 'Envoyer la demande'}
      </button>
    </form>
  )
}