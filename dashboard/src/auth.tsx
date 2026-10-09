import { useEffect, useState, type ReactNode } from 'react'
import { getTokens } from './api'
import { AuthCtx } from './authContext'
import { clearSession, fetchMe, login, type Me } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(() => getTokens() !== null)

  useEffect(() => {
    if (!getTokens()) return
    fetchMe().then(setUser).catch(() => clearSession()).finally(() => setLoading(false))
  }, [])

  const signIn = async (phone: string, password: string) => {
    const me = await login(phone, password)   // le backend renvoie l'utilisateur au login
    setUser(me ?? (await fetchMe()))          // sinon on le recharge via /users/me
  }
  const reload = async () => setUser(await fetchMe())
  const signOut = () => { clearSession(); setUser(null) }
  return <AuthCtx.Provider value={{ user, loading, signIn, reload, signOut }}>{children}</AuthCtx.Provider>
}