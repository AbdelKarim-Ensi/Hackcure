// AJOUT : T6.4 - pointage d'un donneur (QR signé ou manuel) : présence + don dans une seule transaction.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DonationSource, DonationType } from '../common/enums';
import { CrtEvent, EventRegistration } from '../database/entities/events.entities';
import { EventStatus, RegistrationStatus, UserRole } from '../database/enums';
import type { ConfirmDonationDto } from '../donations/donations.controller';
import { DonationsService } from '../donations/donations.service';
import { CheckinDto, CheckinResultDto, EventRegistrationDto } from './dto/events.dto';
import { QrTokenService } from './qr-token.service';

/** Date du jour à Tunis (YYYY-MM-DD). */
const tunisToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now);

@Injectable()
export class EventCheckinService {
  constructor(
    @InjectRepository(CrtEvent) private readonly events: Repository<CrtEvent>,
    private readonly dataSource: DataSource,
    private readonly qr: QrTokenService,
    private readonly donations: DonationsService,
  ) {}

  async checkin(eventId: string, dto: CheckinDto, actor: AuthenticatedUser): Promise<CheckinResultDto> {
    if (!dto.qrToken && !dto.donorId) throw new BadRequestException('Fournir qrToken ou donorId');

    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Événement introuvable');
    if (actor.role !== UserRole.Admin && event.organizerId !== actor.id) {
      throw new ForbiddenException("Seul l'organisateur peut pointer sur cet événement");
    }
    if (event.status !== EventStatus.Publie) throw new ConflictException("Cet événement n'est plus actif");

    // Démo : CHECKIN_ALLOW_ANY_DATE=true lève la limite « jour de l'événement ».
    const now = new Date();
    const anyDate = process.env.CHECKIN_ALLOW_ANY_DATE === 'true';
    const today = tunisToday(now);
    if (!anyDate && event.eventDate !== today) {
      throw new ConflictException(`Le pointage n'est possible que le jour de l'événement (${event.eventDate})`);
    }
    const donatedAt = anyDate ? today : event.eventDate;

    // Identification de l'inscription : QR signé (404 si invalide ou d'un autre événement) ou pointage manuel.
    let where: { id?: string; eventId: string; donorId?: string };
    if (dto.qrToken) {
      const p = this.qr.verify(dto.qrToken);
      if (p.eventId !== eventId) throw new NotFoundException('Jeton QR invalide ou expiré');
      where = { id: p.registrationId, eventId };
    } else {
      where = { eventId, donorId: dto.donorId };
    }

    return this.dataSource.transaction(async (m) => {
      const reg = await m.findOne(EventRegistration, { where, lock: { mode: 'pessimistic_write' } });
      if (!reg) throw new NotFoundException('Inscription introuvable');
      if (reg.status === RegistrationStatus.Present) throw new ConflictException('Donneur déjà pointé');
      if (reg.status !== RegistrationStatus.Inscrit) throw new ConflictException("Cette inscription n'est plus active");

      const donation = await this.donations.confirm(
        {
          donorId: reg.donorId,
          type: dto.donationType ?? DonationType.SANG_TOTAL,
          source: DonationSource.EVENEMENT,
          donatedAt,
          place: event.placeName,
        } as ConfirmDonationDto,
        actor,
        now,
        m,
      );

      reg.status = RegistrationStatus.Present;
      await m.save(reg);

      return {
        registration: {
          id: reg.id,
          eventId,
          donorId: reg.donorId,
          slot: reg.slot,
          status: reg.status as unknown as EventRegistrationDto['status'],
        },
        donationId: donation.id,
        nextDonationPossibleDate: donation.nextDonationPossibleDate,
      };
    });
  }
}
