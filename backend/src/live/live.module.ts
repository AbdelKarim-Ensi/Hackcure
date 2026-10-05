// AJOUT T5.4 : module du temps réel. Le gateway Socket.IO (T5.3) viendra s'y ajouter.
// AJOUT T5.3 : gateway Socket.IO /live (JWT au handshake, rooms par demande, relais Redis pub/sub).
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest } from '../database/entities/requests.entities';
import { RedisModule } from '../redis/redis.module';
import { LiveEventsService } from './live-events.service';
import { LiveGateway } from './live.gateway';

@Module({
  imports: [RedisModule, TypeOrmModule.forFeature([BloodRequest]), JwtModule.register({})],
  providers: [LiveEventsService, LiveGateway],
  exports: [LiveEventsService],
})
export class LiveModule {}
