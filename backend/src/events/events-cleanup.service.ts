// AJOUT : cron de nettoyage - une collecte non remplie est retirée de la liste 48 h après sa date.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { EventStatus as DbEventStatus, RegistrationStatus } from '../database/enums';

const GRACE_HOURS = 48;

@Injectable()
export class EventsCleanupService {
  private readonly logger = new Logger(EventsCleanupService.name);

  constructor(@InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>) {}

  /** Toutes les heures : annule les collectes publiées, non remplies, dont la date date de plus de 48 h. */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeUnfilled(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - GRACE_HOURS * 3600_000).toISOString().slice(0, 10)
      const qb = this.events.createQueryBuilder('e')
      const filled = qb
        .subQuery()
        .select('COUNT(*)')
        .from(EventRegistration, 'r')
        .where('r.eventId = e.id')
        .andWhere('r.status IN (:...active)')
        .getQuery()

      const rows = await qb
        .select('e.id', 'id')
        .where('e.status = :st', { st: DbEventStatus.Publie })
        .andWhere('e.eventDate < :cutoff', { cutoff })
        .andWhere(`${filled} < e.capacity`)
        .setParameter('active', [RegistrationStatus.Inscrit, RegistrationStatus.Present])
        .getRawMany<{ id: string }>()

      if (rows.length === 0) return 0
      // AJOUT : on change le statut au lieu de supprimer, pour garder l'historique et les inscriptions liées
      await this.events.update({ id: In(rows.map((r) => r.id)) }, { status: DbEventStatus.Annule })
      this.logger.log(`${rows.length} collecte(s) non remplie(s) retirée(s) de la liste (> ${GRACE_HOURS} h après la date).`)
      return rows.length
    } catch (e) {
      this.logger.error(`Nettoyage des collectes échoué : ${(e as Error).message}`)
      return 0
    }
  }
}
