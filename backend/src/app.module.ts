import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { dataSourceOptions } from './database/data-source';
import { ApiContractModule } from './api-contract.module';
// AJOUT : T7.2 journal d'audit
import { AuditModule } from './audit/audit.module';
// AJOUT : T7.3 limitation de débit
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ApiContractModule,

    TypeOrmModule.forRoot(dataSourceOptions),
    // AJOUT : T7.2
    AuditModule,
    // AJOUT : T7.3 quota global (par défaut 100 req/min/IP), coupé si THROTTLE_DISABLED=true
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: Number(config.get('THROTTLE_LIMIT') ?? 100) }],
        skipIf: () => config.get('THROTTLE_DISABLED') === 'true',
      }),
    }),
  ],
  controllers: [AppController],
  // AJOUT : T7.3
  providers: [AppService, { provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}
