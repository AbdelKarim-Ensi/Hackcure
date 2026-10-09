import { createContext, useContext } from 'react'
import type { Me } from './session'

export type AuthValue = {
  user: Me | null; loading: boolean
  signIn: (phone: string, password: string) => Promise<void>
  reload: () => Promise<void>; signOut: () => void
}
export const AuthCtx = createContext<AuthValue>({
  user: null, loading: false, signIn: async () => {}, reload: async () => {}, signOut: () => {},
})
export const useAuth = () => useContext(AuthCtx)