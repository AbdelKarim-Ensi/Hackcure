// T4.2 : formulaire d'éligibilité réel. Règles dans common/rules/eligibility.ts (provisoire, M2 les remplacera).
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CryptoService } from '../common/crypto/crypto.service';
import {
  computeNextDonationDate,
  isValidIsoDate,
  todayIso,
} from '../common/rules/donation-interval';
import {
  evaluateEligibility,
  QUESTIONNAIRE_VERSION,
  type EligibilityOutcome,
} from '../common/rules/eligibility';
import { Donor, EligibilityForm } from '../database/entities';
import { DonationType, EligibilityStatus } from '../database/enums';
import type {
  EligibilityFormDto,
  EligibilityResultDto,
} from './dto/donors.dto';

const STATUS: Record<EligibilityOutcome, EligibilityStatus> = {
  eligible: EligibilityStatus.Eligible,
  temporaire: EligibilityStatus.Temporaire,
  definitif: EligibilityStatus.Definitif,
};

/** Date ISO la plus tardive des deux (les dates YYYY-MM-DD se comparent comme du texte). */
const later = (a: string | null, b: string) => (a && a > b ? a : b);

@Injectable()
export class EligibilityFormService {
  constructor(
    @InjectRepository(Donor) private readonly donors: Repository<Donor>,
    private readonly crypto: CryptoService,
  ) {}

  async submit(
    requester: AuthenticatedUser,
    donorId: string,
    dto: EligibilityFormDto,
    now: Date = new Date(),
  ): Promise<EligibilityResultDto> {
    if (requester.id !== donorId)
      throw new ForbiddenException(
        'Vous ne pouvez remplir que votre propre formulaire',
      );
    if (dto.consent !== true) {
      throw new BadRequestException(
        'Le consentement explicite est obligatoire (données de santé)',
      );
    }

    const today = todayIso(now);
    const declaredLast = dto.lastDonationDate?.slice(0, 10);
    if (declaredLast !== undefined) {
      if (!isValidIsoDate(declaredLast))
        throw new BadRequestException('Date du dernier don invalide');
      if (declaredLast > today)
        throw new BadRequestException(
          'La date du dernier don ne peut pas être dans le futur',
        );
    }

    const donor = await this.donors.findOne({ where: { userId: donorId } });
    if (!donor)
      throw new NotFoundException(
        "Profil donneur introuvable. Appelez d'abord POST /donors/register",
      );
    // Un statut définitif ne se corrige pas en re-soumettant le formulaire : décision du personnel médical.
    if (donor.eligibilityStatus === EligibilityStatus.Definitif) {
      throw new ConflictException(
        'Statut définitif : le formulaire ne peut plus être soumis. Contactez le centre de transfusion',
      );
    }

    const outcome = evaluateEligibility(dto, now);
    donor.eligibilityStatus = STATUS[outcome.result];
    donor.reevalDate = outcome.reevalDate ?? null;

    // F2.6 : un don déclaré hors plateforme compte pour le calcul du prochain don, sans jamais le faire reculer.
    if (declaredLast !== undefined) {
      donor.lastDonationDate = later(donor.lastDonationDate, declaredLast);
      donor.nextDonationPossibleDate = later(
        donor.nextDonationPossibleDate,
        computeNextDonationDate(declaredLast, DonationType.SangTotal),
      );
    }

    // Le formulaire chiffré et la mise à jour du donneur passent ensemble ou pas du tout.
    await this.donors.manager.transaction(async (m) => {
      await m.save(EligibilityForm, {
        donorId,
        answersEncrypted: this.crypto.encrypt(JSON.stringify(dto)),
        result: donor.eligibilityStatus,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
      });
      await m.save(Donor, donor);
    });

    // R4/F1.5 : on ne renvoie jamais les réponses de santé, seulement le résultat.
    return {
      result:
        donor.eligibilityStatus as unknown as EligibilityResultDto['result'],
      ...(outcome.reevalDate ? { reevalDate: outcome.reevalDate } : {}),
      reasons: outcome.reasons,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      medicalConfirmationRequired: true,
    };
  }
}
