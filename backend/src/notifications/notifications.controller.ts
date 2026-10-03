// AJOUT : T3 - squelette du contrôleur notifications (DTO inclus, service réel en T4.6)
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { BloodGroup, NotificationStatus, NotificationType, UrgencyLevel, UserRole } from '../common/enums';
import { MOCK_IDS, MOCK_NOW } from '../contract/mocks';

export class NotificationDto {
  @ApiProperty({ example: MOCK_IDS.notification })
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  @ApiProperty({ enum: NotificationStatus, enumName: 'NotificationStatus' })
  status!: NotificationStatus;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: "Charge utile de la notification (voir AlertPayloadDto pour le type urgence). Jamais d'identité patient.",
    example: {
      requestId: MOCK_IDS.request,
      bloodGroup: BloodGroup.A_POS,
      hospitalName: 'Hôpital Charles Nicolle',
      distanceKm: 3.2,
      urgency: UrgencyLevel.URGENTE,
    },
  })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: MOCK_NOW })
  createdAt!: string;

  @ApiPropertyOptional({ example: MOCK_NOW })
  sentAt?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  @Get('me')
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT)
  @ApiOperation({
    summary: 'Mes notifications',
    description: "Historique des alertes et rappels, du plus récent au plus ancien. Sert d'écran « Mes alertes » dans l'app.",
  })
  @ApiOkResponse({ type: [NotificationDto] })
  listMine(): NotificationDto[] {
    return [
      {
        id: MOCK_IDS.notification,
        type: NotificationType.URGENCE,
        status: NotificationStatus.ENVOYEE,
        payload: {
          requestId: MOCK_IDS.request,
          bloodGroup: BloodGroup.A_POS,
          hospitalName: 'Hôpital Charles Nicolle',
          distanceKm: 3.2,
          urgency: UrgencyLevel.URGENTE,
        },
        createdAt: MOCK_NOW,
        sentAt: MOCK_NOW,
      },
    ];
  }
}
