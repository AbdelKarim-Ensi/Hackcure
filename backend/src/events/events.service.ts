// AJOUT : T6.1 - service réel des événements CRT (liste filtrée, création, détail).
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { EventStatus as DbEventStatus, RegistrationStatus } from '../database/enums';
import { EventStatus } from '../common/enums';
import { CreateEventDto, EventDto, ListEventsQueryDto } from './dto/events.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>,
    @InjectRepository(EventRegistration) private readonly registrations: Repository<EventRegistration>,
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
    return this.getOne(saved.id);
  }
}
