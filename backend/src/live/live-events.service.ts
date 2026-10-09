// AJOUT T5.4 : publication Redis pub/sub des événements temps réel (best-effort : n'échoue jamais).
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { GaugeSnapshot, LiveEvent, liveChannel } from './live.constants';

@Injectable()
export class LiveEventsService {
  private readonly logger = new Logger(LiveEventsService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Publie un événement sur le canal de sa demande. Une erreur Redis est journalisée, jamais propagée. */
  async publish(event: LiveEvent): Promise<void> {
    try {
      await this.redis.publish(liveChannel(event.requestId), JSON.stringify(event));
    } catch (e) {
      this.logger.warn(`Événement ${event.type} non publié pour ${event.requestId} : ${(e as Error).message}`);
    }
  }

  /** Réponse « Je viens » : jauge à jour, puis arrivée anonymisée d'un donneur. */
  async publishAccepted(requestId: string, gauge: GaugeSnapshot): Promise<void> {
    const at = new Date().toISOString();
    await Promise.all([
      this.publish({ type: 'gauge', requestId, accepted: gauge.accepted, needed: gauge.needed, percent: gauge.percent, at }),
      this.publish({ type: 'donor_en_route', requestId, accepted: gauge.accepted, at }),
    ]);
  }
}
