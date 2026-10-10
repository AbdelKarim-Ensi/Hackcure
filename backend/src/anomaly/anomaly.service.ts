import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { BloodRequest } from '../database/entities/requests.entities';
import {
  AnomalyAssessment,
  DraftRequest,
  PastRequest,
  UrgencyName,
  assessRequest,
} from '../rules';

const HISTORY_DAYS = 30;
const HISTORY_LIMIT = 200;

export interface DraftInput {
  institutionId: string;
  bloodGroup: string;
  quantity: number;
  urgency: string;
  deadline: Date;
}

/**
 * Lecture seule : calcule le score d'anomalie d'une demande AVANT son activation.
 * L'appelant (création de demande) écrit `anomalyScore` et choisit le statut.
 */
@Injectable()
export class AnomalyService {
  constructor(private readonly ds: DataSource) {}

  async assess(draft: DraftInput, now: Date = new Date()): Promise<AnomalyAssessment> {
    const since = new Date(now.getTime() - HISTORY_DAYS * 24 * 3600 * 1000);
    const rows = await this.ds.getRepository(BloodRequest).find({
      where: { institutionId: draft.institutionId, createdAt: MoreThanOrEqual(since) },
      select: { bloodGroup: true, quantity: true, createdAt: true, status: true },
      order: { createdAt: 'DESC' },
      take: HISTORY_LIMIT,
    });

    const history: PastRequest[] = rows.map((r) => ({
      bloodGroup: r.bloodGroup,
      quantity: r.quantity,
      createdAt: r.createdAt,
      status: r.status,
    }));

    const request: DraftRequest = {
      institutionId: draft.institutionId,
      bloodGroup: draft.bloodGroup,
      quantity: draft.quantity,
      urgency: draft.urgency as UrgencyName,
      deadline: draft.deadline,
    };
    return assessRequest(request, history, now);
  }
}
