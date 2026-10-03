// AJOUT : T3 - position géographique échangée avec les clients (WGS 84)
import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ example: 36.8065, description: 'Latitude (WGS 84)' })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 10.1815, description: 'Longitude (WGS 84)' })
  @IsLongitude()
  longitude!: number;
}
