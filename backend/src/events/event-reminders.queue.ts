// AJOUT : T6.3 - producteur de la file « event-reminders » (jobs différés).
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { queueConnection } from '../waves/waves.constants';
import {
  EVENT_REMINDERS_QUEUE,
  EVENT_REMINDER_JOB,
  EventReminderJob,
  MAX_QUEUE_DELAY_MS,
} from './event-reminders.constants';

@Injectable()
export class EventRemindersQueue implements OnModuleDestroy {
  private readonly logger = new Logger(EventRemindersQueue.name);
  private readonly queue: Queue<EventReminderJob>;

  constructor(config: ConfigService) {
    this.queue = new Queue<EventReminderJob>(EVENT_REMINDERS_QUEUE, { connection: queueConnection(config) });
    this.queue.on('error', (e: Error) => this.logger.error(`File ${EVENT_REMINDERS_QUEUE} : ${e.message}`));
  }

  /** jobId déterministe : un même jobId déjà présent est ignoré par BullMQ (pas de doublon de rappel). */
  async schedule(job: EventReminderJob, jobId: string): Promise<void> {
    const delay = Math.min(MAX_QUEUE_DELAY_MS, Math.max(0, job.fireAt - Date.now()));
    await this.queue.add(EVENT_REMINDER_JOB, job, {
      jobId,
      delay,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 86_400 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
