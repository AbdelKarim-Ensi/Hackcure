// AJOUT T5.2 : producteur de la file « waves » (jobs différés de contrôle de couverture).
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MAX_DELAY_MS, WAVES_QUEUE, WAVE_CHECK_JOB, WaveCheckJob, queueConnection } from './waves.constants';

@Injectable()
export class WavesQueue implements OnModuleDestroy {
  private readonly logger = new Logger(WavesQueue.name);
  private readonly queue: Queue<WaveCheckJob>;

  constructor(config: ConfigService) {
    this.queue = new Queue<WaveCheckJob>(WAVES_QUEUE, { connection: queueConnection(config) });
    this.queue.on('error', (e: Error) => this.logger.error(`File ${WAVES_QUEUE} : ${e.message}`));
  }

  /**
   * Planifie un contrôle différé. Le jobId est déterministe : un même jobId déjà présent est ignoré par BullMQ,
   * ce qui évite de dupliquer la chaîne de contrôles. Les jobs terminés sont gardés 24 h pour la même raison.
   */
  async scheduleCheck(requestId: string, delayMs: number, jobId: string): Promise<void> {
    await this.queue.add(
      WAVE_CHECK_JOB,
      { requestId },
      {
        jobId,
        delay: Math.min(MAX_DELAY_MS, Math.max(0, Math.round(delayMs))),
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
