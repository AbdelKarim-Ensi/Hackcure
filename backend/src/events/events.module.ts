// AJOUT : T6.1 - module events branché sur TypeORM.
// AJOUT : T6.2 - QrTokenService.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { QrTokenService } from './qr-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrtEvent, EventRegistration])],
  controllers: [EventsController],
  providers: [EventsService, QrTokenService],
  exports: [EventsService, QrTokenService],
})
export class EventsModule {}
