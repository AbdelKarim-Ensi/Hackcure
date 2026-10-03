// AJOUT : T3 - squelette du contrôleur users.
// Endpoint ajouté par rapport au PRD §9 : M3 doit pouvoir envoyer le jeton FCM de l'appareil (§7 du doc d'architecture).
import { Body, Controller, HttpCode, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { UserRole } from '../common/enums';

export class DeviceTokenDto {
  @ApiProperty({ description: "Jeton FCM de l'appareil", example: 'fcm-device-token-xyz' })
  @IsString()
  @IsNotEmpty()
  fcmToken!: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Put('me/device-token')
  @HttpCode(204)
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: "Enregistrer le jeton FCM de l'appareil",
    description: 'À appeler après la connexion et à chaque renouvellement du jeton.',
  })
  @ApiNoContentResponse({ description: 'Jeton enregistré' })
  setDeviceToken(@Body() _dto: DeviceTokenDto): void {
    return;
  }
}
