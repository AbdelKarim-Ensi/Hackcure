// AJOUT : T6.1 - service réel des événements CRT (liste filtrée, création, détail).
// AJOUT : T6.2 - inscription à un créneau (R5 à la date de l'événement, capacité sous verrou, QR signé).
// AJOUT : T6.3 - notification du nouvel événement et planification des rappels (best-effort, hors réponse HTTP).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { Donor } from '../database/entities/identity.entities';
import { EligibilityStatus, EventStatus as DbEventStatus, RegistrationStatus } from '../database/enums';
import { EventStatus } from '../common/enums';
import {
  CreateEventDto,
  EventDto,
  EventRegistrationDto,
  ListEventsQueryDto,
  RegisterEventDto,
} from './dto/events.dto';
import { EventNotifier } from './event-notifier.service';
import { QrTokenService } from './qr-token.service';

type SlotDef = { time: string; capacity?: number };

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>,
    @InjectRepository(EventRegistration) private readonly registrations: Repository<EventRegistration>,
    private readonly dataSource: DataSource,
    private readonly qr: QrTokenService,
    private readonly notifier: EventNotifier,
  ) {}

  /** Requête de base : lit aussi lat/lng de la position, et la distance si lat/lng sont fournis. */
  private baseQuery(q?: ListEventsQueryDto): SelectQueryBuilder<CrtEvent> {
    const qb = this.events
      .createQueryBuilder('e')
      .addSelect('ST_Y(e.position::geometry)', 'lat')
      .addSelect('ST_X(e.position::geometry)', 'lng');

    if (q?.lat != null && q?.lng != null) {
      qb.addSelect(
        'ST_Distance(e.position, ST_SetSRID(ST_MakePoint(:refLng, :refLat), 4326)::geography) / 1000',
        'dist',
      ).setParameters({ refLng: q.lng, refLat: q.lat });
    }
    return qb;
  }

  private async registeredCounts(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (ids.length === 0) return map;
    const rows = await this.registrations
      .createQueryBuilder('r')
      .select('r.eventId', 'eventId')
      .addSelect('COUNT(*)', 'n')
      .where('r.eventId IN (:...ids)', { ids })
      .andWhere('r.status = :s', { s: RegistrationStatus.Inscrit })
      .groupBy('r.eventId')
      .getRawMany<{ eventId: string; n: string }>();
    rows.forEach((r) => map.set(r.eventId, Number(r.n)));
    return map;
  }

  private toDto(e: CrtEvent, raw: Record<string, any>, registered: number): EventDto {
    return {
      id: e.id,
      organizerId: e.organizerId,
      title: e.title,
      placeName: e.placeName,
      address: e.address ?? undefined,
      position:
        raw.lat != null && raw.lng != null
          ? { latitude: Number(raw.lat), longitude: Number(raw.lng) }
          : undefined,
      eventDate: e.eventDate,
      slots: e.slots as unknown as EventDto['slots'],
      capacity: e.capacity,
      registeredCount: registered,
      targetGroups: (e.targetGroups ?? undefined) as EventDto['targetGroups'],
      conditions: e.conditions ?? undefined,
      status: e.status as unknown as EventStatus,
      distanceKm: raw.dist != null ? Math.round(Number(raw.dist) * 10) / 10 : undefined,
    };
  }

  async list(q: ListEventsQueryDto): Promise<EventDto[]> {
    const qb = this.baseQuery(q).where('e.status = :st', { st: DbEventStatus.Publie });

    if (q.governorate) {
      qb.andWhere('(e.placeName ILIKE :g OR e.address ILIKE :g)', { g: `%${q.governorate}%` });
    }
    if (q.dateFrom) qb.andWhere('e.eventDate >= :dateFrom', { dateFrom: q.dateFrom });
    if (q.dateTo) qb.andWhere('e.eventDate <= :dateTo', { dateTo: q.dateTo });
    if (q.lat != null && q.lng != null && q.maxDistanceKm) {
      qb.andWhere(
        'ST_DWithin(e.position, ST_SetSRID(ST_MakePoint(:refLng, :refLat), 4326)::geography, :maxM)',
        { maxM: q.maxDistanceKm * 1000 },
      );
    }

    const { entities, raw } = await qb.orderBy('e.eventDate', 'ASC').getRawAndEntities();
    const counts = await this.registeredCounts(entities.map((e) => e.id));
    return entities.map((e, i) => this.toDto(e, raw[i], counts.get(e.id) ?? 0));
  }

  async getOne(id: string): Promise<EventDto> {
    const { entities, raw } = await this.baseQuery().where('e.id = :id', { id }).getRawAndEntities();
    if (entities.length === 0) throw new NotFoundException('Événement introuvable');
    const counts = await this.registeredCounts([id]);
    return this.toDto(entities[0], raw[0], counts.get(id) ?? 0);
  }

  async create(organizerId: string, dto: CreateEventDto): Promise<EventDto> {
    const today = new Date().toISOString().slice(0, 10);
    if (dto.eventDate.slice(0, 10) < today) {
      throw new BadRequestException("La date de l'événement doit être dans le futur");
    }
    const slotsTotal = dto.slots.reduce((sum, s) => sum + (s.capacity ?? 0), 0);
    if (slotsTotal > dto.capacity) {
      throw new BadRequestException('La somme des capacités des créneaux dépasse la capacité totale');
    }

    const saved = await this.events.save(
      this.events.create({
        organizerId,
        title: dto.title,
        placeName: dto.placeName,
        address: dto.address ?? null,
        position: {
          type: 'Point',
          coordinates: [dto.position.longitude, dto.position.latitude],
        },
        eventDate: dto.eventDate.slice(0, 10),
        slots: dto.slots as unknown as string[],
        capacity: dto.capacity,
        targetGroups: (dto.targetGroups ?? null) as any,
        conditions: dto.conditions ?? null,
        status: DbEventStatus.Publie,
      }),
    );

    // T6.3 : notification de priorité normale, en tâche de fond (un échec ne casse pas la création).
    void this.notifier
      .notifyNewEvent(saved.id)
      .catch((e: Error) => this.logger.warn(`Notification du nouvel événement ${saved.id} échouée : ${e.message}`));

    return this.getOne(saved.id);
  }

  /** T6.2 + T6.3 : inscription, puis planification des rappels J-1 / H-2 une fois la transaction validée. */
  async register(eventId: string, dto: RegisterEventDto, user: AuthenticatedUser): Promise<EventRegistrationDto> {
    const result = await this.registerTx(eventId, dto, user);
    void this.notifier
      .scheduleReminders(result.id)
      .catch((e: Error) => this.logger.warn(`Rappels non planifiés pour l'inscription ${result.id} : ${e.message}`));
    return result;
  }

  /**
   * T6.2 : inscription à un créneau.
   * R5 : le donneur doit être éligible À LA DATE DE L'ÉVÉNEMENT (422 sinon).
   * Capacité globale et par créneau contrôlées sous verrou sur la ligne de l'événement (409 si atteinte).
   */
  private async registerTx(eventId: string, dto: RegisterEventDto, user: AuthenticatedUser): Promise<EventRegistrationDto> {
    return this.dataSource.transaction(async (m) => {
      const event = await m.findOne(CrtEvent, { where: { id: eventId }, lock: { mode: 'pessimistic_write' } });
      if (!event) throw new NotFoundException('Événement introuvable');

      const today = new Date().toISOString().slice(0, 10);
      if (event.status !== DbEventStatus.Publie) throw new ConflictException("Cet événement n'est plus ouvert");
      if (event.eventDate < today) throw new ConflictException('Cet événement est déjà passé');

      const slotDef = (event.slots as unknown as SlotDef[]).find((s) => s.time === dto.slot);
      if (!slotDef) throw new BadRequestException("Ce créneau n'existe pas pour cet événement");

      const donor = await m.findOne(Donor, { where: { userId: user.id } });
      if (!donor) throw new NotFoundException('Profil donneur introuvable');

      if (donor.eligibilityStatus !== EligibilityStatus.Eligible) {
        throw new UnprocessableEntityException("Vous n'êtes pas éligible au don");
      }
      if (donor.nextDonationPossibleDate && donor.nextDonationPossibleDate > event.eventDate) {
        throw new UnprocessableEntityException(
          `Non éligible à la date de l'événement : prochain don possible le ${donor.nextDonationPossibleDate}`,
        );
      }

      const existing = await m.findOne(EventRegistration, { where: { eventId, donorId: donor.userId } });
      if (existing && existing.status !== RegistrationStatus.Annule) {
        throw new ConflictException('Vous êtes déjà inscrit à cet événement');
      }

      const active = In([RegistrationStatus.Inscrit, RegistrationStatus.Present]);
      const total = await m.count(EventRegistration, { where: { eventId, status: active } });
      if (total >= event.capacity) throw new ConflictException("Capacité de l'événement atteinte");
      if (slotDef.capacity != null) {
        const inSlot = await m.count(EventRegistration, { where: { eventId, slot: dto.slot, status: active } });
        if (inSlot >= slotDef.capacity) throw new ConflictException('Ce créneau est complet');
      }

      const reg = existing ?? m.create(EventRegistration, { eventId, donorId: donor.userId });
      reg.slot = dto.slot;
      reg.status = RegistrationStatus.Inscrit;
      const saved = await m.save(reg);

      return {
        id: saved.id,
        eventId,
        donorId: donor.userId,
        slot: saved.slot,
        status: saved.status as unknown as EventRegistrationDto['status'],
        qrToken: this.qr.sign({ registrationId: saved.id, eventId, donorId: donor.userId }, event.eventDate),
      };
    });
  }
}
