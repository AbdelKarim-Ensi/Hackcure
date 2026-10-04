// T4.4 + T4.5 : service des demandes (création, lecture, réponse du donneur).
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canDonateTo } from '../common/rules/blood-compat';
import { BloodRequest, Donor, RequestResponse } from '../database/entities';
import { EligibilityStatus, RequestStatus, ResponseType, UserRole } from '../database/enums';
import { InstitutionsService } from '../institutions/institutions.service';
import type { CreateRequestDto, GaugeDto, RequestDto, RespondDto, RespondResultDto } from './dto/requests.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class RequestsService {
  /** Horloge injectable pour les tests. */
  now: () => Date = () => new Date();

  constructor(
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
    @InjectRepository(RequestResponse) private readonly responses: Repository<RequestResponse>,
    @InjectRepository(Donor) private readonly donors: Repository<Donor>,
    private readonly institutions: InstitutionsService,
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
    // T5.1 : démarrer la vague 1 ici (WavesService) pour les demandes actives.
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

    // T5.4 : publier ici l'événement Redis (gauge, donor_en_route) ; T5.5 : clôture quand le besoin est couvert.
    return {
      requestId,
      response: dto.response as unknown as RespondResultDto['response'],
      accepted: accepting,
      gauge: await this.gauge(requestId, req.quantity),
    };
  }
}
