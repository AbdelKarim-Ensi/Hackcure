// AJOUT : T3 - squelette du contrôleur stocks (DTO inclus, service réel en T6.6)
// AJOUT : T6.6 - list branché sur StocksService (plus de mock, contrat inchangé).
import { Controller, Get, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
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
}
