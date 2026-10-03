// AJOUT : T3 - squelette du contrôleur events (données mockées, services réels en T6)
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
import { ApiRoles } from '../common/decorators/api-roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { BloodGroup, EventStatus, RegistrationStatus, UserRole } from '../common/enums';
import { MOCK_DONOR_POSITION, MOCK_IDS } from '../contract/mocks';
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

const mockEvent = (id: string = MOCK_IDS.event): EventDto => ({
  id,
  organizerId: MOCK_IDS.crtUser,
  title: 'Collecte de sang - Faculté des Sciences de Tunis',
  placeName: 'Faculté des Sciences de Tunis',
  address: 'Campus universitaire, 2092 Tunis',
  position: MOCK_DONOR_POSITION,
  eventDate: '2026-10-15',
  slots: [
    { time: '09:00', capacity: 20 },
    { time: '11:00', capacity: 20 },
    { time: '14:00', capacity: 20 },
  ],
  capacity: 60,
  registeredCount: 12,
  targetGroups: [BloodGroup.O_NEG, BloodGroup.A_NEG],
  conditions: "Apporter une pièce d'identité",
  status: EventStatus.PUBLIE,
  distanceKm: 4.8,
});

const mockRegistration = (eventId: string, slot = '09:00'): EventRegistrationDto => ({
  id: MOCK_IDS.registration,
  eventId,
  donorId: MOCK_IDS.donorUser,
  slot,
  status: RegistrationStatus.INSCRIT,
  qrToken: 'signed.qr.token',
});

@ApiTags('events')
@Controller('events')
export class EventsController {
  @Get()
  @ApiRoles(UserRole.DONNEUR, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Calendrier des événements',
    description: 'Liste filtrable par gouvernorat, date et distance (F4.2).',
  })
  @ApiOkResponse({ type: [EventDto] })
  list(@Query() _query: ListEventsQueryDto): EventDto[] {
    return [mockEvent()];
  }

  @Post()
  @ApiRoles(UserRole.CRT)
  @ApiOperation({
    summary: 'Publier un événement',
    description:
      "Déclenche les notifications de priorité normale aux donneurs éligibles de la zone, sans vagues. L'événement apparaît dans le calendrier en moins de 5 s.",
  })
  @ApiCreatedResponse({ type: EventDto })
  create(@Body() _dto: CreateEventDto): EventDto {
    return mockEvent();
  }

  @Get(':id')
  @ApiRoles(UserRole.DONNEUR, UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({ summary: "Détail d'un événement" })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiOkResponse({ type: EventDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getOne(@Param('id', ParseUUIDPipe) id: string): EventDto {
    return mockEvent(id);
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
  register(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterEventDto): EventRegistrationDto {
    return mockRegistration(id, dto.slot);
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
  checkin(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: CheckinDto): CheckinResultDto {
    return {
      registration: { ...mockRegistration(id), status: RegistrationStatus.PRESENT },
      donationId: MOCK_IDS.donation,
      nextDonationPossibleDate: '2027-01-03',
    };
  }

  @Get(':id/dashboard')
  @ApiRoles(UserRole.CRT, UserRole.DIRECTION, UserRole.ADMIN)
  @ApiOperation({ summary: "Tableau de bord de l'organisateur" })
  @ApiParam({ name: 'id', example: MOCK_IDS.event })
  @ApiOkResponse({ type: EventDashboardDto })
  dashboard(@Param('id', ParseUUIDPipe) id: string): EventDashboardDto {
    return {
      eventId: id,
      registered: 42,
      present: 35,
      absent: 7,
      donations: 33,
      byBloodGroup: [
        { bloodGroup: BloodGroup.O_POS, count: 12 },
        { bloodGroup: BloodGroup.A_POS, count: 9 },
        { bloodGroup: BloodGroup.B_POS, count: 5 },
        { bloodGroup: BloodGroup.O_NEG, count: 3 },
        { bloodGroup: BloodGroup.A_NEG, count: 2 },
        { bloodGroup: BloodGroup.AB_POS, count: 2 },
      ],
    };
  }
}
