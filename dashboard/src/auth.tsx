import { useEffect, useState, type ReactNode } from 'react'
import { getTokens, setTokens } from './api'
import { AuthCtx } from './authContext'
import { fetchMe, login, type Me } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(() => getTokens() !== null)

  useEffect(() => {
    if (!getTokens()) return
    fetchMe().then(setUser).catch(() => setTokens(null)).finally(() => setLoading(false))
  }, [])

  const signIn = async (phone: string, password: string) => { await login(phone, password); setUser(await fetchMe()) }
  const reload = async () => setUser(await fetchMe())
  const signOut = () => { setTokens(null); setUser(null) }
  return <AuthCtx.Provider value={{ user, loading, signIn, reload, signOut }}>{children}</AuthCtx.Provider>
}