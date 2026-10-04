// T4.6 : enregistrement du jeton FCM de l'appareil.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async setDeviceToken(userId: string, fcmToken: string): Promise<void> {
    const res = await this.users.update({ id: userId }, { fcmToken });
    if (!res.affected) throw new NotFoundException('Utilisateur introuvable');
  }
}
