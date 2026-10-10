import { useEffect, useState } from 'react'
import { api, USE_MOCK } from './api'
import { events0, type EventItem } from './data'

export type NewEvent = { title: string; place: string; date: string; capacity: number }

type Api = { id: string; title: string; placeName: string; eventDate: string; capacity: number; registeredCount: number }
const fromApi = (e: Api): EventItem => ({
  id: e.id, title: e.title, place: e.placeName, date: e.eventDate.slice(0, 10), filled: e.registeredCount, capacity: e.capacity,
})
const byDate = (a: EventItem, b: EventItem) => a.date.localeCompare(b.date)

// Mode démo : données de data.ts, modifiables en mémoire.
const mock: EventItem[] = [...events0]

export async function listEvents(): Promise<EventItem[]> {
  if (USE_MOCK) return [...mock].sort(byDate)
  return (await api<Api[]>('/events')).map(fromApi).sort(byDate)
}

export async function createEvent(d: NewEvent): Promise<EventItem> {
  if (USE_MOCK) {
    const e: EventItem = { id: crypto.randomUUID(), title: d.title, place: d.place, date: d.date, filled: 0, capacity: d.capacity }
    mock.push(e)
    return e
  }
  // position et créneaux par défaut : le formulaire ne les demande pas encore.
  return fromApi(await api<Api>('/events', {
    method: 'POST',
    body: JSON.stringify({
      title: d.title,
      placeName: d.place,
      position: { latitude: 36.8065, longitude: 10.1815 },
      eventDate: d.date,
      slots: [{ time: '09:00' }, { time: '14:00' }],
      capacity: d.capacity,
    }),
  }))
}

export function useEvents() {
  const [list, setList] = useState<EventItem[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    listEvents().then(setList).catch(() => { setError(true); setList([]) })
  }, [])
  return { list, setList, error }
}
