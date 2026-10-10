import { radiusForWave, waveTimeoutMinutes } from './scoring';
import { Urgency } from './types';

/** État d'une demande, lu en base par le service (aucune lecture ici : fonction pure). */
export interface WaveState {
  urgency: Urgency;
  unitsNeeded: number;
  /** Réponses « je_viens » reçues. */
  unitsConfirmed: number;
  initialRadiusKm: number;
  maxRadiusKm: number;
  /** Nombre de vagues déjà envoyées. */
  wavesSent: number;
  lastWaveAt: Date | null;
  lastWaveRadiusKm: number | null;
  deadline: Date;
}

export type WaveDecision =
  | { action: 'launch'; waveNumber: number; radiusKm: number }
  | { action: 'wait'; nextCheckAt: Date }
  | { action: 'covered' }
  | { action: 'expired' }
  | { action: 'exhausted' };

/**
 * Décide quoi faire pour une demande à l'instant `now`.
 *  - besoin couvert        -> covered
 *  - échéance dépassée      -> expired
 *  - aucune vague envoyée   -> launch vague 1 au rayon initial
 *  - délai d'attente en cours -> wait
 *  - délai écoulé, besoin non couvert -> launch vague suivante (rayon élargi), ou exhausted
 *    si la dernière vague était déjà au rayon maximal
 */
export function decideWaveAction(state: WaveState, now: Date = new Date()): WaveDecision {
  if (state.unitsConfirmed >= state.unitsNeeded) return { action: 'covered' };
  if (now.getTime() >= state.deadline.getTime()) return { action: 'expired' };

  if (state.wavesSent === 0) {
    return {
      action: 'launch',
      waveNumber: 1,
      radiusKm: radiusForWave(0, state.initialRadiusKm, state.maxRadiusKm),
    };
  }

  if (state.lastWaveAt) {
    const due = new Date(state.lastWaveAt.getTime() + waveTimeoutMinutes(state.urgency) * 60_000);
    if (now.getTime() < due.getTime()) return { action: 'wait', nextCheckAt: due };
  }

  if (state.lastWaveRadiusKm !== null && state.lastWaveRadiusKm >= state.maxRadiusKm) {
    return { action: 'exhausted' };
  }

  return {
    action: 'launch',
    waveNumber: state.wavesSent + 1,
    radiusKm: radiusForWave(state.wavesSent, state.initialRadiusKm, state.maxRadiusKm),
  };
}
