// Page de modification du stock d'un groupe sanguin : boutons + et − avec un pas réglable.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from './api'
import { GROUPS, show } from './requests'
import { adjustStock, LEVELS, useStocks } from './stocks'

export default function StockEdit() {
  const { group = '' } = useParams()
  const { list, setList, error } = useStocks()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const valid = (GROUPS as readonly string[]).includes(group)
  const stock = list?.find((s) => s.group === group)
  const stepOk = Number.isInteger(step) && step >= 1 && step <= 500

  const apply = async (sign: 1 | -1) => {
    if (!stepOk) { setMsg({ ok: false, text: 'Indiquez un pas entre 1 et 500.' }); return }
    setBusy(true); setMsg(null)
    try {
      setList(await adjustStock(group, sign * step))
      setMsg({ ok: true, text: `${step} poche${step > 1 ? 's' : ''} ${sign > 0 ? 'ajoutée' : 'retirée'}${step > 1 ? 's' : ''}.` })
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0
      setMsg({ ok: false, text: s === 403 ? "Votre établissement n'est pas autorisé à modifier ce stock."
        : s === 400 ? (err as ApiError).message : 'Modification impossible, réessayez.' })
    } finally { setBusy(false) }
  }

  const back = <Link to="/stocks" className="text-sm font-semibold text-primary hover:underline">← Retour aux stocks</Link>
  if (!valid) return <div className="space-y-4">{back}<p className="text-muted">Groupe sanguin inconnu.</p></div>
  if (list === null) return <p className="text-muted">Chargement…</p>
  if (error || !stock) return <div className="space-y-4">{back}<p role="alert" className="text-primary-dark">Impossible de charger ce stock.</p></div>

  const l = LEVELS[stock.level]
  const btn = 'h-16 w-16 rounded-2xl text-3xl font-bold text-white disabled:opacity-40'
  return (
    <div className="mx-auto max-w-md space-y-6">
      {back}
      <section className="space-y-6 rounded-2xl border border-line bg-serum p-6 text-center">
        <h1 className="font-display text-xl font-semibold">Modifier le stock</h1>
        <p className="font-display text-6xl font-bold leading-none text-primary">{show(stock.group)}</p>
        <div className="flex items-center justify-center gap-6">
          <button type="button" aria-label={`Retirer ${step}`} disabled={busy || !stepOk || stock.qty - step < 0}
            onClick={() => apply(-1)} className={`${btn} bg-primary-dark hover:bg-primary`}>−</button>
          <div>
            <p className="font-display text-5xl font-bold leading-none">{stock.qty}</p>
            <p className="mt-1 text-sm text-muted">poches · seuil {stock.threshold}</p>
          </div>
          <button type="button" aria-label={`Ajouter ${step}`} disabled={busy || !stepOk}
            onClick={() => apply(1)} className={`${btn} bg-primary hover:bg-primary-dark`}>+</button>
        </div>
        <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-semibold ${l.badge}`}>{l.label}</span>
        <label className="block text-sm">Poches par clic
          <input type="number" min={1} max={500} value={Number.isNaN(step) ? '' : step}
            onChange={(e) => setStep(e.target.valueAsNumber)}
            className="mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2 text-center" />
        </label>
        {msg && <p role="alert" className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-primary-dark'}`}>{msg.text}</p>}
      </section>
    </div>
  )
}
