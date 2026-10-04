import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestStatus, ResponseType } from '../database/enums';
import { BloodRequest, RequestResponse, RequestWave } from '../database/entities/requests.entities';
import {
  BloodGroup as RulesBloodGroup,
  RankedDonor,
  RejectReason,
  WaveDecision,
  decideWaveAction,
  rankDonors,
  selectWave,
  toRulesUrgency,
} from '../rules';
import { findCandidates } from './candidates';

export type PlanDecision = WaveDecision | { action: 'inactive'; status: string };

export interface WavePlan {
  requestId: string;
  decision: PlanDecision;
  unitsRemaining: number;
  /** Donneurs à notifier maintenant (vide si la décision n'est pas « launch »). */
  donorIds: string[];
  /** Classement complet avec explications, pour le tableau de bord. */
  ranked: RankedDonor[];
  rejected: { donorId: string; reason: RejectReason }[];
  expectedCoverage: number;
  target: number;
}

/**
 * Lecture seule : ne notifie personne et n'écrit rien en base.
 * L'appelant (T5 / T4.6) envoie les notifications `urgence` (ce qui alimente « déjà alerté »)
 * et enregistre la ligne `request_waves`.
 */
@Injectable()
export class MatchingService {
  constructor(private readonly ds: DataSource) {}

  async planWave(requestId: string, now: Date = new Date()): Promise<WavePlan> {
    const request = await this.ds.getRepository(BloodRequest).findOneBy({ id: requestId });
    if (!request) throw new NotFoundException('Demande introuvable');

    const empty = (decision: PlanDecision, unitsRemaining: number): WavePlan => ({
      requestId, decision, unitsRemaining, donorIds: [], ranked: [], rejected: [], expectedCoverage: 0, target: 0,
    });

    if (request.status !== RequestStatus.Active) {
      return empty({ action: 'inactive', status: request.status }, 0);
    }

    const [confirmed, [lastWaves, wavesSent]] = await Promise.all([
      this.ds.getRepository(RequestResponse).countBy({ requestId, response: ResponseType.JeViens }),
      this.ds.getRepository(RequestWave).findAndCount({ where: { requestId }, order: { createdAt: 'DESC' }, take: 1 }),
    ]);
    const last = lastWaves[0] ?? null;
    const urgency = toRulesUrgency(request.urgency);
    const unitsRemaining = Math.max(0, request.quantity - confirmed);

    const decision = decideWaveAction(
      {
        urgency,
        unitsNeeded: request.quantity,
        unitsConfirmed: confirmed,
        initialRadiusKm: request.initialRadiusKm,
        maxRadiusKm: request.maxRadiusKm,
        wavesSent,
        lastWaveAt: last?.createdAt ?? null,
        lastWaveRadiusKm: last?.radiusKm ?? null,
        deadline: request.deadline,
      },
      now,
    );
    if (decision.action !== 'launch') return empty(decision, unitsRemaining);

    const candidates = await findCandidates(this.ds, request, decision.radiusKm, now);
    const { ranked, rejected } = rankDonors(
      { bloodGroup: request.bloodGroup as RulesBloodGroup, urgency },
      candidates,
      decision.radiusKm,
      now,
    );
    const wave = selectWave(ranked, unitsRemaining, urgency);

    return {
      requestId,
      decision,
      unitsRemaining,
      donorIds: wave.donorIds,
      ranked,
      rejected,
      expectedCoverage: wave.expectedCoverage,
      target: wave.target,
    };
  }
}
