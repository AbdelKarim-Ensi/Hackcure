// T4.3 : POST /donations/confirm réel (DonationsService). DTO du contrat v1 conservés ici.
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DonationSource, DonationType, UserRole } from '../common/enums';
import { MOCK_IDS } from '../contract/mocks';
import { DonationsService } from './donations.service';

export class ConfirmDonationDto {
  @ApiProperty({ example: MOCK_IDS.donorUser, description: 'userId du donneur' })
  @IsUUID()
  donorId!: string;

  @ApiProperty({ enum: DonationType, enumName: 'DonationType', example: DonationType.SANG_TOTAL })
  @IsEnum(DonationType)
  type!: DonationType;

  @ApiProperty({ enum: DonationSource, enumName: 'DonationSource', example: DonationSource.URGENCE })
  @IsEnum(DonationSource)
  source!: DonationSource;

  @ApiPropertyOptional({ example: '2026-10-03', description: "Date du don, aujourd'hui par défaut" })
  @IsOptional()
  @IsDateString()
  donatedAt?: string;

  @ApiPropertyOptional({ example: 'Hôpital Charles Nicolle' })
  @IsOptional()
  @IsString()
  place?: string;
}

export class DonationDto {
  @ApiProperty({ example: MOCK_IDS.donation })
  id!: string;

  @ApiProperty({ example: MOCK_IDS.donorUser })
  donorId!: string;

  @ApiProperty({ enum: DonationType, enumName: 'DonationType' })
  type!: DonationType;

  @ApiProperty({ example: '2026-10-03' })
  donatedAt!: string;

  @ApiPropertyOptional({ example: 'Hôpital Charles Nicolle' })
  place?: string;

  @ApiProperty({ enum: DonationSource, enumName: 'DonationSource' })
  source!: DonationSource;

  @ApiProperty({ example: MOCK_IDS.hospitalUser, description: 'Membre du personnel ayant confirmé' })
  confirmedBy!: string;

  @ApiProperty({ example: '2027-01-03', description: 'Prochain don possible, recalculé automatiquement' })
  nextDonationPossibleDate!: string;
}

@ApiTags('donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Post('confirm')
  @HttpCode(200)
  @ApiRoles(UserRole.HOPITAL, UserRole.CRT)
  @ApiOperation({
    summary: 'Confirmer un don',
    description:
      'Enregistre le don, met à jour la date du dernier don et recalcule la date du prochain don possible (F2.1, F2.2). Date par défaut : aujourd\'hui, jamais dans le futur.',
  })
  @ApiOkResponse({ type: DonationDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Date du don invalide ou dans le futur' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Donneur introuvable' })
  confirm(@Body() dto: ConfirmDonationDto, @CurrentUser() user: AuthenticatedUser): Promise<DonationDto> {
    return this.donations.confirm(dto, user);
  }
}
