// AJOUT T5.4 : canaux et événements du temps réel. Le gateway Socket.IO (T5.3) s'abonne à LIVE_CHANNEL_PATTERN.
export const LIVE_CHANNEL_PREFIX = 'live:request:';
export const LIVE_CHANNEL_PATTERN = `${LIVE_CHANNEL_PREFIX}*`;

export const liveChannel = (requestId: string): string => `${LIVE_CHANNEL_PREFIX}${requestId}`;

export interface GaugeSnapshot {
  accepted: number;
  needed: number;
  percent: number;
}

/**
 * Événements publiés sur Redis. R4 : jamais d'identité de patient ni de donneur dans ces payloads.
 * `wave_started` est défini ici pour le gateway (T5.3) ; il sera publié par WavesService à ce moment-là.
 */
export type LiveEvent =
  | ({ type: 'gauge'; requestId: string; at: string } & GaugeSnapshot)
  | { type: 'donor_en_route'; requestId: string; accepted: number; at: string }
  | { type: 'wave_started'; requestId: string; waveNumber: number; radiusKm: number; at: string };
