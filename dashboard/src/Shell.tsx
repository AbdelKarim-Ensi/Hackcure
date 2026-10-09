import { NavLink, Outlet } from 'react-router-dom'
import { USE_MOCK } from './api'
import { useAuth } from './authContext'
import { PROFILES, useProfile, type ProfileKey } from './profiles'

export default function Shell() {
  const { profile, setProfile, orgName } = useProfile()
  const { user, logout } = useAuth() // si `logout` n'existe pas, voir la note 1 ci-dessous
  const p = PROFILES[profile]
  const displayName = orgName ?? p.org

  return (
    <div className="flex min-h-screen bg-plasma text-ink">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line p-4">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">{p.label}</p>
          <h1 className="text-lg font-bold">{displayName}</h1>
          <p className="mt-1 text-sm text-muted">{p.tagline}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {p.nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary text-white' : 'hover:bg-line/50'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {USE_MOCK && (
          <label className="mt-4 block text-xs text-muted">
            Profil (démo)
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as ProfileKey)}
              className="mt-1 w-full rounded-lg border border-line bg-plasma px-2 py-1 text-sm text-ink"
            >
              {(Object.keys(PROFILES) as ProfileKey[]).map((k) => (
                <option key={k} value={k}>{PROFILES[k].label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 border-t border-line pt-3 text-sm">
          <p className="truncate text-muted">{user?.fullName ?? user?.phone}</p>
          <button onClick={logout} className="mt-1 font-semibold text-primary hover:underline">
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}