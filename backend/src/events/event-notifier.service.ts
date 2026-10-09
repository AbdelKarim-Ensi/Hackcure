// AJOUT : T6.3 - notifications d'événements : nouvel événement, rappels J-1 / H-2, annulation.
// Payloads en liste blanche (R4) : aucune donnée de santé ni identité, uniquement des infos publiques de l'événement.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { EventStatus, NotificationType, RegistrationStatus } from '../database/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { EventReminderJob, ReminderKind, TUNIS_OFFSET } from './event-reminders.constants';
import { EventRemindersQueue } from './event-reminders.queue';

type Prefs = { alertsEnabled?: boolean; quietHours?: { start: string; end: string } | null } | null;

/** Plage de silence (HH:mm), heure de Tunis ; gère les plages qui passent minuit (ex. 22:00 → 07:00). */
export function inQuietHours(prefs: Prefs, now: Date = new Date()): boolean {
  const q = prefs?.quietHours;
  if (!q?.start || !q?.end) return false;
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = (parts.find((p) => p.type === 'hour')?.value ?? '00').replace('24', '00');
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const cur = `${h}:${m}`;
  return q.start <= q.end ? cur >= q.start && cur < q.end : cur >= q.start || cur < q.end;
}

@Injectable()
export class EventNotifier {
  private readonly logger = new Logger(EventNotifier.name);

  constructor(
    @InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>,
    @InjectRepository(EventRegistration) private readonly registrations: Repository<EventRegistration>,
    private readonly notifications: NotificationsService,
    private readonly queue: EventRemindersQueue,
  ) {}

  private eventPayload(kind: string, e: CrtEvent, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      type: kind === 'new' || kind === 'cancelled' ? 'evenement' : 'rappel',
      kind,
      eventId: e.id,
      title: e.title,
      placeName: e.placeName,
      eventDate: e.eventDate,
      ...extra,
    };
  }

  /** Nouvel événement : donneurs éligibles et disponibles de la zone (rayon max du donneur), sans vagues. */
  async notifyNewEvent(eventId: string): Promise<number> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event || event.status !== EventStatus.Publie) return 0;

    const rows: Array<{ userId: string; notifPrefs: Prefs }> = await this.events.query(
      `SELECT d.user_id AS "userId", d.notif_prefs AS "notifPrefs"
         FROM donors d
         JOIN events e ON e.id = $1
        WHERE d.eligibility_status = 'eligible'
          AND d.available = true
          AND COALESCE((d.notif_prefs ->> 'alertsEnabled')::boolean, true) = true
          AND (d.next_donation_possible_date IS NULL OR d.next_donation_possible_date <= e.event_date)
          AND d.position IS NOT NULL AND e.position IS NOT NULL
          AND ST_DWithin(d.position, e.position, d.max_radius_km * 1000)
          AND (e.target_groups IS NULL OR cardinality(e.target_groups) = 0 OR d.blood_group = ANY(e.target_groups))`,
      [eventId],
    );

    const now = new Date();
    const targets = rows.filter((r) => !inQuietHours(r.notifPrefs, now));
    const payload = this.eventPayload('new', event);

    let sent = 0;
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);
      const res = await Promise.all(
        batch.map((t) =>
          this.notifications
            .notify({ userId: t.userId, type: NotificationType.Evenement, eventId, payload })
            .catch((e: Error) => {
              this.logger.warn(`Notification événement ${eventId} échouée pour ${t.userId} : ${e.message}`);
              return null;
            }),
        ),
      );
      sent += res.filter(Boolean).length;
    }
    this.logger.log(`Événement ${eventId} : ${sent}/${rows.length} donneurs notifiés`);
    return sent;
  }

  /** Annulation : prévient les inscrits. Prête pour une future route d'annulation (hors contrat v1). */
  async notifyCancelled(eventId: string): Promise<number> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) return 0;
    const regs = await this.registrations.find({ where: { eventId, status: RegistrationStatus.Inscrit } });
    const payload = this.eventPayload('cancelled', event);
    const res = await Promise.all(
      regs.map((r) =>
        this.notifications
          .notify({ userId: r.donorId, type: NotificationType.Evenement, eventId, payload })
          .catch(() => null),
      ),
    );
    return res.filter(Boolean).length;
  }

  /** Planifie les rappels J-1 et H-2 d'une inscription (appelé après le commit de l'inscription). */
  async scheduleReminders(registrationId: string): Promise<void> {
    const reg = await this.registrations.findOne({ where: { id: registrationId }, relations: { event: true } });
    if (!reg?.event) return;

    const now = Date.now();
    const demo = Number(process.env.REMINDER_DEMO_SECONDS ?? 0);
    const start = new Date(`${reg.event.eventDate}T${reg.slot}:00${TUNIS_OFFSET}`).getTime();
    const plan: Array<[ReminderKind, number]> =
      demo > 0
        ? [['j1', now + demo * 1000], ['h2', now + 2 * demo * 1000]]
        : [['j1', start - 24 * 3600_000], ['h2', start - 2 * 3600_000]];

    for (const [kind, fireAt] of plan) {
      if (!demo && fireAt <= now) continue; // trop tard pour ce rappel (inscription tardive)
      await this.queue.schedule({ registrationId, kind, fireAt }, `${registrationId}_${kind}`);
    }
  }

  /** Exécuté par le worker : envoie le rappel si l'inscription et l'événement sont toujours actifs. */
  async sendReminder(job: EventReminderJob): Promise<'sent' | 'skipped'> {
    const reg = await this.registrations.findOne({ where: { id: job.registrationId }, relations: { event: true } });
    if (!reg?.event) return 'skipped';
    if (reg.status !== RegistrationStatus.Inscrit || reg.event.status !== EventStatus.Publie) return 'skipped';

    await this.notifications.notify({
      userId: reg.donorId,
      type: NotificationType.Rappel,
      eventId: reg.eventId,
      payload: this.eventPayload(job.kind, reg.event, { slot: reg.slot }),
    });
    return 'sent';
  }
}
