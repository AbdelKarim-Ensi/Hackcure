// T4.7 : e2e sur base réelle. Formulaire d'éligibilité (T4.2) puis sélection des donneurs (requête §5, F3.3).
// Quand WavesService existera (T5.1), remplacer la requête SELECT ci-dessous par son appel.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../src/auth/auth.types';
import { CryptoService } from '../src/common/crypto/crypto.service';
import { addDays, todayIso } from '../src/common/rules/donation-interval';
import dataSource from '../src/database/data-source';
import { Donor } from '../src/database/entities';
import { UserRole } from '../src/database/enums';
import type {
  EligibilityFormDto,
  EligibilityResultDto,
} from '../src/donors/dto/donors.dto';
import { EligibilityFormService } from '../src/donors/eligibility-form.service';

jest.setTimeout(30_000);

const KEY = 'ab'.repeat(32);
const PHONE_PREFIX = '+2169999';
const HOSPITAL = 'T4.7 hôpital de test';

const clean = {
  age: 30,
  weightKg: 70,
  chronicDisease: false,
  onTreatment: false,
  hepatitisOrHivHistory: false,
  recentSurgery: false,
  recentTattooOrPiercing: false,
  recentTransfusion: false,
  riskAreaTravel: false,
  recentVaccination: false,
  recentFeverOrInfection: false,
  pregnantOrBreastfeeding: false,
  consent: true,
} satisfies EligibilityFormDto;

// Filtres dans l'ordre du PRD (F3.3) : groupe, éligibilité, délai entre dons, distance, disponibilité.
const SELECT = `
  SELECT d.user_id
  FROM donors d JOIN institutions i ON i.id = $1
  WHERE d.blood_group = ANY($2::blood_group[])
    AND d.eligibility_status = 'eligible'
    AND (d.next_donation_possible_date IS NULL OR d.next_donation_possible_date <= CURRENT_DATE)
    AND d.available = true
    AND ST_DWithin(d.position, i.position, $3)`;

describe("T4.2 / T4.7 : formulaire d'éligibilité et sélection des donneurs", () => {
  let service: EligibilityFormService;
  let crypto: CryptoService;
  let hospitalId: string;
  const ids: Record<string, string> = {};
  const results: Record<string, EligibilityResultDto> = {};
  const as = (id: string): AuthenticatedUser => ({
    id,
    role: UserRole.Donneur,
    institutionId: null,
  });
  const lastDonation = addDays(todayIso(), -10);

  const cleanup = async () => {
    await dataSource.query(`DELETE FROM users WHERE phone LIKE $1`, [
      `${PHONE_PREFIX}%`,
    ]);
    await dataSource.query(`DELETE FROM institutions WHERE name = $1`, [
      HOSPITAL,
    ]);
  };

  const createDonor = async (
    key: string,
    n: number,
    lon: number,
    lat: number,
  ) => {
    const [u] = await dataSource.query(
      `INSERT INTO users (role, phone, full_name, password_hash, phone_verified)
       VALUES ('donneur', $1, $2, 'x', true) RETURNING id`,
      [`${PHONE_PREFIX}${String(n).padStart(2, '0')}`, `T4.7 ${key}`],
    );
    await dataSource.query(
      `INSERT INTO donors (user_id, blood_group, position, consent_at)
       VALUES ($1, 'A+', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW())`,
      [u.id, lon, lat],
    );
    ids[key] = u.id;
  };

  const selected = async (radiusM: number): Promise<string[]> =>
    (await dataSource.query(SELECT, [hospitalId, ['A+'], radiusM])).map(
      (r: { user_id: string }) => r.user_id,
    );

  beforeAll(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
    await cleanup();
    crypto = new CryptoService({ get: () => KEY } as unknown as ConfigService);
    service = new EligibilityFormService(
      dataSource.getRepository(Donor),
      crypto,
    );

    const [h] = await dataSource.query(
      `INSERT INTO institutions (name, type, validation_status, position)
       VALUES ($1, 'hopital', 'valide', ST_SetSRID(ST_MakePoint(10.18, 36.80), 4326)::geography) RETURNING id`,
      [HOSPITAL],
    );
    hospitalId = h.id;

    await createDonor('proche', 1, 10.19, 36.81); // environ 1,4 km
    await createDonor('definitif', 2, 10.18, 36.81);
    await createDonor('repos', 3, 10.19, 36.8);
    await createDonor('lointain', 4, 10.45, 36.8); // environ 24 km
    await createDonor('temporaire', 5, 10.17, 36.8);

    results.proche = await service.submit(as(ids.proche), ids.proche, clean);
    results.definitif = await service.submit(as(ids.definitif), ids.definitif, {
      ...clean,
      hepatitisOrHivHistory: true,
    });
    results.repos = await service.submit(as(ids.repos), ids.repos, {
      ...clean,
      lastDonationDate: lastDonation,
    });
    results.lointain = await service.submit(
      as(ids.lointain),
      ids.lointain,
      clean,
    );
    results.temporaire = await service.submit(
      as(ids.temporaire),
      ids.temporaire,
      { ...clean, recentTattooOrPiercing: true },
    );
  });

  afterAll(async () => {
    await cleanup();
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  describe("formulaire d'éligibilité (T4.2)", () => {
    it('éligible : statut mis à jour, réponses chiffrées en base et déchiffrables', async () => {
      expect(results.proche.result).toBe('eligible');
      expect(results.proche.medicalConfirmationRequired).toBe(true);
      const [form] = await dataSource.query(
        `SELECT answers_encrypted, result FROM eligibility_forms WHERE donor_id = $1`,
        [ids.proche],
      );
      expect(form.result).toBe('eligible');
      expect(form.answers_encrypted).not.toContain('chronicDisease');
      expect(JSON.parse(crypto.decrypt(form.answers_encrypted)).age).toBe(30);
      const [donor] = await dataSource.query(
        `SELECT eligibility_status FROM donors WHERE user_id = $1`,
        [ids.proche],
      );
      expect(donor.eligibility_status).toBe('eligible');
    });

    it('temporaire : date de réévaluation dans le futur', () => {
      expect(results.temporaire.result).toBe('temporaire');
      expect(results.temporaire.reevalDate! > todayIso()).toBe(true);
    });

    it('définitif : résultat sans détail médical, puis nouvelle soumission refusée (409)', async () => {
      expect(results.definitif.result).toBe('definitif');
      expect(JSON.stringify(results.definitif).toLowerCase()).not.toMatch(
        /hépatite|vih|hiv/,
      );
      await expect(
        service.submit(as(ids.definitif), ids.definitif, clean),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sans consentement : refusé (400)', async () => {
      await expect(
        service.submit(as(ids.proche), ids.proche, {
          ...clean,
          consent: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("formulaire d'un autre donneur : refusé (403)", async () => {
      await expect(
        service.submit(as(ids.proche), ids.lointain, clean),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('F2.6 : un don déclaré fixe la date du prochain don (dernier don + 90 jours)', async () => {
      const [d] = await dataSource.query(
        `SELECT to_char(last_donation_date, 'YYYY-MM-DD') AS last,
                to_char(next_donation_possible_date, 'YYYY-MM-DD') AS next
         FROM donors WHERE user_id = $1`,
        [ids.repos],
      );
      expect(d.last).toBe(lastDonation);
      expect(d.next).toBe(addDays(lastDonation, 90));
    });
  });

  describe('sélection des donneurs (R1, R2, rayon par vague)', () => {
    it('donneur éligible et proche : sélectionné dès la vague 1 (10 km)', async () => {
      expect(await selected(10_000)).toContain(ids.proche);
    });
    it('donneur en délai de repos : jamais sélectionné', async () => {
      expect(await selected(40_000)).not.toContain(ids.repos);
    });
    it('donneur inéligible (définitif) : jamais sélectionné', async () => {
      expect(await selected(40_000)).not.toContain(ids.definitif);
    });
    it('donneur inéligible temporaire : jamais sélectionné', async () => {
      expect(await selected(40_000)).not.toContain(ids.temporaire);
    });
    it('hors rayon en vague 1 (10 km), sélectionnable en vague 2 (40 km)', async () => {
      expect(await selected(10_000)).not.toContain(ids.lointain);
      expect(await selected(40_000)).toContain(ids.lointain);
    });
  });
});
