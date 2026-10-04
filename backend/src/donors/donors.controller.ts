// T4.1 : register, GET/PATCH me réels (DonorsService). T4.3 : next-donation-date réel (DonationsService).
// T4.2 : eligibility-form réel (EligibilityFormService, réponses chiffrées).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { UserRole } from '../common/enums';
import { DonationsService } from '../donations/donations.service';
import {
  DonorProfileDto,
  DonorRegisterDto,
  EligibilityFormDto,
  EligibilityResultDto,
  NextDonationDateDto,
  UpdateDonorDto,
} from './dto/donors.dto';
import { DonorsService } from './donors.service';
import { EligibilityFormService } from './eligibility-form.service';

@ApiTags('donors')
@Controller('donors')
export class DonorsController {
  constructor(
    private readonly donors: DonorsService,
    private readonly donations: DonationsService,
    private readonly eligibility: EligibilityFormService,
  ) {}

  @Post('register')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Créer le profil donneur',
    description:
      "À appeler après la vérification OTP. Crée le profil (groupe déclaré, zone, position consentie). Le statut d'éligibilité reste en_attente jusqu'au formulaire.",
  })
  @ApiCreatedResponse({ type: DonorProfileDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Consentement manquant ou données invalides',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Profil donneur déjà créé pour ce compte',
  })
  register(
    @Body() dto: DonorRegisterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DonorProfileDto> {
    return this.donors.register(user.id, dto);
  }

  @Get('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({ summary: 'Mon profil donneur' })
  @ApiOkResponse({ type: DonorProfileDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Profil non créé (appeler POST /donors/register)',
  })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<DonorProfileDto> {
    return this.donors.getMe(user.id);
  }

  @Patch('me')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Modifier mon profil et mes préférences',
    description:
      'Disponibilité, zone, position (action explicite), rayon maximal, alertes et plage de silence.',
  })
  @ApiOkResponse({ type: DonorProfileDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Profil non créé (appeler POST /donors/register)',
  })
  updateMe(
    @Body() dto: UpdateDonorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DonorProfileDto> {
    return this.donors.updateMe(user.id, dto);
  }

  @Post(':id/eligibility-form')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: "Soumettre le formulaire d'éligibilité",
    description:
      'Les règles (fonctions pures de M2) calculent le résultat. Les réponses sont chiffrées en base. Seul un donneur eligible reçoit des alertes.',
  })
  @ApiParam({
    name: 'id',
    description: 'userId du donneur (doit être le sien)',
  })
  @ApiCreatedResponse({ type: EligibilityResultDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Consentement manquant ou réponses invalides',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Un donneur ne remplit que son propre formulaire',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Profil non créé (appeler POST /donors/register)',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Statut définitif : formulaire non re-soumettable',
  })
  submitEligibilityForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EligibilityFormDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EligibilityResultDto> {
    return this.eligibility.submit(user, id, dto);
  }

  @Get(':id/next-donation-date')
  @ApiRoles(UserRole.DONNEUR, UserRole.HOPITAL, UserRole.CRT)
  @ApiOperation({
    summary: 'Date du prochain don possible',
    description:
      "Un donneur consulte uniquement son propre dossier (403 sinon). canDonateNow vaut false tant que le donneur n'est pas eligible (en_attente, temporaire, definitif) ou que le délai entre dons n'est pas écoulé.",
  })
  @ApiParam({ name: 'id', description: 'userId du donneur' })
  @ApiOkResponse({ type: NextDonationDateDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: "Un donneur ne peut pas consulter le dossier d'un autre",
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  nextDonationDate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NextDonationDateDto> {
    return this.donations.nextDonationDate(user, id);
  }
}
