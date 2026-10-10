import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PROFILES, useProfile } from './profiles'
import { events0, level, stocks, type EventItem, type Stock } from './data'

function StockTile({ s }: { s: Stock }) {
  const l = level(s)
  const pct = Math.min(100, Math.round((s.qty / (s.threshold * 2)) * 100))
  return (
    <article className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-serum p-4">
      <div className={`absolute inset-x-0 bottom-0 opacity-20 ${l.fill}`} style={{ height: `${pct}%` }} aria-hidden="true" />
      <p className="relative font-display text-3xl font-bold leading-none">{s.group}</p>
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

function Ring({ done, total }: { done: number; total: number }) {
  const c = 2 * Math.PI * 44
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={`${done} unités couvertes sur ${total}`}>
      <circle cx="50" cy="50" r="44" fill="none" strokeWidth="9" className="stroke-primary-soft" />
      <circle cx="50" cy="50" r="44" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-primary"
        strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} />
    </svg>
  )
}

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
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{orgName ?? p.org}</h1>
        <p className="text-muted">{p.tagline}</p>
      </div>

      {profile === 'hopital' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <section className="rounded-2xl border border-line bg-serum p-6">
            <h2 className="font-display text-xl font-semibold">Demande en cours</h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-7xl font-bold leading-none text-primary">O−</p>
                <p className="mt-2 text-muted">4 unités, urgence critique</p>
              </div>
              <div className="relative shrink-0"><Ring done={3} total={4} />
                <p className="absolute inset-0 grid place-items-center font-display text-xl font-bold">3/4</p></div>
            </div>
            <p className="mt-4 text-sm"><span className="me-2 inline-block h-2 w-2 rounded-full bg-vein" />Donneur O− · 4 km · en route</p>
            <Link to="/demandes/nouvelle" className="mt-5 block rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white hover:bg-primary-dark">
              Créer une demande
            </Link>
          </section>
          <section><h2 className="mb-3 font-display text-xl font-semibold">Groupes à surveiller</h2>
            <StockGrid list={stocks.filter((s) => level(s).label !== 'Normal').slice(0, 4)} /></section>
        </div>
      )}

      {profile === 'banque_sang' && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">
            {stocks.filter((s) => level(s).label !== 'Normal').length} groupes sous le seuil
          </h2>
          <StockGrid list={stocks} />
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
  return <section><h1 className="mb-4 font-display text-2xl font-bold">Stocks par groupe</h1><StockGrid list={stocks} /></section>
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
