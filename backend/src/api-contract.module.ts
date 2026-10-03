// AJOUT : T3 - regroupe les modules du contrat d'API v1 (contrôleurs squelettes mockés).
// En T4 à T6, chaque module reçoit ses vrais services et la valeur mockée disparaît.
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DonationsModule } from './donations/donations.module';
import { DonorsModule } from './donors/donors.module';
import { EventsModule } from './events/events.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestsModule } from './requests/requests.module';
import { StocksModule } from './stocks/stocks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    DonorsModule,
    InstitutionsModule,
    RequestsModule,
    EventsModule,
    DonationsModule,
    StocksModule,
    NotificationsModule,
  ],
})
export class ApiContractModule {}
