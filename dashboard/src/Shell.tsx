import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { USE_MOCK } from './api'
import { useAuth } from './authContext'
import { PROFILES, useProfile, type ProfileKey } from './profiles'

export default function Shell() {
  const { profile, setProfile, orgName } = useProfile()
  const { user, signOut } = useAuth() // `signOut` (et non `logout`) : c'est le nom exposé par AuthCtx
  const { pathname } = useLocation()
  const p = PROFILES[profile]
  const displayName = orgName ?? p.org

  // Ouverte par défaut sur grand écran, fermée sur mobile
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  // Sur mobile, on referme la sidebar après chaque navigation
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) setOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-plasma text-ink">
      {/* Fond sombre derrière la sidebar sur mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-plasma p-4 transition-transform duration-200 lg:static lg:z-auto lg:shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full lg:hidden'
        }`}
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">{p.label}</p>
          <p className="text-lg font-bold">{displayName}</p>
          <p className="mt-1 text-sm text-muted">{p.tagline}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {p.nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `cursor-pointer rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary text-white' : 'hover:bg-line/50'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {USE_MOCK && (
          <label className="mt-4 block cursor-pointer text-xs text-muted">
            Profil (démo)
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as ProfileKey)}
              className="mt-1 w-full cursor-pointer rounded-lg border border-line bg-plasma px-2 py-1 text-sm text-ink"
            >
              {(Object.keys(PROFILES) as ProfileKey[]).map((k) => (
                <option key={k} value={k}>{PROFILES[k].label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 border-t border-line pt-3 text-sm">
          <p className="truncate text-muted">{user?.fullName ?? user?.phone}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 cursor-pointer font-semibold text-primary hover:underline"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            aria-controls="sidebar"
            className="cursor-pointer rounded-lg p-2 hover:bg-line/50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-lg font-bold">Damm</span>
        </div>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
