import { useState, type FormEvent } from 'react'
import { USE_MOCK, ApiError } from './api'
import { useAuth } from './authContext'
import { DEMO_ACCOUNTS } from './session'
import { Drop } from './Screen'
import PasswordInput from './PasswordInput'
import EcgLine from './components/EcgLine' // AJOUT : cardiogramme animé réutilisable

// AJOUT : anciens motifs ECG, gardés pour mémoire (remplacés par <EcgLine />)
// const ECG_BEAT = 'h8 q5 -10 10 0 h6 l3 4 l4 -34 l5 42 l3 -12 h8 q9 -13 18 0 h35 '
// const ECG_PATH = 'M0 35 ' + ECG_BEAT.repeat(8)

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
      {/* AJOUT : animations du panneau gauche (gouttes flottantes), désactivées si l'utilisateur réduit les animations */}
      <style>{`
        @keyframes login-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-18px) } }
        .login-float { animation: login-float 7s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .login-float { animation: none } }
      `}</style>
      {/* AJOUT : "relative overflow-hidden" pour positionner les décors derrière le contenu (avant : "flex flex-col justify-center bg-primary-dark p-10 text-white") */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-primary-dark p-10 text-white">
        {/* AJOUT : design 1 - gouttes de sang décoratives en arrière-plan */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Drop className="login-float absolute -right-10 top-10 h-56 w-56 text-primary opacity-20" />
          <Drop className="login-float absolute bottom-24 -left-8 h-40 w-40 text-white opacity-10 [animation-delay:-3s]" />
          <Drop className="login-float absolute right-1/4 bottom-6 h-24 w-24 text-primary opacity-30 [animation-delay:-5s]" />
        </div>

        <div className="relative z-10">
          <Drop className="drop-beat h-16 w-16 text-primary" />
          <h1 className="mt-4 font-display text-6xl font-bold">Damm <span className="ms-2 text-4xl text-white/70" lang="ar">دمّ</span></h1>
          <p className="mt-3 max-w-sm text-lg text-white/80">Chaque poche compte. Espace réservé aux établissements reconnus.</p>

          {/* AJOUT : design 2 - cardiogramme animé en boucle permanente (SVG + CSS pur).
              Avant (SVG qui défilait) :
              <div aria-hidden="true" className="mt-6 h-20 w-full max-w-sm overflow-hidden rounded-lg text-primary" style={{...grille + masque...}}>
                <svg viewBox="0 0 800 60" ... className="login-ecg-scroll h-full" style={{ width: '200%' }}>
                  <path d={ECG_PATH} ... className="login-ecg-glow" />
                </svg>
              </div> */}
          <EcgLine className="mt-6 max-w-sm" height={96} />

          {/* AJOUT : design 3 - 3 cartes d'info en verre dépoli */}
          <ul className="mt-8 hidden max-w-lg grid-cols-3 gap-3 sm:grid">
            <li className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" />
              </svg>
              <p className="mt-2 text-sm font-semibold">Demandes en temps réel</p>
            </li>
            <li className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" />
              </svg>
              <p className="mt-2 text-sm font-semibold">Donneurs en route</p>
            </li>
            <li className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
              <p className="mt-2 text-sm font-semibold">Stocks suivis</p>
            </li>
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          {/* AJOUT : nouveau titre (avant : <h2 ...>Connexion</h2>) */}
          <h2 className="font-display text-2xl font-semibold">Accéder à mon compte</h2>
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
