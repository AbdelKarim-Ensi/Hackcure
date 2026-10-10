// AJOUT : T4.6 - NotificationsService, entités et expéditeur push (simulé en démo)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotification, User } from '../database/entities';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { LoggingPushSender, PUSH_SENDER } from './push-sender';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification, User])],
  controllers: [NotificationsController],
  providers: [NotificationsService, { provide: PUSH_SENDER, useClass: LoggingPushSender }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
