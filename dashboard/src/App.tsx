import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
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

// Filet de sécurité : affiche l'erreur à l'écran au lieu d'une page blanche.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Erreur d'affichage :", error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-primary-dark">Une erreur est survenue</h1>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-primary-soft p-4 text-sm">{this.state.error.message}</pre>
        <button className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-white"
          onClick={() => { sessionStorage.clear(); location.reload() }}>Vider la session et recharger</button>
      </div>
    )
  }
}

function Dashboard({ first, orgName }: { first: ProfileKey; orgName: string }) {
  const [profile, setProfile] = useState<ProfileKey>(first)
  return (
    <ProfileCtx.Provider value={{ profile, setProfile, orgName: profile === first ? orgName : undefined }}>
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
  return <Dashboard key={user.id} first={profileFor(user.role, inst.type)} orgName={inst.name} />
}

export default function App() {
  return <ErrorBoundary><AuthProvider><Gate /></AuthProvider></ErrorBoundary>
}