// AJOUT : T3 - DTO du module donors (contrat v1)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BloodGroup, EligibilityStatus, Sex } from '../../common/enums';
import { GeoPointDto } from '../../common/dto/geo-point.dto';

export class QuietHoursDto {
  @ApiProperty({ example: '22:00', description: 'Début de la plage de silence (HH:mm)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start!: string;

  @ApiProperty({ example: '07:00', description: 'Fin de la plage de silence (HH:mm)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end!: string;
}

export class NotifPrefsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  alertsEnabled!: boolean;

  @ApiPropertyOptional({
    type: QuietHoursDto,
    nullable: true,
    description: 'Plage de silence. Ignorée pour les urgences critiques (F3.6).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto | null;
}

export class DonorRegisterDto {
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup', example: BloodGroup.A_POS, description: 'Groupe déclaré, à confirmer au 1er don' })
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  @ApiPropertyOptional({ enum: Sex, enumName: 'Sex', example: Sex.HOMME })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiProperty({ example: 'Tunis', description: 'Zone ou gouvernorat' })
  @IsString()
  zone!: string;

  @ApiProperty({ type: GeoPointDto, description: 'Position approximative consentie (F3.8), jamais de suivi continu' })
  @ValidateNested()
  @Type(() => GeoPointDto)
  position!: GeoPointDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiProperty({ example: true, description: 'Consentement explicite (santé et géolocalisation). Doit être true.' })
  @IsBoolean()
  consent!: boolean;
}

export class UpdateDonorDto {
  @ApiPropertyOptional({ example: 'Ariana' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ type: GeoPointDto, description: 'Mise à jour explicite de la position (action volontaire)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  position?: GeoPointDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, description: 'Rayon maximal accepté pour les alertes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxRadiusKm?: number;

  @ApiPropertyOptional({ type: NotifPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotifPrefsDto)
  notifPrefs?: NotifPrefsDto;
}

export class DonorProfileDto {
  @ApiProperty({ example: '3f1c7a52-8d0e-4b8a-9a55-1c2d3e4f5a61' })
  userId!: string;

  @ApiPropertyOptional({ example: 'Amine Ben Salah' })
  fullName?: string;

  @ApiProperty({ example: '+21612345678' })
  phone!: string;

  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup' })
  bloodGroup!: BloodGroup;

  @ApiProperty({ example: false, description: 'true après confirmation au 1er don' })
  bloodGroupConfirmed!: boolean;

  @ApiPropertyOptional({ enum: Sex, enumName: 'Sex' })
  sex?: Sex;

  @ApiPropertyOptional({ example: 'Tunis' })
  zone?: string;

  @ApiPropertyOptional({ type: GeoPointDto })
  position?: GeoPointDto;

  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({ enum: EligibilityStatus, enumName: 'EligibilityStatus', description: 'Seuls les profils eligible reçoivent des alertes' })
  eligibilityStatus!: EligibilityStatus;

  @ApiPropertyOptional({ example: '2027-01-15', description: 'Date de réévaluation (statut temporaire)' })
  reevalDate?: string;

  @ApiPropertyOptional({ example: '2026-06-12' })
  lastDonationDate?: string;

  @ApiPropertyOptional({ example: '2026-09-10', description: 'Affichage : « Prochain don possible le JJ/MM »' })
  nextDonationPossibleDate?: string;

  @ApiProperty({ example: 20 })
  maxRadiusKm!: number;

  @ApiProperty({ type: NotifPrefsDto })
  notifPrefs!: NotifPrefsDto;

  @ApiPropertyOptional({ example: '2026-10-03T10:30:00.000Z' })
  consentAt?: string;
}

/**
 * Réponses du formulaire d'éligibilité (liste indicative du PRD F1.2, à valider avec le CNTS).
 * Stockées chiffrées côté serveur (AES-256-GCM, T7.1).
 */
export class EligibilityFormDto {
  @ApiProperty({ example: 27, minimum: 0 })
  @IsInt()
  @Min(0)
  age!: number;

  @ApiProperty({ example: 72, description: 'Poids en kg' })
  @IsNumber()
  @Min(0)
  weightKg!: number;

  @ApiPropertyOptional({ example: '2026-06-12', description: 'Date du dernier don, si déjà donné (y compris hors plateforme, F2.6)' })
  @IsOptional()
  @IsDateString()
  lastDonationDate?: string;

  @ApiProperty({ example: false, description: 'Maladie chronique' })
  @IsBoolean()
  chronicDisease!: boolean;

  @ApiProperty({ example: false, description: 'Traitement en cours' })
  @IsBoolean()
  onTreatment!: boolean;

  @ApiProperty({ example: false, description: "Antécédents d'hépatite ou de VIH" })
  @IsBoolean()
  hepatitisOrHivHistory!: boolean;

  @ApiProperty({ example: false, description: 'Intervention chirurgicale récente' })
  @IsBoolean()
  recentSurgery!: boolean;

  @ApiProperty({ example: false, description: 'Tatouage ou piercing récent' })
  @IsBoolean()
  recentTattooOrPiercing!: boolean;

  @ApiProperty({ example: false, description: 'Transfusion récente' })
  @IsBoolean()
  recentTransfusion!: boolean;

  @ApiProperty({ example: false, description: 'Voyage récent en zone à risque' })
  @IsBoolean()
  riskAreaTravel!: boolean;

  @ApiProperty({ example: false, description: 'Vaccination récente' })
  @IsBoolean()
  recentVaccination!: boolean;

  @ApiProperty({ example: false, description: 'Fièvre ou infection récente' })
  @IsBoolean()
  recentFeverOrInfection!: boolean;

  @ApiPropertyOptional({ example: false, description: 'Grossesse ou allaitement (le cas échéant)' })
  @IsOptional()
  @IsBoolean()
  pregnantOrBreastfeeding?: boolean;

  @ApiProperty({ example: true, description: 'Consentement explicite au traitement des données de santé' })
  @IsBoolean()
  consent!: boolean;
}

export class EligibilityResultDto {
  @ApiProperty({ enum: EligibilityStatus, enumName: 'EligibilityStatus', example: EligibilityStatus.ELIGIBLE })
  result!: EligibilityStatus;

  @ApiPropertyOptional({ example: '2027-01-15', description: 'Présente si result = temporaire' })
  reevalDate?: string;

  @ApiPropertyOptional({
    type: [String],
    example: [],
    description: 'Motifs lisibles (inéligibilité). Jamais de détail médical brut.',
  })
  reasons?: string[];

  @ApiProperty({ example: 'v1' })
  questionnaireVersion!: string;

  @ApiProperty({
    example: true,
    description: "Toujours true : l'éligibilité finale est confirmée par le personnel médical le jour du don (R6)",
  })
  medicalConfirmationRequired!: boolean;
}

export class NextDonationDateDto {
  @ApiPropertyOptional({ example: '2026-09-10', nullable: true, description: 'null si le donneur n\'a jamais donné' })
  nextDonationPossibleDate!: string | null;

  @ApiProperty({ example: true })
  canDonateNow!: boolean;

  @ApiProperty({ example: 'Vous pouvez donner dès maintenant' })
  message!: string;
}
