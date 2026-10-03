// AJOUT : T3 - DTO du module auth (contrat v1)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums';

const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

export class RegisterDto {
  @ApiProperty({ example: '+21612345678', description: 'Numéro de téléphone (identifiant de connexion)' })
  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: 'MotDePasse#2026', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'Amine Ben Salah' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    enum: [UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT],
    default: UserRole.DONNEUR,
    description:
      "Rôle demandé. Les comptes hopital et crt restent inutilisables tant que l'établissement n'est pas validé par un admin.",
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class RegisterResponseDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' })
  userId!: string;

  @ApiProperty({ example: true, description: 'Un code OTP a été envoyé par SMS' })
  otpSent!: boolean;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Renvoyé uniquement en mode démo (OTP_DEV_MODE=true), jamais en production',
  })
  devOtp?: string;
}

export class OtpSendDto {
  @ApiProperty({ example: '+21612345678' })
  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone!: string;
}

export class OtpSendResponseDto {
  @ApiProperty({ example: true })
  sent!: boolean;

  @ApiProperty({ example: 300, description: "Durée de vie du code en secondes (TTL Redis)" })
  expiresInSeconds!: number;

  @ApiPropertyOptional({ example: '123456', description: 'Mode démo uniquement' })
  devOtp?: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: '+21612345678' })
  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class LoginDto {
  @ApiProperty({ example: '+21612345678' })
  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: 'MotDePasse#2026' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token obtenu à la connexion' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AuthUserDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' })
  id!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.DONNEUR })
  role!: UserRole;

  @ApiProperty({ example: '+21612345678' })
  phone!: string;

  @ApiPropertyOptional({ example: 'Amine Ben Salah' })
  fullName?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-0001-4aaa-8bbb-000000000001',
    description: "Établissement rattaché (rôles hopital et crt)",
  })
  institutionId?: string;
}

export class TokensDto {
  @ApiProperty({ description: 'JWT court, à envoyer en Authorization: Bearer <token>' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT long, sert uniquement à POST /auth/refresh' })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: "Durée de vie de l'access token en secondes" })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
