import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
// AJOUT : guard "établissement validé" pour hopital/crt
import { InstitutionValidatedGuard } from '../common/guards/institution-validated.guard';
import { Institution, User } from '../database/entities';
import { RedisModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Institution]), JwtModule.register({}), RedisModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    // L'ordre compte : authentification d'abord, rôles ensuite.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // AJOUT : en dernier, car il lit req.user posé par JwtAuthGuard
    { provide: APP_GUARD, useClass: InstitutionValidatedGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
