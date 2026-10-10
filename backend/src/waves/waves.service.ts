// T5.1 : orchestrateur de vagues. Exécute la décision du planificateur de M2 (MatchingService.planWave).
// T5.2 : verrou distribué Redis, contrôle différé BullMQ après chaque vague, clôture automatique.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { BloodRequest, RequestWave } from '../database/entities/requests.entities';
import { NotificationStatus, NotificationType, RequestStatus } from '../database/enums';
import { MatchingService, WavePlan } from '../matching/matching.service';
import { NotificationsService, buildAlertPayload } from '../notifications/notifications.service';
import { REDIS } from '../redis/redis.module';
import { toRulesUrgency } from '../rules';
import { waveTimeoutMinutes } from '../rules/scoring';
import { RELEASE_LOCK_LUA, WAVE_CHECK_MARGIN_MS, WAVE_LOCK_TTL_MS, waveLockKey } from './waves.constants';
import { WavesQueue } from './waves.queue';
import { Optional } from '@nestjs/common'; // AJOUT T5.3
import { LiveEventsService } from '../live/live-events.service'; // AJOUT T5.3

export interface WaveRunResult {
  requestId: string;
  /** launch | wait | covered | expired | exhausted | inactive | skipped (verrou déjà pris) */
  action: string;
  waveNumber?: number;
  radiusKm?: number;
  /** Notifications effectivement envoyées. */
  sent: number;
  /** Notifications journalisées mais en échec (pas de jeton FCM, FCM indisponible). */
  failed: number;
  /** Ignorées (quota hebdomadaire atteint). */
  skipped: number;
  /** AJOUT T5.2 : statut appliqué si la demande vient d'être clôturée (couverte | expiree). */
  closedAs?: RequestStatus;
  plan?: WavePlan;
}

/** Envois en parallèle par lot : tient la contrainte « vague 1 en moins de 10 s » sans saturer FCM. */
const CHUNK_SIZE = 25;

@Injectable()
export class WavesService {
  private readonly logger = new Logger(WavesService.name);
  /** AJOUT T5.2 : délai de démo (WAVE_DELAY_SECONDS) ; null en production (délais de M2 : 15 min / 5 min). */
  private readonly demoDelayMs: number | null;

  constructor(
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
    @InjectRepository(RequestWave) private readonly waves: Repository<RequestWave>,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationsService,
    // AJOUT T5.2 :
    @Inject(REDIS) private readonly redis: Redis,
    private readonly queue: WavesQueue,
    config: ConfigService,
    // AJOUT T5.3 : wave_started pour le dashboard (optionnel : ne casse pas les specs existantes)
    @Optional() private readonly live?: LiveEventsService,
  ) {
    const seconds = Number(config.get<string>('WAVE_DELAY_SECONDS'));
    this.demoDelayMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }

  /**
   * Point d'entrée unique : appelé à la création de la demande (vague 1) et par le job différé (vagues suivantes).
   * Sous verrou Redis : deux appels simultanés pour la même demande ne s'exécutent jamais en parallèle.
   *  - launch    : trace + alertes, puis contrôle différé
   *  - wait      : replanifie un contrôle à l'échéance indiquée
   *  - covered   : demande clôturée « couverte »
   *  - expired   : demande clôturée « expiree »
   *  - exhausted : rayon max atteint, contrôle à l'échéance pour clôturer en « expiree »
   */
  async runWave(requestId: string, now: Date = new Date(), force = false): Promise<WaveRunResult> {
    const token = await this.acquireLock(requestId);
    if (!token) {
      return { requestId, action: 'skipped', sent: 0, failed: 0, skipped: 0 };
    }
    try {
      return await this.step(requestId, now, force);
    } finally {
      await this.releaseLock(requestId, token);
    }
  }

  private async step(requestId: string, now: Date, force = false): Promise<WaveRunResult> {
    const request = await this.requests.findOne({ where: { id: requestId }, relations: ['institution'] });
    if (!request) return { requestId, action: 'inactive', sent: 0, failed: 0, skipped: 0 };

    // AJOUT T8 : lancement manuel = délai de la vague courante considéré comme écoulé.
    const planNow = force ? this.forcedNow(request, now) : this.planningNow(request, now);
    const plan = await this.matching.planWave(requestId, planNow);
    const { decision } = plan;
    const idle = { requestId, sent: 0, failed: 0, skipped: 0, plan };

    switch (decision.action) {
      case 'launch':
        return this.launch(request, plan, decision.waveNumber, decision.radiusKm);
      case 'wait': {
        const delayMs = decision.nextCheckAt.getTime() - planNow.getTime() + WAVE_CHECK_MARGIN_MS;
        await this.scheduleCheck(requestId, delayMs, `${requestId}-wait-${decision.nextCheckAt.getTime()}`);
        return { ...idle, action: 'wait' };
      }
      case 'covered':
        await this.close(requestId, RequestStatus.Couverte);
        return { ...idle, action: 'covered', closedAs: RequestStatus.Couverte };
      case 'expired':
        await this.close(requestId, RequestStatus.Expiree);
        return { ...idle, action: 'expired', closedAs: RequestStatus.Expiree };
      case 'exhausted': {
        // Plus de vague possible : on laisse la demande active jusqu'à l'échéance, puis un contrôle la clôture.
        const delayMs = new Date(request.deadline).getTime() - now.getTime() + WAVE_CHECK_MARGIN_MS;
        await this.scheduleCheck(requestId, delayMs, `${requestId}-deadline`);
        return { ...idle, action: 'exhausted' };
      }
      default:
        return { ...idle, action: decision.action };
    }
  }

  private async launch(request: BloodRequest, plan: WavePlan, waveNumber: number, radiusKm: number): Promise<WaveRunResult> {
    const requestId = request.id;

    // 1. Trace de la vague, y compris à 0 destinataire : le planificateur peut alors élargir le rayon.
    await this.waves.save(this.waves.create({ requestId, waveNumber, radiusKm, sentTo: plan.donorIds.length }));
    await this.requests.update(requestId, { currentRadiusKm: radiusKm });
    // AJOUT T5.3 : le dashboard voit démarrer la vague tout de suite (best-effort, jamais bloquant)
    void this.live?.publish({ type: 'wave_started', requestId, waveNumber, radiusKm, at: new Date().toISOString() });

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

    // 3. AJOUT T5.2 : contrôle de couverture différé (vague suivante, ou clôture).
    await this.scheduleCheck(requestId, this.nextWaveDelayMs(request), `${requestId}-wave-${waveNumber}`);

    this.logger.log(
      `Demande ${requestId} : vague ${waveNumber} (${radiusKm} km), ${plan.donorIds.length} donneurs, ${sent} envoyées, ${failed} échecs, ${skipped} ignorées`,
    );
    return { requestId, action: 'launch', waveNumber, radiusKm, sent, failed, skipped, plan };
  }

  // AJOUT T5.2 : clôture automatique. Le filtre sur le statut évite d'écraser une demande déjà clôturée ailleurs.
  private async close(requestId: string, status: RequestStatus.Couverte | RequestStatus.Expiree): Promise<void> {
    await this.requests.update({ id: requestId, status: RequestStatus.Active }, { status, closedAt: new Date() });
    this.logger.log(`Demande ${requestId} clôturée : ${status}`);
  }

  /** Délai avant le prochain contrôle : WAVE_DELAY_SECONDS en démo, sinon le délai de M2 selon l'urgence. */
  private nextWaveDelayMs(request: BloodRequest): number {
    const ms = this.demoDelayMs ?? waveTimeoutMinutes(toRulesUrgency(request.urgency)) * 60_000;
    return ms + WAVE_CHECK_MARGIN_MS;
  }

  /**
   * Démo uniquement : avance l'horloge vue par le planificateur pour que le délai de M2 (15 min / 5 min)
   * soit considéré écoulé après WAVE_DELAY_SECONDS. Plafonné juste avant l'échéance : jamais d'expiration prématurée.
   */
  private planningNow(request: BloodRequest, now: Date): Date {
    if (this.demoDelayMs === null) return now;
    const timeoutMs = waveTimeoutMinutes(toRulesUrgency(request.urgency)) * 60_000;
    const shift = Math.max(0, timeoutMs - this.demoDelayMs);
    const cap = new Date(request.deadline).getTime() - 1;
    return new Date(Math.max(now.getTime(), Math.min(now.getTime() + shift, cap)));
  }

  /** AJOUT T8 : lancement manuel. Avance l'horloge du planificateur du délai de l'urgence, plafonné avant l'échéance. */
  private forcedNow(request: BloodRequest, now: Date): Date {
    const timeoutMs = waveTimeoutMinutes(toRulesUrgency(request.urgency)) * 60_000;
    const cap = new Date(request.deadline).getTime() - 1;
    return new Date(Math.max(now.getTime(), Math.min(now.getTime() + timeoutMs, cap)));
  }

  /** Un échec de planification est journalisé sans faire échouer la vague déjà envoyée. */
  private async scheduleCheck(requestId: string, delayMs: number, jobId: string): Promise<void> {
    try {
      await this.queue.scheduleCheck(requestId, delayMs, jobId);
    } catch (e) {
      this.logger.error(`Contrôle différé non planifié pour ${requestId} : ${(e as Error).message}`);
    }
  }

  // AJOUT T5.2 : verrou distribué (SET NX PX + libération par script Lua avec jeton).
  private async acquireLock(requestId: string): Promise<string | null> {
    const token = randomUUID();
    const ok = await this.redis.set(waveLockKey(requestId), token, 'PX', WAVE_LOCK_TTL_MS, 'NX');
    return ok === 'OK' ? token : null;
  }

  private async releaseLock(requestId: string, token: string): Promise<void> {
    try {
      await this.redis.eval(RELEASE_LOCK_LUA, 1, waveLockKey(requestId), token);
    } catch (e) {
      this.logger.warn(`Verrou ${requestId} non libéré (expirera seul) : ${(e as Error).message}`);
    }
  }
}
