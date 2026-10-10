// T3 : squelette (live reste mocké jusqu'à T5.5).
// AJOUT : T5.5 - live branché sur RequestsService.getLiveState (ancien mock T3 retiré).
// T2.4 : POST /requests exige un établissement validé (F5).
// AJOUT : T4.4 / T4.5 - create, list, getOne et respond branchés sur RequestsService.
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { BloodGroup, RequestStatus, UrgencyLevel, UserRole } from '../common/enums';
import { MOCK_IDS, MOCK_NOW } from '../contract/mocks';
import { RequestsService } from './requests.service';
import {
  CreateRequestDto,
  LiveStateDto,
  RequestDto,
  RespondDto,
  RespondResultDto,
} from './dto/requests.dto';

const mockRequest = (id: string = MOCK_IDS.request): RequestDto => ({
  id,
  institutionId: MOCK_IDS.institution,
  institutionName: 'Hôpital Charles Nicolle',
  bloodGroup: BloodGroup.A_POS,
  quantity: 10,
  urgency: UrgencyLevel.URGENTE,
  deadline: '2026-10-03T18:00:00.000Z',
  initialRadiusKm: 5,
  currentRadiusKm: 5,
  maxRadiusKm: 30,
  status: RequestStatus.ACTIVE,
  anomalyScore: 0.12,
  createdAt: MOCK_NOW,
});

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @ApiRoles(UserRole.HOPITAL)
  @ApiOperation({
    summary: 'Créer une demande urgente',
    description:
      "Réservé à un hôpital dont l'établissement est validé. Si le score d'anomalie est élevé, la demande passe en en_revue et aucune alerte n'est envoyée avant validation manuelle. Sinon la vague 1 démarre immédiatement (moins de 10 s).",
  })
  @ApiCreatedResponse({ type: RequestDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthenticatedUser): Promise<RequestDto> {
    return this.requests.create(dto, user);
  }

  @Get()
  @ApiRoles(UserRole.HOPITAL, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Lister les demandes',
    description: "Pour un hôpital : ses demandes. Pour la direction et l'admin : toutes.",
  })
  @ApiQuery({ name: 'status', enum: RequestStatus, enumName: 'RequestStatus', required: false })
  @ApiOkResponse({ type: [RequestDto] })
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: RequestStatus): Promise<RequestDto[]> {
    return this.requests.list(user, status);
  }

  @Get(':id')
  @ApiRoles(UserRole.HOPITAL, UserRole.DIRECTION, UserRole.ADMIN, UserRole.DONNEUR)
  @ApiOperation({ summary: "Détail d'une demande" })
  @ApiParam({ name: 'id', example: MOCK_IDS.request })
  @ApiOkResponse({ type: RequestDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<RequestDto> {
    return this.requests.getOne(id, user);
  }

  @Get(':id/live')
  @ApiRoles(UserRole.HOPITAL, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'État courant du suivi en direct',
    description:
      "Chargement initial de l'écran de suivi. Ensuite, les mises à jour arrivent par WebSocket (namespace /live, voir docs/ws-live.md).",
  })
  @ApiParam({ name: 'id', example: MOCK_IDS.request })
  @ApiOkResponse({ type: LiveStateDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  // AJOUT : T5.5 - données réelles (jauge, vagues, donneurs en route anonymisés) ; 403 si l'hôpital n'est pas propriétaire.
  live(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<LiveStateDto> {
    return this.requests.getLiveState(id, user);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'Répondre à une alerte (Je viens / Je ne peux pas)',
    description:
      "Contrôle serveur : demande encore active, donneur compatible et éligible, délai entre dons écoulé (3ᵉ niveau de F2.4). Une seule réponse par donneur et par demande.",
  })
  @ApiParam({ name: 'id', example: MOCK_IDS.request })
  @ApiOkResponse({ type: RespondResultDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Déjà répondu, demande close, ou donneur non éligible à ce jour',
  })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RespondResultDto> {
    return this.requests.respond(id, dto, user);
  }
}
