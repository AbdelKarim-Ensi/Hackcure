// T4.1 : module donors branché sur la base (Donor, User). T4.3 : importe DonationsModule pour next-donation-date.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donor, User } from '../database/entities';
import { DonationsModule } from '../donations/donations.module';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Donor, User]), DonationsModule],
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService],
})
export class DonorsModule {}
