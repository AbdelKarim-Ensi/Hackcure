// Collectes : liste réelle (GET /events) et formulaire « Annoncer une collecte » (POST /events).
import { useEffect, useState, type FormEvent } from 'react' // AJOUT : useEffect pour la touche Échap
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
  const [showForm, setShowForm] = useState(false) // AJOUT : true = pop-up ouvert

  // AJOUT : fermeture du pop-up avec la touche Échap (sauf pendant la publication)
  useEffect(() => {
    if (!showForm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setShowForm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showForm, busy])

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
      setShowForm(false) // AJOUT : on referme le pop-up après la publication
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setMsg({ ok: false, text: s === 403 ? "Votre compte n'est pas autorisé à publier une collecte."
        : s === 400 || s === 422 ? `Valeurs refusées : ${(err as ApiError).message}` : 'Publication impossible, réessayez.' })
    } finally { setBusy(false) }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className="space-y-6">
      {/* AJOUT : en-tête avec le bouton qui ouvre le pop-up */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Collectes annoncées</h2>
        <button type="button" onClick={() => { setMsg(null); setShowForm(true) }}
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">
          Annoncer une collecte
        </button>
      </div>
      {/* AJOUT : message de succès visible quand le pop-up est fermé */}
      {!showForm && msg?.ok && <p role="status" className="text-sm font-medium text-success">{msg.text}</p>}

      {/* AJOUT : la liste prend toute la largeur (avant : grille form + liste) */}
      <section>
        {list === null && <p className="text-muted">Chargement…</p>}
        {error && <p role="alert" className="text-primary-dark">Impossible de charger les collectes.</p>}
        {list && !error && list.length === 0 && <p className="text-muted">Aucune collecte annoncée.</p>}
        <ul className="space-y-3">{list?.map((e) => <EventRow key={e.id} e={e} />)}</ul>
      </section>

      {/* AJOUT : pop-up (modal) contenant le formulaire. Fond sombre ; un clic dessus ferme le pop-up. */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setShowForm(false) }}
        >
          <form
            onSubmit={add}
            role="dialog" aria-modal="true" aria-labelledby="collecte-titre"
            className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-line bg-serum p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h1 id="collecte-titre" className="font-display text-xl font-semibold">Annoncer une collecte</h1>
              <button type="button" onClick={() => setShowForm(false)} disabled={busy} aria-label="Fermer"
                className="rounded-lg px-2 py-1 text-xl leading-none text-muted hover:bg-line/50 disabled:opacity-50">×</button>
            </div>
            <label className="block text-sm">Titre<input name="title" required autoFocus className={input} /></label>
            <label className="block text-sm">Lieu<input name="place" required className={input} /></label>
            <label className="block text-sm">Date<input name="date" type="date" required className={input} /></label>
            <label className="block text-sm">Capacité<input name="capacity" type="number" min={1} defaultValue={60} required className={input} /></label>
            {msg && !msg.ok && <p role="alert" className="text-sm font-medium text-primary-dark">{msg.text}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)} disabled={busy}
                className="w-1/3 rounded-xl border border-line px-4 py-3 font-semibold text-muted hover:bg-line/50 disabled:opacity-60">
                Annuler
              </button>
              <button type="submit" disabled={busy} className="w-2/3 rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
                {busy ? 'Publication…' : 'Publier la collecte'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
