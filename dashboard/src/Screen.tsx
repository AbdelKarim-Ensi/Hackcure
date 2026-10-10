import type { ReactNode } from 'react'
import { useAuth } from './authContext'

export function Drop({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5z" />
    </svg>
  )
}

export default function Screen({ title, children }: { title: string; children: ReactNode }) {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between bg-primary-dark px-6 py-4 text-white">
        <p className="flex items-center gap-2 font-display text-2xl font-bold"><Drop className="h-7 w-7 text-primary" />Damm</p>
        {user && <button onClick={signOut} className="rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/20">Se déconnecter</button>}
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}