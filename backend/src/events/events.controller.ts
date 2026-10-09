// AJOUT : T3 - squelette du contrôleur events (données mockées, services réels en T6)
// AJOUT : T6.1 - list, create et getOne branchés sur EventsService.
// AJOUT : T6.2 - register branché sur EventsService.register.
// AJOUT : T6.4 - checkin branché sur EventCheckinService.
// AJOUT : T6.5 - dashboard branché sur EventDashboardService (plus de mock).
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { UserRole } from '../common/enums';
import { MOCK_IDS } from '../contract/mocks';
import {
  CheckinDto,
  CheckinResultDto,
  CreateEventDto,
  EventDashboardDto,
  EventDto,
  EventRegistrationDto,
  ListEventsQueryDto,
  RegisterEventDto,
} from './dto/events.dto';
import { EventCheckinService } from './events-checkin.service';
import { EventDashboardService } from './events-dashboard.service';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly checkinService: EventCheckinService,
    private readonly dashboardService: EventDashboardService,
  ) {}

  @Get()
  @ApiRoles(UserRole.DONNEUR, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Calendrier des événements',
    description: 'Liste filtrable par gouvernorat, date et distance (F4.2).',
  })
  @ApiOkResponse({ type: [EventDto] })
  list(@Query() query: ListEventsQueryDto): Promise<EventDto[]> {
    return this.events.list(query);
  }

  @Post()
  @ApiRoles(UserRole.CRT)
  @ApiOperation({
    summary: 'Publier un événement',
    description:
      "Déclenche les notifications de priorité normale aux donneurs éligibles de la zone, sans vagues. L'événement apparaît dans le calendrier en moins de 5 s.",
  })
  @ApiCreatedResponse({ type: EventDto })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser): Promise<EventDto> {
    return this.events.create(user.id, dto);
  }

  @Get(':id')
  @ApiRoles(UserRole.DONNEUR, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({ summary: "Détail d'un événement" })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiOkResponse({ type: EventDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<EventDto> {
    return this.events.getOne(id);
  }

  @Post(':id/register')
  @ApiRoles(UserRole.DONNEUR)
  @ApiOperation({
    summary: 'S\'inscrire à un créneau',
    description:
      "Refusée (422) si le donneur n'est pas éligible à la date de l'événement (règle R5, délai entre dons) ou (409) si la capacité est atteinte.",
  })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiCreatedResponse({ type: EventRegistrationDto })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: "Donneur non éligible à la date de l'événement",
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Capacité atteinte ou déjà inscrit' })
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventRegistrationDto> {
    return this.events.register(id, dto, user);
  }

  @Post(':id/checkin')
  @HttpCode(200)
  @ApiRoles(UserRole.CRT)
  @ApiOperation({
    summary: 'Pointer un donneur présent',
    description:
      "Par QR code ou pointage manuel. Marque la présence, enregistre le don et recalcule la date du prochain don.",
  })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiOkResponse({ type: CheckinResultDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Inscription introuvable ou jeton invalide' })
  checkin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckinDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckinResultDto> {
    return this.checkinService.checkin(id, dto, user);
  }

  @Get(':id/dashboard')
  @ApiRoles(UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({ summary: "Tableau de bord de l'organisateur" })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiOkResponse({ type: EventDashboardDto })
  dashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EventDashboardDto> {
    return this.dashboardService.dashboard(id, user);
  }
}
