// AJOUT : T3 - DTO du module requests, y compris les charges utiles WebSocket /live et l'alerte FCM
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import {
  BloodGroup,
  RequestStatus,
  ResponseType,
  UrgencyLevel,
} from '../../common/enums';

export class CreateRequestDto {
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup', example: BloodGroup.A_POS })
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 10, minimum: 1, description: 'Nombre de poches demandées' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: UrgencyLevel, enumName: 'UrgencyLevel', example: UrgencyLevel.URGENTE })
  @IsEnum(UrgencyLevel)
  urgency!: UrgencyLevel;

  @ApiProperty({ example: '2026-10-03T18:00:00.000Z', description: 'Échéance au-delà de laquelle la demande expire' })
  @IsDateString()
  deadline!: string;

  @ApiPropertyOptional({ enum: [5, 10, 20], default: 10, description: "Rayon initial en km, choisi par l'hôpital (F3.2)" })
  @IsOptional()
  @IsIn([5, 10, 20])
  initialRadiusKm?: number;
}

export class RequestDto {
  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  id!: string;

  @ApiProperty({ example: 'a1b2c3d4-0001-4aaa-8bbb-000000000001' })
  institutionId!: string;

  @ApiProperty({ example: 'Hôpital Charles Nicolle' })
  institutionName!: string;

  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ enum: UrgencyLevel, enumName: 'UrgencyLevel' })
  urgency!: UrgencyLevel;

  @ApiProperty({ example: '2026-10-03T18:00:00.000Z' })
  deadline!: string;

  @ApiProperty({ example: 5 })
  initialRadiusKm!: number;

  @ApiProperty({ example: 5, description: 'Rayon actuel, élargi à chaque vague' })
  currentRadiusKm!: number;

  @ApiProperty({ example: 30 })
  maxRadiusKm!: number;

  @ApiProperty({
    enum: RequestStatus,
    enumName: 'RequestStatus',
    description: 'en_revue = score d\'anomalie élevé, validation manuelle requise avant toute alerte',
  })
  status!: RequestStatus;

  @ApiPropertyOptional({ example: 0.12, description: "Score d'anomalie de 0 à 1 (M2)" })
  anomalyScore?: number;

  @ApiProperty({ example: '2026-10-03T10:30:00.000Z' })
  createdAt!: string;
}

export class RespondDto {
  @ApiProperty({ enum: ResponseType, enumName: 'ResponseType', example: ResponseType.JE_VIENS })
  @IsEnum(ResponseType)
  response!: ResponseType;
}

export class GaugeDto {
  @ApiProperty({ example: 3, description: 'Donneurs ayant répondu « Je viens »' })
  accepted!: number;

  @ApiProperty({ example: 10, description: 'Quantité demandée' })
  needed!: number;

  @ApiProperty({ example: 30, description: 'Pourcentage de couverture, plafonné à 100' })
  percent!: number;
}

export class RespondResultDto {
  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ enum: ResponseType, enumName: 'ResponseType' })
  response!: ResponseType;

  @ApiProperty({
    example: true,
    description: 'false si le contrôle serveur refuse (délai entre dons non écoulé, demande close). Voir le code HTTP 409.',
  })
  accepted!: boolean;

  @ApiProperty({ type: GaugeDto })
  gauge!: GaugeDto;
}

export class WaveDto {
  @ApiProperty({ example: 1 })
  number!: number;

  @ApiProperty({ example: 5 })
  radiusKm!: number;

  @ApiProperty({ example: 2, description: 'Donneurs alertés dans cette vague' })
  sentTo!: number;

  @ApiProperty({ example: 20, description: 'Couverture constatée à la fin de la vague, en %' })
  coverage!: number;

  @ApiProperty({ example: '2026-10-03T10:30:05.000Z' })
  createdAt!: string;
}

export class DonorEnRouteDto {
  @ApiProperty({ example: 'don-7f3a', description: 'Identifiant anonyme, jamais le nom ni le téléphone' })
  anonymousId!: string;

  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 3.2, description: "Distance estimée à l'hôpital en km" })
  distanceKm!: number;

  @ApiProperty({ example: '2026-10-03T10:31:12.000Z' })
  respondedAt!: string;
}

export class LiveStateDto {
  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ enum: RequestStatus, enumName: 'RequestStatus' })
  status!: RequestStatus;

  @ApiProperty({ example: 5 })
  currentRadiusKm!: number;

  @ApiProperty({ type: GaugeDto })
  gauge!: GaugeDto;

  @ApiProperty({ type: [WaveDto] })
  waves!: WaveDto[];

  @ApiProperty({ type: [DonorEnRouteDto], description: 'Liste anonymisée des donneurs en route' })
  donorsEnRoute!: DonorEnRouteDto[];
}

// ---- Charges utiles WebSocket (namespace /live), documentées ici pour M4 ----

export class WsGaugeEventDto {
  @ApiProperty({ example: 'gauge', description: "Nom de l'événement Socket.IO" })
  event!: 'gauge';

  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ type: GaugeDto })
  gauge!: GaugeDto;
}

export class WsDonorEnRouteEventDto {
  @ApiProperty({ example: 'donor_en_route' })
  event!: 'donor_en_route';

  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ type: DonorEnRouteDto })
  donor!: DonorEnRouteDto;
}

export class WsWaveStartedEventDto {
  @ApiProperty({ example: 'wave_started' })
  event!: 'wave_started';

  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ type: WaveDto })
  wave!: WaveDto;
}

/**
 * Charge utile `data` de la notification FCM d'urgence reçue par M3.
 * Ne contient jamais d'identité patient (R4, F3.5).
 */
export class AlertPayloadDto {
  @ApiProperty({ example: 'urgence' })
  type!: 'urgence';

  @ApiProperty({ example: 'b2c3d4e5-0001-4bbb-9ccc-000000000001' })
  requestId!: string;

  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 'Hôpital Charles Nicolle' })
  hospitalName!: string;

  @ApiProperty({ example: 3.2, description: 'Distance estimée donneur-hôpital en km' })
  distanceKm!: number;

  @ApiProperty({ enum: UrgencyLevel, enumName: 'UrgencyLevel' })
  urgency!: UrgencyLevel;

  @ApiProperty({ example: '2026-10-03T18:00:00.000Z' })
  deadline!: string;
}

// AJOUT : T14 - décision de l'admin sur une demande retenue en en_revue
export enum ReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ReviewRequestDto {
  @ApiProperty({
    enum: ReviewDecision,
    enumName: 'ReviewDecision',
    example: ReviewDecision.APPROVE,
    description: 'approve : la demande passe en active et la vague 1 démarre. reject : la demande est clôturée, aucune alerte envoyée.',
  })
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;
}
