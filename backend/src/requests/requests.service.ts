// T4.4 : service des demandes (création, lecture).
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BloodRequest } from '../database/entities';
import { RequestStatus, UserRole } from '../database/enums';
import { InstitutionsService } from '../institutions/institutions.service';
import type { CreateRequestDto, RequestDto } from './dto/requests.dto';

@Injectable()
export class RequestsService {
  /** Horloge injectable pour les tests. */
  now: () => Date = () => new Date();

  constructor(
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
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
}
