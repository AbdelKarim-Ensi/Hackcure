import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import CurrentRequest from './CurrentRequest'
import { PROFILES, useProfile } from './profiles'
import { events0, type EventItem } from './data'
import { show } from './requests'
import { bySeverity, LEVELS, useStocks, type Stock } from './stocks'

function StockTile({ s, editable }: { s: Stock; editable?: boolean }) {
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
        {editable && (
          <Link to={`/stocks/${encodeURIComponent(s.group)}`}
            className="block rounded-lg bg-primary px-3 py-1.5 text-center text-sm font-semibold text-white hover:bg-primary-dark">
            Modifier
          </Link>
        )}
      </div>
    </article>
  )
}
const StockGrid = ({ list, editable }: { list: Stock[]; editable?: boolean }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4">
    {list.map((s) => <StockTile key={s.group} s={s} editable={editable} />)}
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
  const canEdit = profile === 'hopital' || profile === 'banque_sang'
  const { list, error } = useStocks()
  return (
    <section>
      <h1 className="mb-4 font-display text-2xl font-bold">Stocks par groupe</h1>
      {list === null && <p className="text-muted">Chargement…</p>}
      {error && <p role="alert" className="text-primary-dark">Impossible de charger les stocks.</p>}
      {list && list.length > 0 && <StockGrid list={list} editable={canEdit} />}
    </section>
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
