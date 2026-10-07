// AJOUT : T6.1 - module events branché sur TypeORM.
// AJOUT : T6.2 - QrTokenService.
// AJOUT : T6.3 - notifications d'événements et rappels différés (BullMQ).
// AJOUT : T6.4 - pointage (EventCheckinService) branché sur DonationsService.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { DonationsModule } from '../donations/donations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventNotifier } from './event-notifier.service';
import { EventRemindersProcessor } from './event-reminders.processor';
import { EventRemindersQueue } from './event-reminders.queue';
import { EventCheckinService } from './events-checkin.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QrTokenService } from './qr-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrtEvent, EventRegistration]), NotificationsModule, DonationsModule],
  controllers: [EventsController],
  providers: [EventsService, QrTokenService, EventNotifier, EventRemindersQueue, EventRemindersProcessor, EventCheckinService],
  exports: [EventsService, QrTokenService, EventNotifier],
})
export class EventsModule {}
