// AJOUT : T3 - module stocks (squelette)
import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller';

@Module({
  controllers: [StocksController],
})
export class StocksModule {}
