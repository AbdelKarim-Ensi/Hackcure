import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../database/enums';

// AJOUT : PHONE_RE accepte déjà les fixes tunisiens (+21671xxxxxx ou 71xxxxxx), pas seulement les mobiles.
const PHONE_RE = /^\+?[0-9]{8,15}$/;

// AJOUT : fix login - une seule forme canonique (+216XXXXXXXX) pour register / otp / login.
// Avant : "71000401", "+216 71 000 401" et "+21671000401" étaient 3 comptes différents -> login 401 "Identifiants invalides".
const normalizePhone = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const s = value.replace(/[\s.\-()]/g, '');
  if (/^00/.test(s)) return `+${s.slice(2)}`;
  if (/^[0-9]{8}$/.test(s)) return `+216${s}`;
  if (/^216[0-9]{8}$/.test(s)) return `+${s}`;
  return s;
};

export class RegisterDto {
  // AJOUT : description mise à jour (fixe accepté pour hopital/crt)
  @ApiProperty({ example: '+21612345678', description: 'Numéro de téléphone (identifiant de connexion). Fixe tunisien accepté, ex. +21671123456 (comptes hopital et crt).' })
  @Transform(({ value }) => normalizePhone(value)) // AJOUT : fix login
  @IsString() @Matches(PHONE_RE, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiProperty({ example: 'MotDePasse#2026', minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Amine Ben Salah' })
  @IsOptional() @IsString() @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({
    enum: [UserRole.Donneur, UserRole.Hopital, UserRole.Crt],
    default: UserRole.Donneur,
    description: "Rôle demandé. Les comptes hopital et crt restent inutilisables tant que l'établissement n'est pas validé par un admin.",
  })
  @IsOptional() @IsIn([UserRole.Donneur, UserRole.Hopital, UserRole.Crt])
  role?: UserRole;
}

export class RegisterResponseDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' }) userId!: string;
  // AJOUT : otpSent=false pour hopital/crt (pas d'OTP, le compte peut se connecter tout de suite)
  @ApiProperty({ example: true, description: "Un code OTP a été envoyé par SMS. false pour les comptes hopital et crt : pas d'OTP, la confiance vient de la validation admin, le compte peut se connecter tout de suite." }) otpSent!: boolean;
  @ApiPropertyOptional({ example: '123456', description: 'Renvoyé uniquement en mode démo (OTP_DEV_MODE=true), jamais en production' })
  devOtp?: string;
}

export class OtpSendDto {
  @ApiProperty({ example: '+21612345678' })
  @Transform(({ value }) => normalizePhone(value)) // AJOUT : fix login
  @IsString() @Matches(PHONE_RE) phone!: string;
}

export class OtpSendResponseDto {
  @ApiProperty({ example: true }) sent!: boolean;
  @ApiProperty({ example: 300, description: 'Durée de vie du code en secondes (TTL Redis)' }) expiresInSeconds!: number;
  @ApiPropertyOptional({ example: '123456', description: 'Mode démo uniquement' }) devOtp?: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: '+21612345678' })
  @Transform(({ value }) => normalizePhone(value)) // AJOUT : fix login
  @IsString() @Matches(PHONE_RE) phone!: string;
  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres' })
  @IsString() @Length(6, 6) code!: string;
}

export class LoginDto {
  @ApiProperty({ example: '+21612345678' }) @Transform(({ value }) => normalizePhone(value)) /* AJOUT : fix login */ @IsString() @Matches(PHONE_RE) phone!: string;
  @ApiProperty({ example: 'MotDePasse#2026' }) @IsString() @MinLength(1) password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token obtenu à la connexion' })
  @IsString() @MinLength(10) refreshToken!: string;
}

export class AuthUserDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' }) id!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.Donneur }) role!: UserRole;
  @ApiProperty({ example: '+21612345678' }) phone!: string;
  @ApiPropertyOptional({ example: 'Amine Ben Salah' }) fullName?: string;
  @ApiPropertyOptional({ example: 'a1b2c3d4-0001-4aaa-8bbb-000000000001', description: 'Établissement rattaché (rôles hopital et crt)' })
  institutionId?: string;
}

export class TokensDto {
  @ApiProperty({ description: 'JWT court, à envoyer en Authorization: Bearer <token>' }) accessToken!: string;
  @ApiProperty({ description: 'JWT long, sert uniquement à POST /auth/refresh' }) refreshToken!: string;
  @ApiProperty({ example: 900, description: "Durée de vie de l'access token en secondes" }) expiresIn!: number;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
