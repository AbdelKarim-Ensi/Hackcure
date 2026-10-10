// AJOUT : T3 - squelette du contrôleur stocks (DTO inclus, service réel en T6.6)
// AJOUT : T6.6 - list branché sur StocksService (plus de mock, contrat inchangé).
// AJOUT : T8 - POST /stocks : ajout de poches par l'établissement connecté.
// AJOUT : T8 - PATCH /stocks/:bloodGroup : ajustement +/- du stock (delta).
import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GeoPointDto } from '../common/dto/geo-point.dto';
import { BloodGroup, StockLevel, UserRole } from '../common/enums';
import { MOCK_IDS } from '../contract/mocks';
import { StocksService } from './stocks.service';

export class StockLineDto {
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 6, description: 'Poches en stock' })
  quantity!: number;

  @ApiProperty({ example: 10, description: "Seuil d'alerte" })
  alertThreshold!: number;

  @ApiProperty({
    enum: StockLevel,
    enumName: 'StockLevel',
    description: 'rouge : quantité sous le seuil. orange : jusqu\'à 1,5 fois le seuil. vert : au-delà.',
  })
  level!: StockLevel;
}

export class InstitutionStockDto {
  @ApiProperty({ example: MOCK_IDS.institution })
  institutionId!: string;

  @ApiProperty({ example: 'Hôpital Charles Nicolle' })
  institutionName!: string;

  @ApiProperty({ type: GeoPointDto, description: 'Pour placer le marqueur sur la carte' })
  position!: GeoPointDto;

  @ApiProperty({ type: [StockLineDto], description: 'Une ligne par groupe sanguin (8 lignes)' })
  stocks!: StockLineDto[];
}

export class AddStockDto {
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: 12, description: 'Poches à ajouter au stock actuel (1 à 500)' })
  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @ApiPropertyOptional({ example: 15, description: "Nouveau seuil d'alerte (facultatif)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  alertThreshold?: number;
}

export class AdjustStockDto {
  @ApiProperty({ example: -3, description: 'Variation du stock : positive pour ajouter, négative pour retirer (-500 à 500, hors 0)' })
  @IsInt()
  @Min(-500)
  @Max(500)
  delta!: number;
}

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}

  @Get()
  @ApiRoles(UserRole.HOPITAL, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Stocks par établissement et par groupe sanguin',
    description: 'Alimente la carte des stocks (rouge, orange, vert). Un hôpital ne voit que son établissement, la direction voit tout.',
  })
  @ApiQuery({ name: 'institutionId', required: false, example: MOCK_IDS.institution })
  @ApiOkResponse({ type: [InstitutionStockDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('institutionId', new ParseUUIDPipe({ optional: true })) institutionId?: string,
  ): Promise<InstitutionStockDto[]> {
    return this.service.list(user, institutionId);
  }

  @Post()
  @ApiRoles(UserRole.HOPITAL)
  @ApiOperation({
    summary: 'Ajouter des poches au stock de son établissement',
    description: 'Ajoute la quantité au stock actuel du groupe (la ligne est créée si absente). Le seuil est mis à jour si fourni.',
  })
  @ApiCreatedResponse({ type: InstitutionStockDto })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddStockDto): Promise<InstitutionStockDto> {
    return this.service.add(user, dto);
  }

  @Patch(':bloodGroup')
  @ApiRoles(UserRole.HOPITAL)
  @ApiOperation({
    summary: 'Ajuster le stock d\'un groupe (+ ou -)',
    description: 'Applique delta au stock actuel du groupe. 400 si delta vaut 0 ou si le stock final serait négatif.',
  })
  @ApiParam({ name: 'bloodGroup', enum: BloodGroup, enumName: 'BloodGroup' })
  @ApiOkResponse({ type: InstitutionStockDto })
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bloodGroup', new ParseEnumPipe(BloodGroup)) bloodGroup: BloodGroup,
    @Body() dto: AdjustStockDto,
  ): Promise<InstitutionStockDto> {
    return this.service.adjust(user, bloodGroup, dto.delta);
  }
}
