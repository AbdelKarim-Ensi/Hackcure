// AJOUT : T3 - squelette du contrôleur stocks (DTO inclus, service réel en T6.6)
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { GeoPointDto } from '../common/dto/geo-point.dto';
import { BloodGroup, StockLevel, UserRole } from '../common/enums';
import { MOCK_HOSPITAL_POSITION, MOCK_IDS } from '../contract/mocks';

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

const THRESHOLD = 10;
const levelOf = (quantity: number): StockLevel =>
  quantity < THRESHOLD ? StockLevel.ROUGE : quantity <= THRESHOLD * 1.5 ? StockLevel.ORANGE : StockLevel.VERT;

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  @Get()
  @ApiRoles(UserRole.HOPITAL, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Stocks par établissement et par groupe sanguin',
    description: 'Alimente la carte des stocks (rouge, orange, vert). Un hôpital ne voit que son établissement, la direction voit tout.',
  })
  @ApiQuery({ name: 'institutionId', required: false, example: MOCK_IDS.institution })
  @ApiOkResponse({ type: [InstitutionStockDto] })
  list(@Query('institutionId') _institutionId?: string): InstitutionStockDto[] {
    const quantities: Record<BloodGroup, number> = {
      [BloodGroup.A_POS]: 6,
      [BloodGroup.A_NEG]: 14,
      [BloodGroup.B_POS]: 22,
      [BloodGroup.B_NEG]: 4,
      [BloodGroup.AB_POS]: 12,
      [BloodGroup.AB_NEG]: 9,
      [BloodGroup.O_POS]: 30,
      [BloodGroup.O_NEG]: 3,
    };
    return [
      {
        institutionId: MOCK_IDS.institution,
        institutionName: 'Hôpital Charles Nicolle',
        position: MOCK_HOSPITAL_POSITION,
        stocks: Object.values(BloodGroup).map((bloodGroup) => ({
          bloodGroup,
          quantity: quantities[bloodGroup],
          alertThreshold: THRESHOLD,
          level: levelOf(quantities[bloodGroup]),
        })),
      },
    ];
  }
}
