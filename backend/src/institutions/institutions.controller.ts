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
// AJOUT : POST /institutions reste accessible tant que l'établissement n'est pas validé
import { AllowUnvalidatedInstitution } from '../common/decorators/allow-unvalidated-institution.decorator';
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

  // AJOUT : réservé à l'admin (GET /institutions), pour vérifier dans le référentiel CNTS et rappeler le fixe avant d'approuver
  @ApiPropertyOptional({ example: '+21671123456', description: "Admin uniquement : téléphone (fixe) du compte qui a déclaré l'établissement" })
  declarantPhone?: string;

  // AJOUT : réservé à l'admin
  @ApiPropertyOptional({ example: 'Personnel Hôpital Charles Nicolle', description: "Admin uniquement : nom du compte qui a déclaré l'établissement" })
  declarantName?: string;
}

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Post()
  // AJOUT : seule route (avec GET /users/me) ouverte aux comptes hopital/crt non validés
  @AllowUnvalidatedInstitution()
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
  // AJOUT : description mise à jour (champs admin)
  @ApiOperation({
    summary: 'Lister les établissements (carte et filtres)',
    description: "Pour l'admin, chaque établissement inclut declarantPhone et declarantName (compte qui l'a déclaré).",
  })
  @ApiQuery({ name: 'validationStatus', enum: ValidationStatus, enumName: 'ValidationStatus', required: false })
  @ApiOkResponse({ type: [InstitutionDto] })
  // AJOUT : @CurrentUser() ajouté pour savoir si l'appelant est admin (signature d'origine : list(@Query('validationStatus') validationStatus?: ValidationStatus))
  list(
    @Query('validationStatus') validationStatus?: ValidationStatus,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<InstitutionDto[]> {
    return this.institutions.list(validationStatus, user);
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
