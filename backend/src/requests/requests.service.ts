// T4.4 + T4.5 : service des demandes (création, lecture, réponse du donneur).
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto'; // AJOUT : T5.5
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canDonateTo } from '../common/rules/blood-compat';
import { BloodRequest, Donor, RequestResponse } from '../database/entities';
import { RequestWave } from '../database/entities/requests.entities'; // AJOUT : T5.5
import { EligibilityStatus, RequestStatus, ResponseType, UserRole } from '../database/enums';
import { InstitutionsService } from '../institutions/institutions.service';
import { WavesService } from '../waves/waves.service';
import { LiveEventsService } from '../live/live-events.service'; // AJOUT T5.4
import type { CreateRequestDto, GaugeDto, RequestDto, RespondDto, RespondResultDto } from './dto/requests.dto';
import type { DonorEnRouteDto, LiveStateDto, WaveDto } from './dto/requests.dto'; // AJOUT : T5.5

const PG_UNIQUE_VIOLATION = '23505';

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
        // Le score d'anomalie (M2, T14) pourra passer la demande en en_revue ; sans score, elle est active.
        status: RequestStatus.Active,
      }),
    );
    // T5.1 : vague 1 en arrière-plan, la réponse à l'hôpital n'attend pas les envois.
    if (saved.status === RequestStatus.Active && this.waves) {
      void this.waves
        .runWave(saved.id)
        .catch((e: Error) => this.logger.error(`Vague 1 échouée pour ${saved.id} : ${e.message}`));
    }
    saved.institution = inst;
    return this.toDto(saved);
  }

  /** Hôpital : ses demandes. Direction et admin : toutes. */
  async list(user: AuthenticatedUser, status?: string): Promise<RequestDto[]> {
    const where: Record<string, unknown> = {};
    if (status) where.status = status as RequestStatus;
    if (user.role === UserRole.Hopital) {
      where.institutionId = (await this.institutions.assertHospitalValidated(user.id)).id;
    }
    const rows = await this.requests.find({ where, relations: ['institution'], order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toDto(r));
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
