// AJOUT : T3 - module notifications (squelette)
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
