// AJOUT T5.2 : worker de la file « waves ». Chaque job rappelle WavesService.runWave (qui décide, envoie, clôture ou replanifie).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { WAVES_QUEUE, WaveCheckJob, queueConnection } from './waves.constants';
import { WavesService } from './waves.service';

@Injectable()
export class WavesProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WavesProcessor.name);
  private worker?: Worker<WaveCheckJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly waves: WavesService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<WaveCheckJob>(
      WAVES_QUEUE,
      async (job: Job<WaveCheckJob>) => {
        const res = await this.waves.runWave(job.data.requestId);
        this.logger.log(`Contrôle ${job.data.requestId} : ${res.action}`);
        return { action: res.action };
      },
      { connection: queueConnection(this.config), concurrency: 5 },
    );
    this.worker.on('failed', (job, e) =>
      this.logger.error(`Contrôle ${job?.data.requestId} échoué (tentative ${job?.attemptsMade}) : ${e.message}`),
    );
    this.worker.on('error', (e: Error) => this.logger.error(`Worker ${WAVES_QUEUE} : ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
