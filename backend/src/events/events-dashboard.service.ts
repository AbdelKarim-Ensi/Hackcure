// AJOUT : T6.5 - tableau de bord de l'organisateur : agrégats réels (inscrits, présents, absents, dons, groupes).
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BloodGroup } from '../common/enums';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { Donor } from '../database/entities/identity.entities';
import { RegistrationStatus, UserRole } from '../database/enums';
import { EventDashboardDto } from './dto/events.dto';

/** Date du jour à Tunis (YYYY-MM-DD). */
const tunisToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now);

@Injectable()
export class EventDashboardService {
  constructor(
    @InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>,
    @InjectRepository(EventRegistration) private readonly registrations: Repository<EventRegistration>,
  ) {}

  /**
   * registered = inscriptions non annulées ; present = pointés ;
   * absent = statut absent + inscrits non pointés une fois la date passée ;
   * donations = présences (T6.4 crée présence et don dans la même transaction) ;
   * byBloodGroup = présences par groupe sanguin du donneur (aucune identité exposée).
   */
  async dashboard(eventId: string, actor: AuthenticatedUser): Promise<EventDashboardDto> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (actor.role === UserRole.Crt && event.organizerId !== actor.id) {
      throw new ForbiddenException("Seul l'organisateur peut consulter ce tableau de bord");
    }

    const statusRows = await this.registrations
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .where('r.eventId = :eventId', { eventId })
      .groupBy('r.status')
      .getRawMany<{ status: RegistrationStatus; n: string }>();

    const count = (s: RegistrationStatus) => Number(statusRows.find((r) => r.status === s)?.n ?? 0);
    const inscrit = count(RegistrationStatus.Inscrit);
    const present = count(RegistrationStatus.Present);
    const explicitAbsent = count(RegistrationStatus.Absent);

    const eventPassed = event.eventDate < tunisToday(new Date());
    const absent = explicitAbsent + (eventPassed ? inscrit : 0);
    const registered = inscrit + present + explicitAbsent;

    const groupRows = await this.registrations
      .createQueryBuilder('r')
      .innerJoin(Donor, 'd', 'd.userId = r.donorId')
      .select('d.bloodGroup', 'bloodGroup')
      .addSelect('COUNT(*)', 'count')
      .where('r.eventId = :eventId', { eventId })
      .andWhere('r.status = :present', { present: RegistrationStatus.Present })
      .groupBy('d.bloodGroup')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ bloodGroup: string; count: string }>();

    return {
      eventId,
      registered,
      present,
      absent,
      donations: present,
      byBloodGroup: groupRows.map((g) => ({ bloodGroup: g.bloodGroup as BloodGroup, count: Number(g.count) })),
    };
  }
}
