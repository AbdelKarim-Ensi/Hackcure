import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest, RequestWave } from '../database/entities/requests.entities';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisModule } from '../redis/redis.module'; // AJOUT T5.2
import { WavesProcessor } from './waves.processor'; // AJOUT T5.2
import { WavesQueue } from './waves.queue'; // AJOUT T5.2
import { WavesService } from './waves.service';
import { LiveModule } from '../live/live.module'; // AJOUT T5.3

@Module({
  imports: [TypeOrmModule.forFeature([BloodRequest, RequestWave]), MatchingModule, NotificationsModule, RedisModule, LiveModule /* AJOUT T5.3 */],
  providers: [WavesService, WavesQueue, WavesProcessor],
  exports: [WavesService],
})
export class WavesModule {}
