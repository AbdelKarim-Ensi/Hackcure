// AJOUT : T7.2 module audit (interceptor global)
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../database/entities';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AuditModule {}
