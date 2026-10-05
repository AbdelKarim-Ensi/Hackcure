// T5.1 : orchestrateur de vagues. Exécute la décision du planificateur de M2 (MatchingService.planWave).
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BloodRequest, RequestWave } from '../database/entities/requests.entities';
import { NotificationStatus, NotificationType } from '../database/enums';
import { MatchingService, WavePlan } from '../matching/matching.service';
import { NotificationsService, buildAlertPayload } from '../notifications/notifications.service';

export interface WaveRunResult {
  requestId: string;
  /** launch | wait | covered | expired | exhausted | inactive | skipped */
  action: string;
  waveNumber?: number;
  radiusKm?: number;
  /** Notifications effectivement envoyées. */
  sent: number;
  /** Notifications journalisées mais en échec (pas de jeton FCM, FCM indisponible). */
  failed: number;
  /** Ignorées (quota hebdomadaire atteint). */
  skipped: number;
  plan?: WavePlan;
}

/** Envois en parallèle par lot : tient la contrainte « vague 1 en moins de 10 s » sans saturer FCM. */
const CHUNK_SIZE = 25;

@Injectable()
export class WavesService {
  private readonly logger = new Logger(WavesService.name);
  /** Évite deux lancements simultanés pour la même demande (le verrou distribué viendra avec BullMQ, T5.2). */
  private readonly running = new Set<string>();

  constructor(
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
    @InjectRepository(RequestWave) private readonly waves: Repository<RequestWave>,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Évalue la demande et, si le planificateur dit « launch », envoie la vague.
   * Les autres décisions (wait, covered, expired...) sont renvoyées telles quelles : T5.2 les traitera.
   */
  async runWave(requestId: string, now: Date = new Date()): Promise<WaveRunResult> {
    if (this.running.has(requestId)) {
      return { requestId, action: 'skipped', sent: 0, failed: 0, skipped: 0 };
    }
    this.running.add(requestId);
    try {
      return await this.execute(requestId, now);
    } finally {
      this.running.delete(requestId);
    }
  }

  private async execute(requestId: string, now: Date): Promise<WaveRunResult> {
    const plan = await this.matching.planWave(requestId, now);
    const { decision } = plan;
    if (decision.action !== 'launch') {
      return { requestId, action: decision.action, sent: 0, failed: 0, skipped: 0, plan };
    }

    const { waveNumber, radiusKm } = decision;
    const request = await this.requests.findOneOrFail({ where: { id: requestId }, relations: ['institution'] });

    // 1. Trace de la vague, y compris à 0 destinataire : le planificateur peut alors élargir le rayon.
    await this.waves.save(this.waves.create({ requestId, waveNumber, radiusKm, sentTo: plan.donorIds.length }));
    await this.requests.update(requestId, { currentRadiusKm: radiusKm });

    // 2. Alertes. Payload en liste blanche (R4) : aucune identité de patient.
    const byDonor = new Map(plan.ranked.map((r) => [r.donorId, r]));
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < plan.donorIds.length; i += CHUNK_SIZE) {
      const chunk = plan.donorIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((donorId) => {
          const ranked = byDonor.get(donorId);
          // components.dist = 1 - distance / rayon  =>  distance = (1 - dist) × rayon
          const distanceKm = ranked ? Math.round((1 - ranked.components.dist) * radiusKm * 10) / 10 : radiusKm;
          return this.notifications.notify({
            userId: donorId,
            type: NotificationType.Urgence,
            requestId,
            payload: buildAlertPayload({
              requestId,
              bloodGroup: request.bloodGroup,
              hospitalName: request.institution?.name ?? '',
              distanceKm,
              urgency: request.urgency,
              deadline: new Date(request.deadline).toISOString(),
            }),
          });
        }),
      );
      for (const r of results) {
        if (r.status === 'rejected') failed++;
        else if (r.value === null) skipped++;
        else if (r.value.status === NotificationStatus.Envoyee) sent++;
        else failed++;
      }
    }

    this.logger.log(
      `Demande ${requestId} : vague ${waveNumber} (${radiusKm} km), ${plan.donorIds.length} donneurs, ${sent} envoyées, ${failed} échecs, ${skipped} ignorées`,
    );
    return { requestId, action: 'launch', waveNumber, radiusKm, sent, failed, skipped, plan };
  }
}
