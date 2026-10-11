// Collectes : liste réelle (GET /events) et formulaire « Annoncer une collecte » (POST /events).
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import type { EventItem } from './data'
import { createEvent, deleteEvent, useEvents } from './events' // AJOUT : deleteEvent

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// AJOUT : onDelete optionnel, affiche l'icône poubelle en haut à droite de la carte
function EventRow({ e, onDelete }: { e: EventItem; onDelete?: (e: EventItem) => void }) {
  const pct = Math.min(100, Math.round((e.filled / e.capacity) * 100))
  return (
    <li className="relative rounded-2xl border border-line bg-serum p-5">
      {/* AJOUT : icône supprimer (avant : <div className="flex flex-wrap items-baseline justify-between gap-2"> sans pr-10) */}
      {onDelete && (
        <button type="button" onClick={() => onDelete(e)} aria-label={`Supprimer la collecte ${e.title}`} title="Supprimer"
          className="absolute right-3 top-3 cursor-pointer rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-primary">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6" />
          </svg>
        </button>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 pr-10">
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
  const [showForm, setShowForm] = useState(false) // true = pop-up ouvert
  const [toDelete, setToDelete] = useState<EventItem | null>(null) // AJOUT : collecte en attente de confirmation
  const [deleting, setDeleting] = useState(false) // AJOUT
  const [delErr, setDelErr] = useState<string | null>(null) // AJOUT

  // Fermeture du pop-up avec la touche Échap (sauf pendant la publication)
  useEffect(() => {
    if (!showForm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setShowForm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showForm, busy])

  // AJOUT : Échap ferme aussi la confirmation de suppression
  useEffect(() => {
    if (!toDelete) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) setToDelete(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toDelete, deleting])

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
      setShowForm(false)
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setMsg({ ok: false, text: s === 403 ? "Votre compte n'est pas autorisé à publier une collecte."
        : s === 400 || s === 422 ? `Valeurs refusées : ${(err as ApiError).message}` : 'Publication impossible, réessayez.' })
    } finally { setBusy(false) }
  }

  // AJOUT : confirme puis supprime la collecte, qui disparaît tout de suite de la liste
  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true); setDelErr(null)
    try {
      await deleteEvent(toDelete.id)
      setList((cur) => (cur ?? []).filter((x) => x.id !== toDelete.id))
      setMsg({ ok: true, text: `Collecte « ${toDelete.title} » supprimée.` })
      setToDelete(null)
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setDelErr(s === 403 ? "Seul l'organisateur de cette collecte peut la supprimer."
        : s === 404 ? 'Cette collecte n\'existe plus.'
        : s === 409 ? "Cette collecte n'est plus ouverte."
        : 'Suppression impossible, réessayez.')
    } finally { setDeleting(false) }
  }

  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Collectes annoncées</h2>
        <button type="button" onClick={() => { setMsg(null); setShowForm(true) }}
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">
          Annoncer une collecte
        </button>
      </div>
      {!showForm && msg?.ok && <p role="status" className="text-sm font-medium text-success">{msg.text}</p>}

      <section>
        {list === null && <p className="text-muted">Chargement…</p>}
        {error && <p role="alert" className="text-primary-dark">Impossible de charger les collectes.</p>}
        {list && !error && list.length === 0 && <p className="text-muted">Aucune collecte annoncée.</p>}
        {/* AJOUT : onDelete branché (avant : <EventRow key={e.id} e={e} />) */}
        <ul className="space-y-3">{list?.map((e) => <EventRow key={e.id} e={e} onDelete={(x) => { setDelErr(null); setToDelete(x) }} />)}</ul>
      </section>

      {/* Pop-up du formulaire */}
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

      {/* AJOUT : pop-up de confirmation de suppression */}
      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setToDelete(null) }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="suppr-titre"
            className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-serum p-6 shadow-xl">
            <h1 id="suppr-titre" className="font-display text-xl font-semibold">Supprimer cette collecte ?</h1>
            <p className="text-sm">
              <span className="font-semibold">{toDelete.title}</span> ({fmt(toDelete.date)}) sera retirée de la liste.
              {toDelete.filled > 0 && <> {toDelete.filled} donneur{toDelete.filled > 1 ? 's sont' : ' est'} déjà inscrit{toDelete.filled > 1 ? 's' : ''}.</>}
            </p>
            {delErr && <p role="alert" className="text-sm font-medium text-primary-dark">{delErr}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setToDelete(null)} disabled={deleting} autoFocus
                className="w-1/2 rounded-xl border border-line px-4 py-3 font-semibold text-muted hover:bg-line/50 disabled:opacity-60">
                Annuler
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting}
                className="w-1/2 rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
