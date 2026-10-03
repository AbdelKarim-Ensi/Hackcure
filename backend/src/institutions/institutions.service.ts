import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Institution, User } from '../database/entities';
import { UserRole, ValidationStatus } from '../database/enums';
import type { CreateInstitutionDto, InstitutionDto } from './institutions.controller';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  toDto(i: Institution): InstitutionDto {
    const coords = (i.position as { coordinates?: number[] } | null)?.coordinates;
    return {
      id: i.id,
      name: i.name,
      type: i.type as unknown as InstitutionDto['type'],
      validationStatus: i.validationStatus as unknown as InstitutionDto['validationStatus'],
      ...(i.address ? { address: i.address } : {}),
      ...(coords ? { position: { latitude: coords[1], longitude: coords[0] } } : {}),
    };
  }

  async validate(id: string, status: string): Promise<InstitutionDto> {
    const inst = await this.institutions.findOne({ where: { id } });
    if (!inst) throw new NotFoundException('Établissement introuvable');
    inst.validationStatus = status as ValidationStatus;
    return this.toDto(await this.institutions.save(inst));
  }

  /** Créé en_attente. Un compte hopital/crt y est rattaché (un seul établissement par compte). */
  async create(dto: CreateInstitutionDto, actor: AuthenticatedUser): Promise<InstitutionDto> {
    const attach = actor.role === UserRole.Hopital || actor.role === UserRole.Crt;
    const user = attach ? await this.users.findOne({ where: { id: actor.id } }) : null;
    if (attach && user?.institutionId) {
      throw new ConflictException('Ce compte est déjà rattaché à un établissement');
    }
    const inst = await this.institutions.save(
      this.institutions.create({
        name: dto.name,
        type: dto.type as never,
        address: dto.address ?? null,
        position: { type: 'Point', coordinates: [dto.position.longitude, dto.position.latitude] },
        validationStatus: ValidationStatus.EnAttente,
      }),
    );
    if (user) {
      user.institutionId = inst.id;
      await this.users.save(user);
    }
    return this.toDto(inst);
  }

  async list(status?: string): Promise<InstitutionDto[]> {
    const rows = await this.institutions.find({
      where: status ? { validationStatus: status as ValidationStatus } : {},
      order: { name: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Règle F5 : lit la base, pas le token (le statut peut avoir changé depuis le login). */
  async assertHospitalValidated(userId: string): Promise<Institution> {
    const user = await this.users.findOne({ where: { id: userId } });
    const inst = user?.institutionId
      ? await this.institutions.findOne({ where: { id: user.institutionId } })
      : null;
    if (!inst) throw new ForbiddenException('Aucun établissement rattaché à ce compte');
    if (inst.validationStatus !== ValidationStatus.Valide) {
      throw new ForbiddenException('Établissement non validé par un administrateur');
    }
    return inst;
  }
}
