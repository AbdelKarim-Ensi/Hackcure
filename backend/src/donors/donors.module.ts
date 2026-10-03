// AJOUT : T3 - module donors (squelette)
import { Module } from '@nestjs/common';
import { DonorsController } from './donors.controller';

@Module({
  controllers: [DonorsController],
})
export class DonorsModule {}
