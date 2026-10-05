// AJOUT T5.4 : module du temps réel. Le gateway Socket.IO (T5.3) viendra s'y ajouter.
import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { LiveEventsService } from './live-events.service';

@Module({
  imports: [RedisModule],
  providers: [LiveEventsService],
  exports: [LiveEventsService],
})
export class LiveModule {}
