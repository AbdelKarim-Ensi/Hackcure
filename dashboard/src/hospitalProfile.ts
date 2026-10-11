import { useCallback, useState } from 'react'
import { USE_MOCK } from './api'

export type OperatingRoom = { id: string; name: string; specialty: string }
export type ServiceKind = 'urgences' | 'reanimation' | 'chirurgie' | 'maternite' | 'pediatrie' | 'hemato_onco' | 'medecine' | 'autre'
export type HospitalService = { id: string; name: string; kind: ServiceKind }
export type HospitalLocation = {
  address: string; city: string; governorate: string
  lat: string; lng: string // chaînes pour la saisie ; converties à l'affichage de la carte
  deliveryPoint: string // où livrer les poches (ex. entrée des urgences)
}
export type HospitalProfile = { location: HospitalLocation; rooms: OperatingRoom[]; services: HospitalService[] }

export const SERVICE_KINDS: { value: ServiceKind; label: string }[] = [
  { value: 'urgences', label: 'Urgences' },
  { value: 'reanimation', label: 'Réanimation' },
  { value: 'chirurgie', label: 'Chirurgie' },
  { value: 'maternite', label: 'Maternité' },
  { value: 'pediatrie', label: 'Pédiatrie' },
  { value: 'hemato_onco', label: 'Hématologie / oncologie' },
  { value: 'medecine', label: 'Médecine' },
  { value: 'autre', label: 'Autre' },
]

export const GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Kef', 'Mahdia',
  'Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
]

export const newId = () => Math.random().toString(36).slice(2, 8)

const EMPTY: HospitalProfile = {
  location: { address: '', city: '', governorate: '', lat: '', lng: '', deliveryPoint: '' },
  rooms: [], services: [],
}

// Exemple affiché uniquement en mode démo (aucune donnée de patient).
const DEMO: HospitalProfile = {
  location: { address: 'Boulevard 9 Avril 1938', city: 'Tunis', governorate: 'Tunis', lat: '36.8025', lng: '10.1726', deliveryPoint: "Entrée des urgences, côté rue Djebel Lakhdar" },
  rooms: [
    { id: 'b1', name: 'Bloc A', specialty: 'Chirurgie générale' },
    { id: 'b2', name: 'Bloc B', specialty: 'Chirurgie cardiaque' },
    { id: 'b3', name: 'Bloc obstétrical', specialty: 'Obstétrique' },
  ],
  services: [
    { id: 's1', name: 'Urgences', kind: 'urgences' },
    { id: 's2', name: 'Réanimation chirurgicale', kind: 'reanimation' },
    { id: 's3', name: 'Maternité', kind: 'maternite' },
    { id: 's4', name: 'Hématologie', kind: 'hemato_onco' },
  ],
}

const key = (institutionId: string) => `damm.hospital-profile.${institutionId}`

function load(institutionId: string): HospitalProfile {
  try {
    const raw = localStorage.getItem(key(institutionId))
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<HospitalProfile>) }
  } catch { /* stockage indisponible : on retombe sur les valeurs par défaut */ }
  return USE_MOCK ? structuredClone(DEMO) : structuredClone(EMPTY)
}

// À BRANCHER avec M1 quand l'endpoint existera (ex. PUT /institutions/{id}/profile).
// Tant que SYNC_ENABLED est false, le profil reste sur cet appareil.
export const SYNC_ENABLED = false
async function pushToServer(_institutionId: string, _p: HospitalProfile): Promise<void> {
  // await api(`/institutions/${_institutionId}/profile`, { method: 'PUT', body: JSON.stringify(_p) })
}

export function useHospitalProfile(institutionId: string) {
  const [saved, setSaved] = useState<HospitalProfile>(() => load(institutionId))
  const save = useCallback(async (p: HospitalProfile) => {
    localStorage.setItem(key(institutionId), JSON.stringify(p))
    if (SYNC_ENABLED) await pushToServer(institutionId, p)
    setSaved(p)
  }, [institutionId])
  return { profile: saved, save }
}