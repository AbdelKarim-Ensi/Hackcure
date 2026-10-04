// AJOUT : T4.4 / T4.5 - entités et RequestsService
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest, Donor, RequestResponse } from '../database/entities';
import { InstitutionsModule } from '../institutions/institutions.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [InstitutionsModule, TypeOrmModule.forFeature([BloodRequest, RequestResponse, Donor])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
