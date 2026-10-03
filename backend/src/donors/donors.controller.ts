// AJOUT : T3 - squelette du contrôleur donors (données mockées, services réels en T4.1 à T4.3)
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { BloodGroup, EligibilityStatus, UserRole } from '../common/enums';
import { MOCK_DONOR_POSITION, MOCK_IDS, MOCK_NOW } from '../contract/mocks';
import {
  DonorProfileDto,
  DonorRegisterDto,
  EligibilityFormDto,
  EligibilityResultDto,
  NextDonationDateDto,
  UpdateDonorDto,
} from './dto/donors.dto';

const mockProfile = (): DonorProfileDto => ({
  userId: MOCK_IDS.donorUser,
  fullName: 'Amine Ben Salah',
  phone: '+21612345678',
  bloodGroup: BloodGroup.A_POS,
  bloodGroupConfirmed: false,
  zone: 'Tunis',
  position: MOCK_DONOR_POSITION,
  available: true,
  eligibilityStatus: EligibilityStatus.ELIGIBLE,
  lastDonationDate: '2026-06-12',
  nextDonationPossibleDate: '2026-09-10',
  maxRadiusKm: 20,
  notifPrefs: { alertsEnabled: true, quietHours: { start: '22:00', end: '07:00' } },
  consentAt: MOCK_NOW,
});

@ApiTags('donors')
@Controller('donors')
export class DonorsController {
  @Post('register')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Créer le profil donneur',
    description:
      "À appeler après la vérification OTP. Crée le profil (groupe déclaré, zone, position consentie). Le statut d'éligibilité reste en_attente jusqu'au formulaire.",
  })
  @ApiCreatedResponse({ type: DonorProfileDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Consentement manquant ou données invalides' })
  register(@Body() _dto: DonorRegisterDto): DonorProfileDto {
    return { ...mockProfile(), eligibilityStatus: EligibilityStatus.EN_ATTENTE };
  }

  @Get('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({ summary: 'Mon profil donneur' })
  @ApiOkResponse({ type: DonorProfileDto })
  getMe(): DonorProfileDto {
    return mockProfile();
  }

  @Patch('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Modifier mon profil et mes préférences',
    description: "Disponibilité, zone, position (action explicite), rayon maximal, alertes et plage de silence.",
  })
  @ApiOkResponse({ type: DonorProfileDto })
  updateMe(@Body() _dto: UpdateDonorDto): DonorProfileDto {
    return mockProfile();
  }

  @Post(':id/eligibility-form')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: "Soumettre le formulaire d'éligibilité",
    description:
      "Les règles (fonctions pures de M2) calculent le résultat. Les réponses sont chiffrées en base. Seul un donneur eligible reçoit des alertes.",
  })
  @ApiParam({ name: 'id', description: 'userId du donneur (doit être le sien)' })
  @ApiCreatedResponse({ type: EligibilityResultDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  submitEligibilityForm(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body() _dto: EligibilityFormDto,
  ): EligibilityResultDto {
    return {
      result: EligibilityStatus.ELIGIBLE,
      reasons: [],
      questionnaireVersion: 'v1',
      medicalConfirmationRequired: true,
    };
  }

  @Get(':id/next-donation-date')
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT)
  @ApiOperation({ summary: 'Date du prochain don possible' })
  @ApiParam({ name: 'id', description: 'userId du donneur' })
  @ApiOkResponse({ type: NextDonationDateDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  nextDonationDate(@Param('id', ParseUUIDPipe) _id: string): NextDonationDateDto {
    return {
      nextDonationPossibleDate: '2026-09-10',
      canDonateNow: true,
      message: 'Vous pouvez donner dès maintenant',
    };
  }
}
