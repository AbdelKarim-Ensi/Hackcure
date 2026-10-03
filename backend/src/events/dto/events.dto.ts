// AJOUT : T3 - DTO du module events (événements de don volontaire du CRT)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../common/dto/geo-point.dto';
import {
  BloodGroup,
  DonationType,
  EventStatus,
  RegistrationStatus,
} from '../../common/enums';

export class EventSlotDto {
  @ApiProperty({ example: '09:00', description: 'Heure de début du créneau (HH:mm)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @ApiPropertyOptional({ example: 20, description: 'Capacité du créneau, sinon capacité globale' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Collecte de sang - Faculté des Sciences de Tunis' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Faculté des Sciences de Tunis' })
  @IsString()
  @IsNotEmpty()
  placeName!: string;

  @ApiPropertyOptional({ example: 'Campus universitaire, 2092 Tunis' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  position!: GeoPointDto;

  @ApiProperty({ example: '2026-10-15', description: 'Date de l\'événement (YYYY-MM-DD)' })
  @IsDateString()
  eventDate!: string;

  @ApiProperty({ type: [EventSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventSlotDto)
  slots!: EventSlotDto[];

  @ApiProperty({ example: 60, minimum: 1, description: 'Capacité totale' })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ enum: BloodGroup, enumName: 'BloodGroup', isArray: true, description: 'Groupes recherchés (optionnel)' })
  @IsOptional()
  @IsArray()
  @IsEnum(BloodGroup, { each: true })
  targetGroups?: BloodGroup[];

  @ApiPropertyOptional({ example: 'Apporter une pièce d\'identité' })
  @IsOptional()
  @IsString()
  conditions?: string;
}

export class ListEventsQueryDto {
  @ApiPropertyOptional({ example: 'Tunis', description: 'Gouvernorat ou ville' })
  @IsOptional()
  @IsString()
  governorate?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Date minimale (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Date maximale (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 36.8065, description: 'Latitude de référence pour le filtre de distance' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 10.1815, description: 'Longitude de référence pour le filtre de distance' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 25, description: 'Distance maximale en km (nécessite lat et lng)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDistanceKm?: number;
}

export class EventDto {
  @ApiProperty({ example: 'c3d4e5f6-0001-4ccc-8ddd-000000000001' })
  id!: string;

  @ApiProperty({ example: '9c4d1e83-6b72-4a05-b1f9-5d6e7f8a9b43' })
  organizerId!: string;

  @ApiProperty({ example: 'Collecte de sang - Faculté des Sciences de Tunis' })
  title!: string;

  @ApiProperty({ example: 'Faculté des Sciences de Tunis' })
  placeName!: string;

  @ApiPropertyOptional({ example: 'Campus universitaire, 2092 Tunis' })
  address?: string;

  @ApiPropertyOptional({ type: GeoPointDto })
  position?: GeoPointDto;

  @ApiProperty({ example: '2026-10-15' })
  eventDate!: string;

  @ApiProperty({ type: [EventSlotDto] })
  slots!: EventSlotDto[];

  @ApiProperty({ example: 60 })
  capacity!: number;

  @ApiProperty({ example: 12, description: 'Inscriptions actuelles (statut inscrit)' })
  registeredCount!: number;

  @ApiPropertyOptional({ enum: BloodGroup, enumName: 'BloodGroup', isArray: true })
  targetGroups?: BloodGroup[];

  @ApiPropertyOptional()
  conditions?: string;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;

  @ApiPropertyOptional({ example: 4.8, description: 'Distance au point de référence, si lat et lng sont fournis' })
  distanceKm?: number;
}

export class RegisterEventDto {
  @ApiProperty({ example: '09:00', description: 'Créneau choisi, doit exister dans slots' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  slot!: string;
}

export class EventRegistrationDto {
  @ApiProperty({ example: 'd4e5f6a7-0001-4ddd-9eee-000000000001' })
  id!: string;

  @ApiProperty({ example: 'c3d4e5f6-0001-4ccc-8ddd-000000000001' })
  eventId!: string;

  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' })
  donorId!: string;

  @ApiProperty({ example: '09:00' })
  slot!: string;

  @ApiProperty({ enum: RegistrationStatus, enumName: 'RegistrationStatus' })
  status!: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Jeton signé de courte durée à afficher en QR code pour le pointage',
    example: 'signed.qr.token',
  })
  qrToken?: string;
}

export class CheckinDto {
  @ApiPropertyOptional({ description: 'Jeton lu depuis le QR code du donneur' })
  @IsOptional()
  @IsString()
  qrToken?: string;

  @ApiPropertyOptional({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61', description: 'Pointage manuel par l\'organisateur (alternative au QR)' })
  @IsOptional()
  @IsString()
  donorId?: string;

  @ApiPropertyOptional({ enum: DonationType, enumName: 'DonationType', default: DonationType.SANG_TOTAL })
  @IsOptional()
  @IsEnum(DonationType)
  donationType?: DonationType;
}

export class CheckinResultDto {
  @ApiProperty({ type: EventRegistrationDto })
  registration!: EventRegistrationDto;

  @ApiProperty({ example: 'e5f6a7b8-0001-4eee-8fff-000000000001', description: 'Don enregistré' })
  donationId!: string;

  @ApiProperty({ example: '2027-01-03', description: 'Prochain don possible, recalculé' })
  nextDonationPossibleDate!: string;
}

export class BloodGroupCountDto {
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class EventDashboardDto {
  @ApiProperty({ example: 'c3d4e5f6-0001-4ccc-8ddd-000000000001' })
  eventId!: string;

  @ApiProperty({ example: 42 })
  registered!: number;

  @ApiProperty({ example: 35 })
  present!: number;

  @ApiProperty({ example: 7 })
  absent!: number;

  @ApiProperty({ example: 33, description: 'Dons réalisés' })
  donations!: number;

  @ApiProperty({ type: [BloodGroupCountDto], description: 'Répartition des dons par groupe' })
  byBloodGroup!: BloodGroupCountDto[];
}
