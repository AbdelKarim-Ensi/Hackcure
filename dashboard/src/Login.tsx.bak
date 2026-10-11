import { useState, type FormEvent } from 'react'
import { USE_MOCK, ApiError } from './api'
import { useAuth } from './authContext'
import { DEMO_ACCOUNTS } from './session'
import { Drop } from './Screen'
import PasswordInput from './PasswordInput'


export default function Login() {
  const { signIn } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { await signIn(phone.replace(/\s/g, ''), password) }
    catch (err) {
      // AJOUT : fix login - on distingue identifiants faux / compte bloqué / trop d'essais (avant : tout 401 = "mot de passe incorrect")
      setError(
        err instanceof ApiError && err.status === 429 ? 'Trop de tentatives, réessayez dans une minute.'
        : err instanceof ApiError && err.status === 401 && /suspendu|vérifié/i.test(err.message) ? err.message
        : err instanceof ApiError && err.status === 401 ? 'Téléphone ou mot de passe incorrect.'
        : 'Connexion impossible, réessayez.')
    } finally { setBusy(false) }
  }
  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-center bg-primary-dark p-10 text-white">
        <Drop className="drop-beat h-16 w-16 text-primary" />
        <h1 className="mt-4 font-display text-6xl font-bold">Damm <span className="ms-2 text-4xl text-white/70" lang="ar">دمّ</span></h1>
        <p className="mt-3 max-w-sm text-lg text-white/80">Chaque poche compte. Espace réservé aux établissements reconnus.</p>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="font-display text-2xl font-semibold">Connexion</h2>
          <label className="block text-sm">Téléphone fixe de l'établissement
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required placeholder="+216 71 000 000" className={input} /></label>
          <label className="block text-sm">Mot de passe
           
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className={input} required autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="rounded-md bg-primary-soft px-3 py-2 text-sm font-medium text-primary-dark">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
            {busy ? 'Connexion…' : 'Se connecter'}</button>
          {USE_MOCK && (
            <div className="rounded-xl border border-line bg-serum p-3 text-sm">
              <p className="font-semibold">Mode démo (mot de passe Demo1234!)</p>
              <ul className="mt-1 space-y-1">{DEMO_ACCOUNTS.map((a) => (
                <li key={a.phone}><button type="button" onClick={() => { setPhone(a.phone); setPassword('Demo1234!') }}
                  className="text-primary-dark underline">{a.phone}</button> <span className="text-muted">{a.role}, {a.label}</span></li>))}
              </ul>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}