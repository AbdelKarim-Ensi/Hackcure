import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from './api'
import { PROFILES, useProfile } from './profiles'
import { events0, type EventItem } from './data'
import { GROUPS, listRequests, show, URGENCIES, type RequestRow } from './requests'
import { addStock, bySeverity, LEVELS, useStocks, type Stock } from './stocks'

function StockTile({ s }: { s: Stock }) {
  const l = LEVELS[s.level]
  const pct = Math.min(100, Math.round((s.qty / (s.threshold * 2)) * 100))
  return (
    <article className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-serum p-4">
      <div className={`absolute inset-x-0 bottom-0 opacity-20 ${l.fill}`} style={{ height: `${pct}%` }} aria-hidden="true" />
      <p className="relative font-display text-3xl font-bold leading-none">{show(s.group)}</p>
      <div className="relative space-y-2">
        <div className="text-sm leading-snug text-muted">
          <p><span className="font-semibold text-ink">{s.qty}</span> poches</p>
          <p>seuil {s.threshold}</p>
        </div>
        <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-semibold ${l.badge}`}>{l.label}</span>
      </div>
    </article>
  )
}
const StockGrid = ({ list }: { list: Stock[] }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4">
    {list.map((s) => <StockTile key={s.group} s={s} />)}
  </div>
)

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function EventRow({ e }: { e: EventItem }) {
  const pct = Math.round((e.filled / e.capacity) * 100)
  return (
    <li className="rounded-2xl border border-line bg-serum p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{e.title}</h3>
        <p className="text-sm text-muted">{fmt(e.date)}</p>
      </div>
      <p className="text-sm text-muted">{e.place}</p>
      <div className="mt-3 h-2 rounded-full bg-primary-soft"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-sm">{e.filled} inscrits sur {e.capacity}</p>
    </li>
  )
}

// Demande active réelle de l'établissement (le suivi des donneurs en route arrive à l'étape suivante).
function CurrentRequest() {
  const [req, setReq] = useState<RequestRow | null | undefined>(undefined)
  useEffect(() => {
    listRequests().then((rs) => setReq(rs.find((r) => r.status === 'active') ?? null)).catch(() => setReq(null))
  }, [])
  const urgency = URGENCIES.find((u) => u.key === req?.urgency)?.label.toLowerCase()
  return (
    <section className="rounded-2xl border border-line bg-serum p-6">
      <h2 className="font-display text-xl font-semibold">Demande en cours</h2>
      {req === undefined && <p className="mt-4 text-muted">Chargement…</p>}
      {req === null && <p className="mt-4 text-muted">Aucune demande en cours.</p>}
      {req && (
        <div className="mt-4">
          <p className="font-display text-7xl font-bold leading-none text-primary">{show(req.group)}</p>
          <p className="mt-2 text-muted">{req.qty} unité{req.qty > 1 ? 's' : ''}, urgence {urgency}</p>
        </div>
      )}
      <Link to="/demandes/nouvelle" className="mt-5 block rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white hover:bg-primary-dark">
        Créer une demande
      </Link>
    </section>
  )
}

export function Home() {
  const { profile, orgName } = useProfile()
  const p = PROFILES[profile]
  const collect = profile === 'centre_transfusion' || profile === 'croissant_rouge'
  const wantsStocks = profile === 'hopital' || profile === 'banque_sang'
  const { list, error } = useStocks()
  const stocks = wantsStocks ? list : []
  const watch = (stocks ?? []).filter((s) => s.level !== 'vert').sort(bySeverity).slice(0, 4)
  const below = (stocks ?? []).filter((s) => s.level === 'rouge').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{orgName ?? p.org}</h1>
        <p className="text-muted">{p.tagline}</p>
      </div>

      {profile === 'hopital' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <CurrentRequest />
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Groupes à surveiller</h2>
            {stocks === null && <p className="text-muted">Chargement…</p>}
            {error && <p role="alert" className="text-primary-dark">Impossible de charger les stocks.</p>}
            {stocks && !error && watch.length === 0 && <p className="text-muted">Tous les groupes sont au-dessus de leur seuil.</p>}
            {watch.length > 0 && <StockGrid list={watch} />}
          </section>
        </div>
      )}

      {profile === 'banque_sang' && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">
            {below === 0 ? 'Aucun groupe sous le seuil' : `${below} groupe${below > 1 ? 's' : ''} sous le seuil`}
          </h2>
          {stocks === null && <p className="text-muted">Chargement…</p>}
          {error && <p role="alert" className="text-primary-dark">Impossible de charger les stocks.</p>}
          {stocks && <StockGrid list={stocks} />}
        </section>
      )}

      {collect && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Prochaines collectes</h2>
            <Link to="/collectes" className="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">
              Annoncer une collecte
            </Link>
          </div>
          <ul className="space-y-3">{events0.map((e) => <EventRow key={e.id} e={e} />)}</ul>
          {profile === 'croissant_rouge' && (
            <p className="mt-4 text-muted">{events0.reduce((n, e) => n + e.filled, 0)} volontaires déjà inscrits.</p>
          )}
        </section>
      )}
    </div>
  )
}

export function Stocks() {
  const { profile } = useProfile()
  const canAdd = profile === 'hopital' || profile === 'banque_sang'
  const { list, setList, error } = useStocks()
  const [group, setGroup] = useState<string>(GROUPS[0])
  const [qty, setQty] = useState(1)
  const [threshold, setThreshold] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) { setMsg({ ok: false, text: 'Indiquez entre 1 et 500 poches.' }); return }
    const t = threshold === '' ? undefined : Number(threshold)
    if (t !== undefined && (!Number.isInteger(t) || t < 1 || t > 1000)) { setMsg({ ok: false, text: 'Le seuil doit être entre 1 et 1000.' }); return }
    setBusy(true); setMsg(null)
    try {
      setList(await addStock({ bloodGroup: group, quantity: qty, alertThreshold: t }))
      setMsg({ ok: true, text: `${qty} poche${qty > 1 ? 's' : ''} ${show(group)} ajoutée${qty > 1 ? 's' : ''}.` })
      setQty(1); setThreshold('')
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setMsg({ ok: false, text: s === 403 ? "Votre établissement n'est pas autorisé à modifier ce stock."
        : s === 400 ? 'Valeurs refusées : vérifiez les champs.' : "Impossible d'ajouter le stock, réessayez." })
    } finally { setBusy(false) }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className={canAdd ? 'grid gap-6 lg:grid-cols-[1fr_1.6fr]' : ''}>
      {canAdd && (
        <form onSubmit={submit} noValidate className="h-fit space-y-3 rounded-2xl border border-line bg-serum p-6">
          <h2 className="font-display text-xl font-semibold">Ajouter du stock</h2>
          <label className="block text-sm">Groupe sanguin
            <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
              {GROUPS.map((g) => <option key={g} value={g}>{show(g)}</option>)}
            </select>
          </label>
          <label className="block text-sm">Poches à ajouter
            <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(e.target.valueAsNumber)} className={input} />
          </label>
          <label className="block text-sm">Nouveau seuil d'alerte (facultatif)
            <input type="number" min={1} max={1000} value={threshold} onChange={(e) => setThreshold(e.target.value)} className={input} />
          </label>
          {msg && <p role="alert" className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-primary-dark'}`}>{msg.text}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {busy ? 'Ajout…' : 'Ajouter au stock'}
          </button>
        </form>
      )}
      <section>
        <h1 className="mb-4 font-display text-2xl font-bold">Stocks par groupe</h1>
        {list === null && <p className="text-muted">Chargement…</p>}
        {error && <p role="alert" className="text-primary-dark">Impossible de charger les stocks.</p>}
        {list && list.length > 0 && <StockGrid list={list} />}
      </section>
    </div>
  )
}

export function Events() {
  const [list, setList] = useState(events0)
  const add = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const f = new FormData(ev.currentTarget)
    setList([...list, { id: crypto.randomUUID(), title: String(f.get('title')), place: String(f.get('place')),
      date: String(f.get('date')), filled: 0, capacity: Number(f.get('capacity')) }])
    ev.currentTarget.reset()
  }
  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={add} className="space-y-3 rounded-2xl border border-line bg-serum p-6">
        <h1 className="font-display text-xl font-semibold">Annoncer une collecte</h1>
        <label className="block text-sm">Titre<input name="title" required className={input} /></label>
        <label className="block text-sm">Lieu<input name="place" required className={input} /></label>
        <label className="block text-sm">Date<input name="date" type="date" required className={input} /></label>
        <label className="block text-sm">Capacité<input name="capacity" type="number" min={1} defaultValue={60} required className={input} /></label>
        <button type="submit" className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark">Publier la collecte</button>
      </form>
      <section><h2 className="mb-3 font-display text-xl font-semibold">Collectes annoncées</h2>
        <ul className="space-y-3">{list.map((e) => <EventRow key={e.id} e={e} />)}</ul></section>
    </div>
  )
}
