// Collectes : liste réelle (GET /events) et formulaire « Annoncer une collecte » (POST /events).
import { useState, type FormEvent } from 'react'
import { ApiError } from './api'
import type { EventItem } from './data'
import { createEvent, useEvents } from './events'

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function EventRow({ e }: { e: EventItem }) {
  const pct = Math.min(100, Math.round((e.filled / e.capacity) * 100))
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

export function Events() {
  const { list, setList, error } = useEvents()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const add = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const form = ev.currentTarget
    const f = new FormData(form)
    const capacity = Number(f.get('capacity'))
    if (!Number.isInteger(capacity) || capacity < 1) { setMsg({ ok: false, text: 'Capacité invalide.' }); return }
    setBusy(true); setMsg(null)
    try {
      const created = await createEvent({
        title: String(f.get('title')).trim(), place: String(f.get('place')).trim(), date: String(f.get('date')), capacity,
      })
      setList((cur) => [...(cur ?? []), created].sort((a, b) => a.date.localeCompare(b.date)))
      setMsg({ ok: true, text: 'Collecte publiée.' })
      form.reset()
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setMsg({ ok: false, text: s === 403 ? "Votre compte n'est pas autorisé à publier une collecte."
        : s === 400 || s === 422 ? `Valeurs refusées : ${(err as ApiError).message}` : 'Publication impossible, réessayez.' })
    } finally { setBusy(false) }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={add} className="h-fit space-y-3 rounded-2xl border border-line bg-serum p-6">
        <h1 className="font-display text-xl font-semibold">Annoncer une collecte</h1>
        <label className="block text-sm">Titre<input name="title" required className={input} /></label>
        <label className="block text-sm">Lieu<input name="place" required className={input} /></label>
        <label className="block text-sm">Date<input name="date" type="date" required className={input} /></label>
        <label className="block text-sm">Capacité<input name="capacity" type="number" min={1} defaultValue={60} required className={input} /></label>
        {msg && <p role="alert" className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-primary-dark'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {busy ? 'Publication…' : 'Publier la collecte'}
        </button>
      </form>
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Collectes annoncées</h2>
        {list === null && <p className="text-muted">Chargement…</p>}
        {error && <p role="alert" className="text-primary-dark">Impossible de charger les collectes.</p>}
        {list && !error && list.length === 0 && <p className="text-muted">Aucune collecte annoncée.</p>}
        <ul className="space-y-3">{list?.map((e) => <EventRow key={e.id} e={e} />)}</ul>
      </section>
    </div>
  )
}
