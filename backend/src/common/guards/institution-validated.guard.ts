// AJOUT : guard global. Un compte hopital/crt ne peut utiliser l'API que si son établissement est validé,
// sauf routes marquées @AllowUnvalidatedInstitution() (POST /institutions, GET /users/me).
// Lit la base, pas le token : le statut peut avoir changé depuis le login (même principe que F5).
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { Institution, User } from '../../database/entities';
import { UserRole, ValidationStatus } from '../../database/enums';
import { ALLOW_UNVALIDATED_INSTITUTION } from '../decorators/allow-unvalidated-institution.decorator';

@Injectable()
export class InstitutionValidatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVALIDATED_INSTITUTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    // Routes publiques (pas de user) et autres rôles : non concernés
    if (!user || (user.role !== UserRole.Hopital && user.role !== UserRole.Crt)) return true;

    const row = await this.users.findOne({ where: { id: user.id } });
    const inst = row?.institutionId
      ? await this.institutions.findOne({ where: { id: row.institutionId } })
      : null;
    if (!inst) {
      throw new ForbiddenException("Aucun établissement rattaché à ce compte : déclarez-le via POST /institutions");
    }
    if (inst.validationStatus === ValidationStatus.Rejete) {
      throw new ForbiddenException('Établissement rejeté par un administrateur');
    }
    if (inst.validationStatus !== ValidationStatus.Valide) {
      throw new ForbiddenException("Établissement en attente de validation par un administrateur");
    }
    return true;
  }
}
