// AJOUT : T4.6 - UsersService (jeton FCM)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// AJOUT : Institution ajouté à l'import (GET /users/me)
import { Institution, User } from '../database/entities';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // AJOUT : Institution ajouté (valeur d'origine : [User])
  imports: [TypeOrmModule.forFeature([User, Institution])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
