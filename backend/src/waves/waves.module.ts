import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest, RequestWave } from '../database/entities/requests.entities';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WavesService } from './waves.service';

@Module({
  imports: [TypeOrmModule.forFeature([BloodRequest, RequestWave]), MatchingModule, NotificationsModule],
  providers: [WavesService],
  exports: [WavesService],
})
export class WavesModule {}
