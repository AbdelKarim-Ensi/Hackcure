// T4.3 : service des dons (prochain don possible, confirmation d'un don).
// Règle F2 provisoire dans common/rules/donation-interval.ts (à remplacer par M2, T11).
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { computeNextDonationDate, isValidIsoDate, todayIso } from '../common/rules/donation-interval';
import { Donation, Donor, Institution } from '../database/entities';
import { EligibilityStatus, UserRole } from '../database/enums';
import type { NextDonationDateDto } from '../donors/dto/donors.dto';
import type { ConfirmDonationDto, DonationDto } from './donations.controller';

/** « 2026-09-10 » devient « 10/09 » (format d'affichage du contrat v1). */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Date ISO la plus tardive des deux (les dates YYYY-MM-DD se comparent comme du texte). */
const later = (a: string | null, b: string) => (a && a > b ? a : b);

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(Donation) private readonly donations: Repository<Donation>,
    @InjectRepository(Donor) private readonly donors: Repository<Donor>,
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
  ) {}

  /** Un donneur ne consulte que son propre dossier ; hôpital et CRT consultent n'importe quel donneur. */
  async nextDonationDate(
    requester: AuthenticatedUser,
    donorId: string,
    now: Date = new Date(),
  ): Promise<NextDonationDateDto> {
    if (requester.role === UserRole.Donneur && requester.id !== donorId) {
      throw new ForbiddenException('Vous ne pouvez consulter que votre propre dossier');
    }
    const donor = await this.donors.findOne({ where: { userId: donorId } });
    if (!donor) throw new NotFoundException('Donneur introuvable');

    const next = donor.nextDonationPossibleDate ?? null;
    const no = (message: string): NextDonationDateDto => ({
      nextDonationPossibleDate: next,
      canDonateNow: false,
      message,
    });

    // Aucun détail médical dans les messages (R6 : le personnel médical confirme le jour du don).
    if (donor.eligibilityStatus === EligibilityStatus.EnAttente) {
      return no("Complétez le formulaire d'éligibilité pour savoir si vous pouvez donner");
    }
    if (donor.eligibilityStatus === EligibilityStatus.Definitif) {
      return no("Don impossible selon votre statut d'éligibilité");
    }
    if (donor.eligibilityStatus === EligibilityStatus.Temporaire) {
      return no(
        donor.reevalDate
          ? `Don temporairement impossible, réévaluation prévue le ${dm(donor.reevalDate)}`
          : 'Don temporairement impossible',
      );
    }
    if (next && next > todayIso(now)) return no(`Prochain don possible le ${dm(next)}`);
    return { nextDonationPossibleDate: next, canDonateNow: true, message: 'Vous pouvez donner dès maintenant' };
  }

  /**
   * Enregistre un don confirmé par le personnel (hôpital ou CRT) et recalcule le prochain don possible.
   * Le personnel médical fait foi (R6) : le délai entre dons n'est pas bloquant ici, il l'est pour les alertes.
   * Un don saisi avec une date ancienne ne fait jamais reculer les dates déjà enregistrées.
   */
  async confirm(dto: ConfirmDonationDto, actor: AuthenticatedUser, now: Date = new Date()): Promise<DonationDto> {
    const today = todayIso(now);
    const donatedAt = (dto.donatedAt ?? today).slice(0, 10);
    if (!isValidIsoDate(donatedAt)) throw new BadRequestException('Date du don invalide');
    if (donatedAt > today) throw new BadRequestException('La date du don ne peut pas être dans le futur');

    const donor = await this.donors.findOne({ where: { userId: dto.donorId } });
    if (!donor) throw new NotFoundException('Donneur introuvable');

    const place = dto.place ?? (await this.institutionName(actor.institutionId));
    donor.lastDonationDate = later(donor.lastDonationDate, donatedAt);
    donor.nextDonationPossibleDate = later(donor.nextDonationPossibleDate, computeNextDonationDate(donatedAt, dto.type));

    // Le don et la mise à jour du donneur passent ensemble ou pas du tout.
    const donation = await this.donations.manager.transaction(async (m) => {
      const row = await m.save(Donation, {
        donorId: donor.userId,
        type: dto.type as never,
        donatedAt,
        place: place ?? null,
        source: dto.source as never,
        confirmedBy: actor.id,
      });
      await m.save(Donor, donor);
      return row;
    });

    return {
      id: donation.id,
      donorId: donor.userId,
      type: dto.type,
      donatedAt,
      ...(place ? { place } : {}),
      source: dto.source,
      confirmedBy: actor.id,
      nextDonationPossibleDate: donor.nextDonationPossibleDate,
    };
  }

  private async institutionName(institutionId: string | null): Promise<string | null> {
    if (!institutionId) return null;
    return (await this.institutions.findOne({ where: { id: institutionId } }))?.name ?? null;
  }
}
