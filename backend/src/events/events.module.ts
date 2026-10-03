// AJOUT : T3 - module events (squelette)
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
})
export class EventsModule {}
