import { useEffect, useState } from 'react'
import { useAuth } from './authContext'
import {
  GOVERNORATES, SERVICE_KINDS, SYNC_ENABLED, newId, useHospitalProfile,
  type HospitalProfile, type ServiceKind,
} from './hospitalProfile'
import { useProfile } from './profiles'

const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
const card = 'rounded-2xl border border-line bg-white p-6'

// Accepte la virgule décimale (« 36,8065 ») : parseFloat la lirait à tort comme 36.
const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')))
const validLat = (n: number) => Number.isFinite(n) && Math.abs(n) <= 90
const validLng = (n: number) => Number.isFinite(n) && Math.abs(n) <= 180

function coordsError(lat: string, lng: string): string | null {
  const empty = (s: string) => s.trim() === ''
  if (empty(lat) && empty(lng)) return null
  if (empty(lat) || empty(lng)) return 'Renseignez la latitude et la longitude ensemble.'
  if (!validLat(toNum(lat)) || !validLng(toNum(lng))) {
    return 'Coordonnées invalides : latitude entre -90 et 90, longitude entre -180 et 180.'
  }
  return null
}

function MapPreview({ lat, lng }: { lat: string; lng: string }) {
  const a = toNum(lat), o = toNum(lng)
  if (!validLat(a) || !validLng(o)) {
    return <p className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-muted">Ajoutez les coordonnées pour voir l'emplacement.</p>
  }
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${o - 0.01},${a - 0.006},${o + 0.01},${a + 0.006}&layer=mapnik&marker=${a},${o}`
  return (
    <div>
      <iframe title="Emplacement de l'établissement" src={src} className="h-64 w-full rounded-xl border border-line" loading="lazy" referrerPolicy="no-referrer" />
      <a href={`https://www.openstreetmap.org/?mlat=${a}&mlon=${o}#map=17/${a}/${o}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-primary hover:underline">
        Ouvrir dans OpenStreetMap
      </a>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const ctx = useProfile()
  const current = ctx.profile, orgName = ctx.orgName
  const inst = user?.institution
  if (!inst) return <p className="text-lg text-muted">Aucun établissement n'est rattaché à ce compte.</p>
  if (current !== 'hopital') {
    return <p className="text-lg text-muted">Cette page de profil est réservée aux hôpitaux (profil affiché : {current}).</p>
  }
  return <Editor key={inst.id} institutionId={inst.id} name={orgName ?? inst.name} />
}

function Editor({ institutionId, name }: { institutionId: string; name: string }) {
  const { profile: saved, save } = useHospitalProfile(institutionId)
  const [d, setD] = useState<HospitalProfile>(saved)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [geoErr, setGeoErr] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const coordErr = coordsError(d.location.lat, d.location.lng)

  // Prévient avant de quitter la page avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setLoc = (k: keyof HospitalProfile['location'], v: string) => setD({ ...d, location: { ...d.location, [k]: v } })

  const locate = () => {
    setGeoErr(null)
    if (!navigator.geolocation) return setGeoErr("La géolocalisation n'est pas disponible sur ce navigateur.")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        setD((x) => ({ ...x, location: { ...x.location, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) } }))
      },
      () => {
        setLocating(false)
        setGeoErr("Position refusée ou indisponible. Saisissez les coordonnées à la main.")
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async () => {
    if (coordErr) return setErr(coordErr)
    setErr(null)
    setMsg(null)
    setSaving(true)
    const lat = toNum(d.location.lat), lng = toNum(d.location.lng)
    const cleaned: HospitalProfile = {
      ...d,
      // coordonnées normalisées en notation décimale à point, 5 décimales (environ 1 m)
      location: { ...d.location, lat: Number.isFinite(lat) ? lat.toFixed(5) : '', lng: Number.isFinite(lng) ? lng.toFixed(5) : '' },
      rooms: d.rooms.filter((r) => r.name.trim()),
      services: d.services.filter((s) => s.name.trim()),
    }
    try {
      await save(cleaned)
      setD(cleaned)
      setMsg(SYNC_ENABLED ? 'Profil enregistré.' : "Profil enregistré sur cet appareil. La synchronisation avec le serveur sera activée dès que l'endpoint sera disponible.")
    } catch {
      setErr("L'enregistrement a échoué. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <h1 className="font-display text-4xl font-bold leading-tight">Profil de {name}</h1>
        <p className="mt-2 text-lg text-muted">
          Ces informations disent à la banque de sang où livrer et pour quels services vous demandez du sang. Aucune donnée de patient n'est enregistrée ici.
        </p>
      </section>

      <section className={card}>
        <h2 className="font-display text-2xl font-bold">Emplacement</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium md:col-span-2">Adresse
            <input value={d.location.address} onChange={(e) => setLoc('address', e.target.value)} className={input} />
          </label>
          <label className="block text-sm font-medium">Ville
            <input value={d.location.city} onChange={(e) => setLoc('city', e.target.value)} className={input} />
          </label>
          <label className="block text-sm font-medium">Gouvernorat
            <select value={d.location.governorate} onChange={(e) => setLoc('governorate', e.target.value)} className={input}>
              <option value="">Choisir</option>
              {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium md:col-span-2">Point de livraison des poches
            <input value={d.location.deliveryPoint} onChange={(e) => setLoc('deliveryPoint', e.target.value)} placeholder="Ex. entrée des urgences, rez-de-chaussée" className={input} />
          </label>
          <label className="block text-sm font-medium">Latitude
            <input value={d.location.lat} onChange={(e) => setLoc('lat', e.target.value)} inputMode="decimal" autoComplete="off" placeholder="36,8065" className={input} />
          </label>
          <label className="block text-sm font-medium">Longitude
            <input value={d.location.lng} onChange={(e) => setLoc('lng', e.target.value)} inputMode="decimal" autoComplete="off" placeholder="10,1815" className={input} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={locate} disabled={locating} className="rounded-lg border border-primary px-4 py-2 font-bold text-primary hover:bg-primary-soft disabled:opacity-50">
            {locating ? 'Localisation…' : 'Utiliser ma position actuelle'}
          </button>
          {geoErr && <p role="alert" className="text-sm text-primary-dark">{geoErr}</p>}
        </div>
        {coordErr && <p role="alert" className="mt-2 text-sm text-primary-dark">{coordErr}</p>}
        <div className="mt-4"><MapPreview lat={d.location.lat} lng={d.location.lng} /></div>
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Blocs opératoires</h2>
          <button type="button" onClick={() => setD({ ...d, rooms: [...d.rooms, { id: newId(), name: '', specialty: '' }] })} className="font-bold text-primary hover:underline">Ajouter un bloc</button>
        </div>
        {d.rooms.length === 0 && <p className="mt-4 text-muted">Aucun bloc déclaré. Ajoutez ceux qui peuvent faire une demande de sang.</p>}
        <ul className="mt-4 space-y-3">
          {d.rooms.map((r) => (
            <li key={r.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="block text-sm font-medium">Nom du bloc
                <input value={r.name} onChange={(e) => setD({ ...d, rooms: d.rooms.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x) })} className={input} />
              </label>
              <label className="block text-sm font-medium">Spécialité
                <input value={r.specialty} onChange={(e) => setD({ ...d, rooms: d.rooms.map((x) => x.id === r.id ? { ...x, specialty: e.target.value } : x) })} className={input} />
              </label>
              <button type="button" onClick={() => setD({ ...d, rooms: d.rooms.filter((x) => x.id !== r.id) })} aria-label={`Retirer ${r.name || 'ce bloc'}`} className="rounded-lg border border-line px-3 py-2.5 font-bold text-muted hover:border-primary hover:text-primary">Retirer</button>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Services concernés par les demandes de sang</h2>
          <button type="button" onClick={() => setD({ ...d, services: [...d.services, { id: newId(), name: '', kind: 'autre' }] })} className="font-bold text-primary hover:underline">Ajouter un service</button>
        </div>
        {d.services.length === 0 && <p className="mt-4 text-muted">Aucun service déclaré.</p>}
        <ul className="mt-4 space-y-3">
          {d.services.map((s) => (
            <li key={s.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="block text-sm font-medium">Nom du service
                <input value={s.name} onChange={(e) => setD({ ...d, services: d.services.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })} className={input} />
              </label>
              <label className="block text-sm font-medium">Type
                <select value={s.kind} onChange={(e) => setD({ ...d, services: d.services.map((x) => x.id === s.id ? { ...x, kind: e.target.value as ServiceKind } : x) })} className={input}>
                  {SERVICE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setD({ ...d, services: d.services.filter((x) => x.id !== s.id) })} aria-label={`Retirer ${s.name || 'ce service'}`} className="rounded-lg border border-line px-3 py-2.5 font-bold text-muted hover:border-primary hover:text-primary">Retirer</button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center gap-4 border-t border-line bg-plasma/95 px-2 py-4 backdrop-blur">
        <button onClick={submit} disabled={!dirty || saving || coordErr !== null} className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
        </button>
        {err && <span role="alert" className="text-primary-dark">{err}</span>}
        {!err && (dirty ? <span className="text-muted">Modifications non enregistrées</span> : msg && <span role="status" className="text-muted">{msg}</span>)}
      </div>
    </div>
  )
  
}