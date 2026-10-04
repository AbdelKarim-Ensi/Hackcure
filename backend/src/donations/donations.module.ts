// T4.3 : module donations branché sur la base ; exporte le service (utilisé par DonorsController).
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation, Donor, Institution } from '../database/entities';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, Donor, Institution])],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
