import { WavesModule } from '../waves/waves.module';
import { LiveModule } from '../live/live.module'; // AJOUT T5.4
// AJOUT : T4.4 / T4.5 - entités et RequestsService
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest, Donor, RequestResponse } from '../database/entities';
import { RequestWave } from '../database/entities/requests.entities'; // AJOUT : T5.5
import { InstitutionsModule } from '../institutions/institutions.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  // AJOUT : T5.5 - RequestWave pour l'état live
  imports: [WavesModule, LiveModule, InstitutionsModule, TypeOrmModule.forFeature([BloodRequest, RequestResponse, Donor, RequestWave])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
