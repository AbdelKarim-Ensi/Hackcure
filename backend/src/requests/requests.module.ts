// AJOUT : T4.4 - entité BloodRequest et RequestsService
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodRequest } from '../database/entities';
import { InstitutionsModule } from '../institutions/institutions.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [InstitutionsModule, TypeOrmModule.forFeature([BloodRequest])],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
