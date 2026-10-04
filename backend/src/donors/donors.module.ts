// T4.1 : module donors branché sur la base (Donor, User). T4.3 : importe DonationsModule pour next-donation-date.
// T4.2 : EligibilityFormService + CryptoModule (réponses de santé chiffrées).
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../common/crypto/crypto.module';
import { Donor, User } from '../database/entities';
import { DonationsModule } from '../donations/donations.module';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';
import { EligibilityFormService } from './eligibility-form.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Donor, User]),
    DonationsModule,
    CryptoModule,
  ],
  controllers: [DonorsController],
  providers: [DonorsService, EligibilityFormService],
  exports: [DonorsService],
})
export class DonorsModule {}
