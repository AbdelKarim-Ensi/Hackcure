// T4.6 : service de notifications (journal en base, quota hebdomadaire, envoi avec reprises, R4 : jamais d'identité patient).
// La file BullMQ (reprises persistantes, jobs différés) arrive avec T5.1 ; ici les reprises sont en mémoire.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AppNotification, User } from '../database/entities';
import { NotificationStatus, NotificationType, UrgencyLevel } from '../database/enums';
import type { NotificationDto } from './notifications.controller';
import { PUSH_SENDER } from './push-sender';
import type { PushSender } from './push-sender';

export interface AlertInput {
  requestId: string;
  bloodGroup: string;
  hospitalName: string;
  distanceKm: number;
  urgency: string;
  deadline: string;
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  requestId?: string;
  eventId?: string;
}

export const WEEKLY_QUOTA_DEFAULT = 5;
export const MAX_ATTEMPTS = 3;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * R4 / F3.5 : liste blanche explicite. Tout champ non listé (nom du patient, service, dossier...) est écarté,
 * même si l'appelant en passe un par erreur.
 */
export function buildAlertPayload(input: AlertInput): Record<string, unknown> {
  return {
    type: 'urgence',
    requestId: input.requestId,
    bloodGroup: input.bloodGroup,
    hospitalName: input.hospitalName,
    distanceKm: input.distanceKm,
    urgency: input.urgency,
    deadline: input.deadline,
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** Réglables pour les tests. */
  now: () => Date = () => new Date();
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms));
  weeklyQuota = Number(process.env.NOTIF_WEEKLY_QUOTA ?? WEEKLY_QUOTA_DEFAULT);

  constructor(
    @InjectRepository(AppNotification) private readonly notifications: Repository<AppNotification>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  toDto(n: AppNotification): NotificationDto {
    return {
      id: n.id,
      type: n.type as unknown as NotificationDto['type'],
      status: n.status as unknown as NotificationDto['status'],
      payload: n.payload,
      createdAt: new Date(n.createdAt).toISOString(),
      ...(n.sentAt ? { sentAt: new Date(n.sentAt).toISOString() } : {}),
    };
  }

  async listMine(userId: string): Promise<NotificationDto[]> {
    const rows = await this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((n) => this.toDto(n));
  }

  /**
   * Anti-spam : au plus `weeklyQuota` alertes d'urgence par donneur sur 7 jours glissants.
   * Les urgences critiques ne sont jamais bloquées.
   */
  private async overQuota(input: NotifyInput): Promise<boolean> {
    if (input.type !== NotificationType.Urgence) return false;
    if (input.payload.urgency === UrgencyLevel.Critique) return false;
    const since = new Date(this.now().getTime() - WEEK_MS);
    const count = await this.notifications.count({
      where: { userId: input.userId, type: NotificationType.Urgence, createdAt: MoreThanOrEqual(since) },
    });
    return count >= this.weeklyQuota;
  }

  /** Enregistre la notification (journal) sans l'envoyer. Renvoie null si le quota est atteint. */
  async enqueue(input: NotifyInput): Promise<AppNotification | null> {
    if (await this.overQuota(input)) {
      this.logger.warn(`Quota hebdomadaire atteint pour ${input.userId}, notification ignorée`);
      return null;
    }
    return this.notifications.save(
      this.notifications.create({
        userId: input.userId,
        type: input.type,
        status: NotificationStatus.EnAttente,
        requestId: input.requestId ?? null,
        eventId: input.eventId ?? null,
        payload: input.payload,
        sentAt: null,
      }),
    );
  }

  /** Envoi avec reprises (backoff exponentiel). Le résultat est toujours journalisé : envoyee ou echec. */
  async dispatch(n: AppNotification): Promise<AppNotification> {
    const user = await this.users.findOne({ where: { id: n.userId } });
    if (!user?.fcmToken) {
      n.status = NotificationStatus.Echec;
      return this.notifications.save(n);
    }
    const message = {
      token: user.fcmToken,
      title: n.type === NotificationType.Urgence ? 'Besoin urgent de sang' : 'Damm',
      body: n.type === NotificationType.Urgence ? 'Un hôpital près de vous a besoin de votre don.' : 'Nouvelle notification',
      data: Object.fromEntries(Object.entries(n.payload).map(([k, v]) => [k, String(v)])),
    };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.sender.send(message);
        n.status = NotificationStatus.Envoyee;
        n.sentAt = this.now();
        return this.notifications.save(n);
      } catch (e) {
        this.logger.warn(`Envoi push échoué (${attempt}/${MAX_ATTEMPTS}) : ${(e as Error).message}`);
        if (attempt < MAX_ATTEMPTS) await this.sleep(500 * 2 ** (attempt - 1));
      }
    }
    n.status = NotificationStatus.Echec;
    return this.notifications.save(n);
  }

  /** Raccourci pour les autres modules (vagues, événements) : journalise puis envoie. */
  async notify(input: NotifyInput): Promise<AppNotification | null> {
    const n = await this.enqueue(input);
    return n ? this.dispatch(n) : null;
  }
}
