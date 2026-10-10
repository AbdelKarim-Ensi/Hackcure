import { createContext, useContext } from 'react'

export type ProfileKey = 'hopital' | 'banque_sang' | 'centre_transfusion' | 'croissant_rouge'
type NavItem = { to: string; label: string }

const ACCUEIL = { to: '/', label: 'Accueil' }
const DEMANDES = { to: '/demandes', label: 'Demandes de sang' }
const STOCKS = { to: '/stocks', label: 'Stocks' }
const COLLECTES = { to: '/collectes', label: 'Collectes' }
const PROFIL = { to: '/profil', label: 'Profil' }

export const PROFILES: Record<ProfileKey, { label: string; org: string; tagline: string; nav: NavItem[] }> = {
  hopital: {
    label: 'Hôpital', org: 'CHU Charles Nicolle',
    tagline: 'Demandez du sang et suivez les donneurs en route.',
    nav: [ACCUEIL, DEMANDES, STOCKS, PROFIL],
  },
  banque_sang: {
    label: 'Banque de sang', org: 'Banque de sang de La Rabta',
    tagline: 'Gardez chaque groupe au-dessus de son seuil.',
    nav: [ACCUEIL, STOCKS, DEMANDES],
  },
  centre_transfusion: {
    label: 'Centre de transfusion', org: 'CNTS Tunis',
    tagline: 'Annoncez vos collectes de don volontaire.',
    nav: [ACCUEIL, COLLECTES, STOCKS],
  },
  croissant_rouge: {
    label: 'Croissant-Rouge', org: 'Croissant-Rouge tunisien',
    tagline: 'Mobilisez les volontaires autour de vos collectes.',
    nav: [ACCUEIL, COLLECTES],
  },
}

// Le type d'établissement prime sur le rôle : le compte Croissant-Rouge a le rôle `crt`
// mais doit afficher le profil `croissant_rouge`.
export function profileFor(role: string, institutionType?: string): ProfileKey {
  if (role === 'crt') return 'centre_transfusion'
  if (institutionType === 'croissant_rouge') return 'croissant_rouge'
  return institutionType === 'banque_sang' ? 'banque_sang' : 'hopital'
}

export const ProfileCtx = createContext<{
  profile: ProfileKey
  setProfile: (p: ProfileKey) => void
  orgName?: string // nom réel de l'établissement connecté ; absent si le sélecteur de démo change de profil
}>({
  profile: 'hopital', setProfile: () => {},
})
export const useProfile = () => useContext(ProfileCtx)