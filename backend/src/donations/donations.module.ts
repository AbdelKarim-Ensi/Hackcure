// AJOUT : T3 - module donations (squelette)
import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';

@Module({
  controllers: [DonationsController],
})
export class DonationsModule {}
