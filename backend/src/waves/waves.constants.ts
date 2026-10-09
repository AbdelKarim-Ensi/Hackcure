// AJOUT T5.2 : constantes partagées par la file BullMQ, le worker et le verrou distribué.
import { ConfigService } from '@nestjs/config';

export const WAVES_QUEUE = 'waves';
export const WAVE_CHECK_JOB = 'check';
/** Durée de vie du verrou : couvre largement l'envoi de la vague 1 (< 10 s) ; expire seul si le process meurt. */
export const WAVE_LOCK_TTL_MS = 60_000;
/** Marge ajoutée au délai pour que le contrôle tombe après l'échéance de la vague. */
export const WAVE_CHECK_MARGIN_MS = 1_000;
/** Délai maximal accepté par BullMQ (2^31 - 1 ms). */
export const MAX_DELAY_MS = 2_147_483_647;

export interface WaveCheckJob {
  requestId: string;
}

export const waveLockKey = (requestId: string): string => `lock:wave:${requestId}`;

/** Libère le verrou seulement s'il appartient encore à l'appelant (comparaison du jeton). */
export const RELEASE_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** BullMQ ouvre ses propres connexions (le worker en a une bloquante) : on ne réutilise pas le client REDIS. */
export function queueConnection(config: ConfigService): { host: string; port: number } {
  return {
    host: config.get<string>('REDIS_HOST') ?? 'localhost',
    port: Number(config.get<string>('REDIS_PORT') ?? 6379),
  };
}
