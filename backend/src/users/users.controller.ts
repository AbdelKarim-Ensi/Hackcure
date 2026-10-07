// AJOUT : T3 - squelette du contrôleur users.
// AJOUT : T4.6 - le jeton FCM est enregistré en base via UsersService.
// Endpoint ajouté par rapport au PRD §9 : M3 doit pouvoir envoyer le jeton FCM de l'appareil (§7 du doc d'architecture).
// AJOUT : Get ajouté à l'import (GET /users/me)
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
// AJOUT : ApiOkResponse ajouté à l'import
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
// AJOUT : GET /users/me reste accessible tant que l'établissement n'est pas validé
import { AllowUnvalidatedInstitution } from '../common/decorators/allow-unvalidated-institution.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
// AJOUT : InstitutionType et ValidationStatus ajoutés à l'import (MeDto)
import { InstitutionType, UserRole, ValidationStatus } from '../common/enums';
import { UsersService } from './users.service';

export class DeviceTokenDto {
  @ApiProperty({ description: "Jeton FCM de l'appareil", example: 'fcm-device-token-xyz' })
  @IsString()
  @IsNotEmpty()
  fcmToken!: string;
}

// AJOUT : établissement résumé dans GET /users/me
export class MeInstitutionDto {
  @ApiProperty({ example: 'a1b2c3d4-0001-4aaa-8bbb-000000000001' }) id!: string;
  @ApiProperty({ example: 'Hôpital Charles Nicolle' }) name!: string;
  @ApiProperty({ enum: InstitutionType, enumName: 'InstitutionType' }) type!: InstitutionType;
  @ApiProperty({ enum: ValidationStatus, enumName: 'ValidationStatus', description: 'en_attente, valide ou rejete : sert à afficher « en attente d\'approbation » ou « refusé »' })
  validationStatus!: ValidationStatus;
}

// AJOUT : réponse de GET /users/me
export class MeDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' }) id!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.HOPITAL }) role!: UserRole;
  @ApiProperty({ example: '+21671123456' }) phone!: string;
  @ApiProperty({ example: 'Personnel Hôpital Charles Nicolle', nullable: true, type: String }) fullName!: string | null;
  @ApiProperty({ example: 'actif', enum: ['actif', 'suspendu'] }) status!: string;
  @ApiProperty({ type: MeInstitutionDto, nullable: true, description: "null tant que le compte n'a pas déclaré d'établissement" })
  institution!: MeInstitutionDto | null;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // AJOUT : GET /users/me (tous les rôles ; accessible même si l'établissement n'est pas validé)
  @Get('me')
  @AllowUnvalidatedInstitution()
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: "Profil de l'utilisateur connecté",
    description:
      "Renvoie le compte et son établissement (null si aucun n'a été déclaré). Sert à afficher l'état « en attente d'approbation » ou « refusé ».",
  })
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.users.me(user.id);
  }

  @Put('me/device-token')
  @HttpCode(204)
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: "Enregistrer le jeton FCM de l'appareil",
    description: 'À appeler après la connexion et à chaque renouvellement du jeton.',
  })
  @ApiNoContentResponse({ description: 'Jeton enregistré' })
  setDeviceToken(@Body() dto: DeviceTokenDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.users.setDeviceToken(user.id, dto.fcmToken);
  }
}
