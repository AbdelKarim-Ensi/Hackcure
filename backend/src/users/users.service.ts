// T4.6 : enregistrement du jeton FCM de l'appareil.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// AJOUT : Institution ajouté à l'import (GET /users/me)
import { Institution, User } from '../database/entities';
// AJOUT : type de réponse de GET /users/me
import type { MeDto } from './users.controller';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    // AJOUT : repository des établissements (GET /users/me)
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
  ) {}

  async setDeviceToken(userId: string, fcmToken: string): Promise<void> {
    const res = await this.users.update({ id: userId }, { fcmToken });
    if (!res.affected) throw new NotFoundException('Utilisateur introuvable');
  }

  // AJOUT : GET /users/me. Lit la base (pas le token) pour refléter le statut de validation à jour.
  async me(userId: string): Promise<MeDto> {
    const u = await this.users.findOne({ where: { id: userId } });
    if (!u) throw new NotFoundException('Utilisateur introuvable');
    const inst = u.institutionId
      ? await this.institutions.findOne({ where: { id: u.institutionId } })
      : null;
    return {
      id: u.id,
      role: u.role as unknown as MeDto['role'],
      phone: u.phone,
      fullName: u.fullName,
      status: u.status as string,
      institution: inst
        ? {
            id: inst.id,
            name: inst.name,
            type: inst.type as unknown as NonNullable<MeDto['institution']>['type'],
            validationStatus: inst.validationStatus as unknown as NonNullable<MeDto['institution']>['validationStatus'],
          }
        : null,
    };
  }
}
