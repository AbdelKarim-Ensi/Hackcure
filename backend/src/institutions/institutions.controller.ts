import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { GeoPointDto } from '../common/dto/geo-point.dto';
import { InstitutionType, UserRole, ValidationStatus } from '../common/enums';
import { MOCK_IDS } from '../contract/mocks';
import { InstitutionsService } from './institutions.service';

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Hôpital Charles Nicolle' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: InstitutionType, enumName: 'InstitutionType', example: InstitutionType.HOPITAL })
  @IsEnum(InstitutionType)
  type!: InstitutionType;

  @ApiPropertyOptional({ example: 'Boulevard 9 Avril 1938, Tunis' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  position!: GeoPointDto;
}

export class ValidateInstitutionDto {
  @ApiProperty({
    enum: [ValidationStatus.VALIDE, ValidationStatus.REJETE],
    example: ValidationStatus.VALIDE,
  })
  @IsIn([ValidationStatus.VALIDE, ValidationStatus.REJETE])
  validationStatus!: ValidationStatus.VALIDE | ValidationStatus.REJETE;
}

export class InstitutionDto {
  @ApiProperty({ example: MOCK_IDS.institution })
  id!: string;

  @ApiProperty({ example: 'Hôpital Charles Nicolle' })
  name!: string;

  @ApiProperty({ enum: InstitutionType, enumName: 'InstitutionType' })
  type!: InstitutionType;

  @ApiProperty({ enum: ValidationStatus, enumName: 'ValidationStatus', description: 'Seul un établissement valide peut créer une demande (F5)' })
  validationStatus!: ValidationStatus;

  @ApiPropertyOptional({ example: 'Boulevard 9 Avril 1938, Tunis' })
  address?: string;

  @ApiPropertyOptional({ type: GeoPointDto })
  position?: GeoPointDto;
}

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Post()
  @ApiRoles(UserRole.HOPITAL, UserRole.CRT, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Déclarer un établissement',
    description: "Créé en en_attente. Il doit être validé par un admin avant de pouvoir créer des demandes.",
  })
  @ApiCreatedResponse({ type: InstitutionDto })
  create(@Body() dto: CreateInstitutionDto, @CurrentUser() user: AuthenticatedUser): Promise<InstitutionDto> {
    return this.institutions.create(dto, user);
  }

  @Get()
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les établissements (carte et filtres)' })
  @ApiQuery({ name: 'validationStatus', enum: ValidationStatus, enumName: 'ValidationStatus', required: false })
  @ApiOkResponse({ type: [InstitutionDto] })
  list(@Query('validationStatus') validationStatus?: ValidationStatus): Promise<InstitutionDto[]> {
    return this.institutions.list(validationStatus);
  }

  @Patch(':id/validate')
  @ApiRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Valider ou rejeter un établissement' })
  @ApiParam({ name: 'id', example: MOCK_IDS.institution })
  @ApiOkResponse({ type: InstitutionDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateInstitutionDto,
  ): Promise<InstitutionDto> {
    return this.institutions.validate(id, dto.validationStatus);
  }
}
