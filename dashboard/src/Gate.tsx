import { useState, type FormEvent } from 'react'
import { useAuth } from './authContext'
import { declareInstitution, type InstType } from './session'
import Screen from './Screen'

export function Pending({ name }: { name: string }) {
  const { reload } = useAuth()
  return (
    <Screen title="En attente d'approbation">
      <p>La demande de <strong>{name}</strong> est en cours d'examen par un administrateur. Il vérifie que l'établissement est reconnu avant d'ouvrir l'accès.</p>
      <button onClick={reload} className="mt-6 rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark">Actualiser le statut</button>
    </Screen>
  )
}

export function Rejected({ name }: { name: string }) {
  return (
    <Screen title="Demande refusée">
      <p>La demande de <strong>{name}</strong> n'a pas été approuvée. Contactez l'administration Damm si vous pensez qu'il s'agit d'une erreur.</p>
    </Screen>
  )
}

export function NotForWeb() {
  return <Screen title="Espace établissements"><p>Ce tableau de bord est réservé aux établissements. Les donneurs utilisent l'application mobile.</p></Screen>
}

export function Declare() {
  const { user, reload } = useAuth()
  const [d, setD] = useState<{ name: string; type: InstType; address: string }>({ name: '', type: 'hopital', address: '' })
  const submit = async (e: FormEvent) => { e.preventDefault(); if (user) { await declareInstitution(user, d); await reload() } }
  const input = 'mt-1 w-full rounded-lg border border-line bg-plasma px-3 py-2'
  return (
    <Screen title="Déclarer votre établissement">
      <form onSubmit={submit} className="max-w-md space-y-3">
        <label className="block text-sm">Nom officiel<input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={input} /></label>
        <label className="block text-sm">Type
          <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as InstType })} className={input}>
            <option value="hopital">Hôpital</option><option value="banque_sang">Banque de sang</option>
            <option value="centre_transfusion">Centre de transfusion</option></select></label>
        <label className="block text-sm">Adresse<input required value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} className={input} /></label>
        <button className="rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-primary-dark">Envoyer pour approbation</button>
      </form>
    </Screen>
  )
}