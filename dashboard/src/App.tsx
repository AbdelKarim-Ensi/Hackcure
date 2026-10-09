import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Admin from './Admin'
import { AuthProvider } from './auth'
import { useAuth } from './authContext'
import { Declare, NotForWeb, Pending, Rejected } from './Gate'
import Login from './Login'
import { ProfileCtx, profileFor, type ProfileKey } from './profiles'
import Shell from './Shell'
import NewRequest from './NewRequest'
import { Events, Home, Stocks } from './pages'
import { Requests } from './RequestsPage'

function Dashboard({ first }: { first: ProfileKey }) {
  const [profile, setProfile] = useState<ProfileKey>(first)
  return (
    <ProfileCtx.Provider value={{ profile, setProfile }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="demandes" element={<Requests />} />
            <Route path="demandes/nouvelle" element={<NewRequest />} />
            <Route path="stocks" element={<Stocks />} />
            <Route path="collectes" element={<Events />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProfileCtx.Provider>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-muted">Chargement…</p>
  if (!user) return <Login />
  if (user.role === 'admin') return <Admin />
  if (user.role === 'donneur') return <NotForWeb />
  const inst = user.institution
  if (!inst) return <Declare />
  if (inst.validationStatus === 'en_attente') return <Pending name={inst.name} />
  if (inst.validationStatus === 'rejete') return <Rejected name={inst.name} />
  return <Dashboard key={user.id} first={profileFor(user.role, inst.type)} />
}

export default function App() {
  return <AuthProvider><Gate /></AuthProvider>
}