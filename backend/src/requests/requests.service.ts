// T4.4 + T4.5 : service des demandes (création, lecture, réponse du donneur).
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto'; // AJOUT : T5.5
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canDonateTo } from '../common/rules/blood-compat';
import { BloodRequest, Donor, RequestResponse } from '../database/entities';
import { RequestWave } from '../database/entities/requests.entities'; // AJOUT : T5.5
import { EligibilityStatus, RequestStatus, ResponseType, UserRole } from '../database/enums';
import { AnomalyService } from '../anomaly/anomaly.service'; // AJOUT : T14
import { InstitutionsService } from '../institutions/institutions.service';
import { WavesService } from '../waves/waves.service';
import { LiveEventsService } from '../live/live-events.service'; // AJOUT T5.4
import { ReviewDecision } from './dto/requests.dto'; // AJOUT : T14
import type { CreateRequestDto, GaugeDto, RequestDto, RespondDto, RespondResultDto } from './dto/requests.dto';
import type { DonorEnRouteDto, LiveStateDto, WaveDto } from './dto/requests.dto'; // AJOUT : T5.5

const PG_UNIQUE_VIOLATION = '23505';

// AJOUT : T8 - historique : les demandes terminées disparaissent de la liste après HISTORY_TTL_HOURS (24 par défaut, 12 en démo).
const TERMINAL_STATUSES = new Set<RequestStatus>([RequestStatus.Couverte, RequestStatus.Cloturee, RequestStatus.Expiree]);
const historyTtlMs = (): number => {
  const h = Number(process.env.HISTORY_TTL_HOURS);
  return (Number.isFinite(h) && h > 0 ? h : 24) * 3_600_000;
};

@Injectable()
export class RequestsService {
  /** Horloge injectable pour les tests. */
  now: () => Date = () => new Date();
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
    @InjectRepository(RequestResponse) private readonly responses: Repository<RequestResponse>,
    @InjectRepository(Donor) private readonly donors: Repository<Donor>,
    private readonly institutions: InstitutionsService,
    @Optional() private readonly waves?: WavesService,
    // AJOUT T5.4 : publication Redis des événements temps réel (optionnel : les tests existants n'ont pas à le fournir).
    @Optional() private readonly live?: LiveEventsService,
    // AJOUT : T5.5 : vagues pour l'état live (optionnel pour ne pas casser les specs existantes).
    @Optional() @InjectRepository(RequestWave) private readonly waveRows?: Repository<RequestWave>,
    // AJOUT : T14 : détection d'anomalies (optionnel : sans lui, la demande reste active comme avant T14).
    @Optional() private readonly anomaly?: AnomalyService,
  ) {}

  toDto(r: BloodRequest): RequestDto {
    return {
      id: r.id,
      institutionId: r.institutionId,
      institutionName: r.institution?.name ?? '',
      bloodGroup: r.bloodGroup as unknown as RequestDto['bloodGroup'],
      quantity: r.quantity,
      urgency: r.urgency as unknown as RequestDto['urgency'],
      deadline: new Date(r.deadline).toISOString(),
      initialRadiusKm: r.initialRadiusKm,
      currentRadiusKm: r.currentRadiusKm,
      maxRadiusKm: r.maxRadiusKm,
      status: r.status as unknown as RequestDto['status'],
      ...(r.anomalyScore !== null && r.anomalyScore !== undefined ? { anomalyScore: Number(r.anomalyScore) } : {}),
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }

  /** T4.4 : hôpital validé uniquement (F5), rayon 5/10/20 km, échéance dans le futur. */
  async create(dto: CreateRequestDto, user: AuthenticatedUser): Promise<RequestDto> {
    const inst = await this.institutions.assertHospitalValidated(user.id);
    const deadline = new Date(dto.deadline);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= this.now().getTime()) {
      throw new BadRequestException("L'échéance doit être dans le futur");
    }
    const radius = dto.initialRadiusKm ?? 10;
    // AJOUT : T14 : évaluation AVANT l'enregistrement. reject = 422, review = en_revue (aucune vague), sinon active.
    const assessment = this.anomaly
      ? await this.anomaly.assess({
          institutionId: inst.id,
          bloodGroup: dto.bloodGroup,
          quantity: dto.quantity,
          urgency: dto.urgency,
          deadline,
        }, this.now())
      : null;
    if (assessment?.level === 'reject') throw new UnprocessableEntityException(assessment.flags);
    const saved = await this.requests.save(
      this.requests.create({
        institutionId: inst.id,
        createdBy: user.id,
        bloodGroup: dto.bloodGroup as never,
        quantity: dto.quantity,
        urgency: dto.urgency as never,
        deadline,
        initialRadiusKm: radius,
        currentRadiusKm: radius,
        // T14 : un score élevé retient la demande en en_revue ; sans évaluation, elle est active.
        status: assessment?.level === 'review' ? RequestStatus.EnRevue : RequestStatus.Active,
        ...(assessment ? { anomalyScore: assessment.scoreForDb } : {}),
      }),
    );
    if (assessment && assessment.level !== 'ok') {
      this.logger.warn(
        `Anomalie ${assessment.level} (score ${assessment.scoreForDb}) sur la demande ${saved.id} : ${assessment.flags.map((f) => f.code).join(', ')}`,
      );
    }
    // T5.1 : vague 1 en arrière-plan, la réponse à l'hôpital n'attend pas les envois.
    if (saved.status === RequestStatus.Active && this.waves) {
      void this.waves
        .runWave(saved.id)
        .catch((e: Error) => this.logger.error(`Vague 1 échouée pour ${saved.id} : ${e.message}`));
    }
    saved.institution = inst;
    return this.toDto(saved);
  }

  /** AJOUT : T14 : demandes retenues en en_revue, les plus suspectes d'abord (admin). */
  async listForReview(): Promise<RequestDto[]> {
    const rows = await this.requests.find({
      where: { status: RequestStatus.EnRevue },
      relations: ['institution'],
      order: { anomalyScore: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * AJOUT : T14 : décision de l'admin sur une demande en_revue.
   * approve -> active + vague 1 ; reject -> cloturee, aucune alerte.
   * Le UPDATE est conditionné au statut : deux admins ne peuvent pas décider la même demande.
   */
  async review(id: string, decision: ReviewDecision): Promise<RequestDto> {
    const req = await this.requests.findOne({ where: { id }, relations: ['institution'] });
    if (!req) throw new NotFoundException('Demande introuvable');
    if (req.status !== RequestStatus.EnRevue) throw new ConflictException("Cette demande n'est pas en revue");

    const approve = decision === ReviewDecision.APPROVE;
    if (approve && new Date(req.deadline).getTime() <= this.now().getTime()) {
      throw new ConflictException("L'échéance est dépassée : la demande ne peut plus être approuvée");
    }
    const result = await this.requests.update(
      { id, status: RequestStatus.EnRevue },
      approve ? { status: RequestStatus.Active } : { status: RequestStatus.Cloturee, closedAt: this.now() },
    );
    if (!result.affected) throw new ConflictException("Cette demande n'est pas en revue");

    req.status = approve ? RequestStatus.Active : RequestStatus.Cloturee;
    if (!approve) req.closedAt = this.now();
    if (approve && this.waves) {
      void this.waves
        .runWave(id)
        .catch((e: Error) => this.logger.error(`Vague 1 échouée pour ${id} : ${e.message}`));
    }
    return this.toDto(req);
  }

  /**
   * Hôpital : ses demandes. Direction et admin : toutes.
   * AJOUT : T8 - les demandes terminées de plus de HISTORY_TTL_HOURS sont masquées (les lignes restent en base).
   */
  async list(user: AuthenticatedUser, status?: string): Promise<RequestDto[]> {
    const where: Record<string, unknown> = {};
    if (status) where.status = status as RequestStatus;
    if (user.role === UserRole.Hopital) {
      where.institutionId = (await this.institutions.assertHospitalValidated(user.id)).id;
    }
    const rows = await this.requests.find({ where, relations: ['institution'], order: { createdAt: 'DESC' } });
    const now = this.now().getTime();
    const ttl = historyTtlMs();
    const visible = rows.filter((r) => {
      if (!TERMINAL_STATUSES.has(r.status)) return true;
      const since = new Date(r.closedAt ?? r.createdAt).getTime();
      return now - since < ttl;
    });
    return visible.map((r) => this.toDto(r));
  }

  async getOne(id: string, user: AuthenticatedUser): Promise<RequestDto> {
    const r = await this.requests.findOne({ where: { id }, relations: ['institution'] });
    if (!r) throw new NotFoundException('Demande introuvable');
    if (user.role === UserRole.Hopital) {
      const inst = await this.institutions.assertHospitalValidated(user.id);
      if (inst.id !== r.institutionId) throw new ForbiddenException("Cette demande n'appartient pas à votre établissement");
    }
    return this.toDto(r);
  }

  /**
   * AJOUT : T8 : lancement manuel de la vague suivante (hôpital propriétaire, demande active, urgence critique).
   * Le délai de la vague courante est considéré comme écoulé ; le planificateur décide du rayon.
   */
  async launchWave(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ launched: true; waveNumber: number; radiusKm: number; sent: number }> {
    const MANUAL_WAVE_URGENCIES = ['urgente', 'critique'];
    const r = await this.getOne(id, user); // 404 / 403
    if (String(r.status) !== 'active') throw new ConflictException("La demande n'est plus active");
    if (!MANUAL_WAVE_URGENCIES.includes(String(r.urgency))) {
      throw new ConflictException('Lancement manuel réservé aux demandes urgentes ou critiques');
    }
    if (!this.waves) throw new ConflictException('Service de vagues indisponible');
    const res = await this.waves.runWave(id, new Date(), true);
    if (res.action === 'skipped') throw new ConflictException('Une vague est déjà en cours de lancement');
    if (res.action !== 'launch') {
      throw new ConflictException(`Aucune vague possible pour le moment (${res.action})`);
    }
    return { launched: true, waveNumber: res.waveNumber ?? 0, radiusKm: res.radiusKm ?? 0, sent: res.sent };
  }

  async gauge(requestId: string, needed: number): Promise<GaugeDto> {
    const accepted = await this.responses.count({ where: { requestId, response: ResponseType.JeViens } });
    return { accepted, needed, percent: needed > 0 ? Math.min(100, Math.round((accepted / needed) * 100)) : 0 };
  }

  /**
   * AJOUT : T5.5 : état courant du suivi en direct (chargement initial de l'écran, ensuite WebSocket /live).
   * Mêmes contrôles d'accès que getOne (404, et 403 pour un hôpital qui n'est pas propriétaire).
   */
  async getLiveState(id: string, user: AuthenticatedUser): Promise<LiveStateDto> {
    const req = await this.getOne(id, user);
    const [gauge, waveRows, donorsEnRoute] = await Promise.all([
      this.gauge(id, req.quantity),
      this.waveRows
        ? this.waveRows.find({ where: { requestId: id }, order: { waveNumber: 'ASC' } })
        : Promise.resolve([] as RequestWave[]),
      this.donorsEnRoute(id),
    ]);
    const waves: WaveDto[] = waveRows.map((row, i) => {
      const w = row as RequestWave & { coverage?: number | null; createdAt?: Date };
      return {
        number: w.waveNumber,
        radiusKm: w.radiusKm,
        sentTo: w.sentTo,
        // La dernière vague porte la couverture courante ; les précédentes, la valeur enregistrée.
        coverage: i === waveRows.length - 1 ? gauge.percent : Math.round(Number(w.coverage ?? 0)),
        createdAt: new Date(w.createdAt ?? Date.now()).toISOString(),
      };
    });
    return {
      requestId: id,
      status: req.status,
      currentRadiusKm: req.currentRadiusKm,
      gauge,
      waves,
      donorsEnRoute,
    };
  }

  /** AJOUT : T5.5 : donneurs « Je viens », anonymisés (R4/F1.5) : identifiant haché, jamais nom ni téléphone. */
  private async donorsEnRoute(requestId: string): Promise<DonorEnRouteDto[]> {
    const rows: Array<{ donorId: string; bloodGroup: string; distanceKm: string | number | null; respondedAt: Date | string }> =
      await this.responses.query(
        `SELECT r.donor_id AS "donorId",
                d.blood_group AS "bloodGroup",
                ROUND((ST_Distance(d.position, i.position) / 1000.0)::numeric, 1) AS "distanceKm",
                r.created_at AS "respondedAt"
           FROM request_responses r
           JOIN donors d ON d.user_id = r.donor_id
           JOIN blood_requests b ON b.id = r.request_id
           JOIN institutions i ON i.id = b.institution_id
          WHERE r.request_id = $1 AND r.response = $2
          ORDER BY r.created_at ASC`,
        [requestId, ResponseType.JeViens],
      );
    return rows.map((r) => ({
      anonymousId: 'don-' + createHash('sha256').update(`${requestId}:${r.donorId}`).digest('hex').slice(0, 4),
      bloodGroup: r.bloodGroup as DonorEnRouteDto['bloodGroup'],
      distanceKm: Number(r.distanceKm ?? 0),
      respondedAt: new Date(r.respondedAt).toISOString(),
    }));
  }

  /**
   * T4.5 : réponse du donneur. Contrôle serveur, 3ᵉ niveau de F2.4 :
   * demande active, donneur éligible, compatible, délai entre dons écoulé, une seule réponse par demande.
   */
  async respond(requestId: string, dto: RespondDto, user: AuthenticatedUser): Promise<RespondResultDto> {
    const req = await this.requests.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Demande introuvable');
    const donor = await this.donors.findOne({ where: { userId: user.id } });
    if (!donor) throw new NotFoundException('Profil donneur introuvable');

    if (req.status !== RequestStatus.Active) throw new ConflictException("Cette demande n'est plus active");
    if (new Date(req.deadline).getTime() <= this.now().getTime()) throw new ConflictException('Cette demande a expiré');
    if (await this.responses.findOne({ where: { requestId, donorId: donor.userId } })) {
      throw new ConflictException('Vous avez déjà répondu à cette demande');
    }

    const accepting = (dto.response as unknown as string) === (ResponseType.JeViens as string);
    if (accepting) {
      if (donor.eligibilityStatus !== EligibilityStatus.Eligible) {
        throw new ConflictException("Vous n'êtes pas éligible au don à ce jour");
      }
      if (!canDonateTo(donor.bloodGroup, req.bloodGroup)) {
        throw new ConflictException("Votre groupe sanguin n'est pas compatible avec cette demande");
      }
      const today = this.now().toISOString().slice(0, 10);
      if (donor.nextDonationPossibleDate && donor.nextDonationPossibleDate > today) {
        throw new ConflictException(`Délai entre dons non écoulé : prochain don possible le ${donor.nextDonationPossibleDate}`);
      }
    }

    try {
      await this.responses.save(this.responses.create({ requestId, donorId: donor.userId, response: dto.response as never }));
    } catch (e) {
      if ((e as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Vous avez déjà répondu à cette demande');
      }
      throw e;
    }

    // AJOUT T5.4 : une réponse « Je viens » publie la jauge et donor_en_route (best-effort : un Redis en panne ne casse pas la réponse).
    const gauge = await this.gauge(requestId, req.quantity);
    if (accepting && this.live) {
      void this.live
        .publishAccepted(requestId, gauge)
        .catch((e: Error) => this.logger.warn(`Événement temps réel non publié pour ${requestId} : ${e.message}`));
    }
    // T5.5 : clôture quand le besoin est couvert.
    // AJOUT : T5.5 : le filtre sur le statut évite d'écraser une demande déjà clôturée ailleurs ;
    // un échec ici ne casse pas la réponse (le contrôle différé de la vague clôturera la demande).
    if (accepting && gauge.accepted >= req.quantity) {
      try {
        await this.requests.update(
          { id: requestId, status: RequestStatus.Active },
          { status: RequestStatus.Couverte, closedAt: new Date() },
        );
        this.logger.log(`Demande ${requestId} clôturée : ${RequestStatus.Couverte} (${gauge.accepted}/${req.quantity})`);
      } catch (e) {
        this.logger.warn(`Clôture automatique échouée pour ${requestId} : ${(e as Error).message}`);
      }
    }
    return {
      requestId,
      response: dto.response as unknown as RespondResultDto['response'],
      accepted: accepting,
      gauge,
    };
  }
}
