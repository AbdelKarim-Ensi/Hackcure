// AJOUT : T6.3 - worker de la file « event-reminders ».
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { queueConnection } from '../waves/waves.constants';
import { EVENT_REMINDERS_QUEUE, EventReminderJob } from './event-reminders.constants';
import { EventRemindersQueue } from './event-reminders.queue';
import { EventNotifier } from './event-notifier.service';

@Injectable()
export class EventRemindersProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventRemindersProcessor.name);
  private worker?: Worker<EventReminderJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly notifier: EventNotifier,
    private readonly queue: EventRemindersQueue,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<EventReminderJob>(
      EVENT_REMINDERS_QUEUE,
      async (job: Job<EventReminderJob>) => {
        // Délai plafonné par BullMQ : si l'échéance est encore lointaine, on replanifie.
        if (job.data.fireAt - Date.now() > 5_000) {
          await this.queue.schedule(job.data, `${job.data.registrationId}_${job.data.kind}_${Date.now()}`);
          return { action: 'rescheduled' };
        }
        const action = await this.notifier.sendReminder(job.data);
        this.logger.log(`Rappel ${job.data.kind} ${job.data.registrationId} : ${action}`);
        return { action };
      },
      { connection: queueConnection(this.config), concurrency: 5 },
    );
    this.worker.on('failed', (job, e) =>
      this.logger.error(`Rappel ${job?.data.registrationId} échoué (tentative ${job?.attemptsMade}) : ${e.message}`),
    );
    this.worker.on('error', (e: Error) => this.logger.error(`Worker ${EVENT_REMINDERS_QUEUE} : ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
