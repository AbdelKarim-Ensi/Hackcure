// AJOUT : T3 - squelette du contrôleur notifications (DTO inclus)
// AJOUT : T4.6 - GET /notifications/me branché sur NotificationsService
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { BloodGroup, NotificationStatus, NotificationType, UrgencyLevel, UserRole } from '../common/enums';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MOCK_IDS, MOCK_NOW } from '../contract/mocks';
import { NotificationsService } from './notifications.service';

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
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT)
  @ApiOperation({
    summary: 'Mes notifications',
    description: "Historique des alertes et rappels, du plus récent au plus ancien. Sert d'écran « Mes alertes » dans l'app.",
  })
  @ApiOkResponse({ type: [NotificationDto] })
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<NotificationDto[]> {
    return this.notifications.listMine(user.id);
  }
}
