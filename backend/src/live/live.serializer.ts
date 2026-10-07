// AJOUT T5.3 : conversion d'un message Redis (publié par LiveEventsService) en événement Socket.IO.
// R4 : liste blanche de champs par type d'événement. Tout champ inconnu (donneur, patient...) est écarté.
import { LIVE_CHANNEL_PREFIX } from './live.constants';

export const roomOf = (requestId: string): string => `request:${requestId}`;

const CLIENT_FIELDS = {
  gauge: ['accepted', 'needed', 'percent', 'at'],
  donor_en_route: ['accepted', 'at'],
  wave_started: ['waveNumber', 'radiusKm', 'at'],
} as const;

export interface ClientEvent {
  event: keyof typeof CLIENT_FIELDS;
  requestId: string;
  data: Record<string, unknown>;
}

/** L'identifiant de la demande vient du canal Redis, pas du payload. Renvoie null si le message est inexploitable. */
export function toClientEvent(channel: string, raw: string): ClientEvent | null {
  if (!channel.startsWith(LIVE_CHANNEL_PREFIX)) return null;
  const requestId = channel.slice(LIVE_CHANNEL_PREFIX.length);
  if (!requestId) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const message = parsed as Record<string, unknown>;
  const type = message.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(CLIENT_FIELDS, type)) return null;

  const event = type as keyof typeof CLIENT_FIELDS;
  const data: Record<string, unknown> = { requestId };
  for (const field of CLIENT_FIELDS[event]) {
    if (field in message) data[field] = message[field];
  }
  return { event, requestId, data };
}
