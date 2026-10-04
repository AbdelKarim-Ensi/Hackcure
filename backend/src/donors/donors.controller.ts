// T4.1 : register, GET/PATCH me réels (DonorsService). T3 : eligibility-form et next-donation-date restent mockés (T4.2, T4.3).
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { EligibilityStatus, UserRole } from '../common/enums';
import {
  DonorProfileDto,
  DonorRegisterDto,
  EligibilityFormDto,
  EligibilityResultDto,
  NextDonationDateDto,
  UpdateDonorDto,
} from './dto/donors.dto';
import { DonorsService } from './donors.service';

@ApiTags('donors')
@Controller('donors')
export class DonorsController {
  constructor(private readonly donors: DonorsService) {}

  @Post('register')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Créer le profil donneur',
    description:
      "À appeler après la vérification OTP. Crée le profil (groupe déclaré, zone, position consentie). Le statut d'éligibilité reste en_attente jusqu'au formulaire.",
  })
  @ApiCreatedResponse({ type: DonorProfileDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Consentement manquant ou données invalides' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Profil donneur déjà créé pour ce compte' })
  register(@Body() dto: DonorRegisterDto, @CurrentUser() user: AuthenticatedUser): Promise<DonorProfileDto> {
    return this.donors.register(user.id, dto);
  }

  @Get('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({ summary: 'Mon profil donneur' })
  @ApiOkResponse({ type: DonorProfileDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Profil non créé (appeler POST /donors/register)' })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<DonorProfileDto> {
    return this.donors.getMe(user.id);
  }

  @Patch('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Modifier mon profil et mes préférences',
    description: "Disponibilité, zone, position (action explicite), rayon maximal, alertes et plage de silence.",
  })
  @ApiOkResponse({ type: DonorProfileDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Profil non créé (appeler POST /donors/register)' })
  updateMe(@Body() dto: UpdateDonorDto, @CurrentUser() user: AuthenticatedUser): Promise<DonorProfileDto> {
    return this.donors.updateMe(user.id, dto);
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
