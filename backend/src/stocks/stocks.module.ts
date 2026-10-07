// AJOUT : T3 - module stocks (squelette)
// AJOUT : T6.6 - StocksService branché sur TypeORM (Stock, Institution).
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from '../database/entities/identity.entities';
import { Stock } from '../database/entities/ops.entities';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, Institution])],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
