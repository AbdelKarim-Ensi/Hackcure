// AJOUT : T7.1 preuve que les réponses de santé sont stockées chiffrées (F1.5)
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CryptoService } from '../common/crypto/crypto.service';
import { Donor, EligibilityForm } from '../database/entities';
import { EligibilityStatus } from '../database/enums';
import type { EligibilityFormDto } from './dto/donors.dto';
import { EligibilityFormService } from './eligibility-form.service';

const KEY = 'ab'.repeat(32);
const config = { get: () => KEY } as unknown as ConfigService;

describe('EligibilityFormService : chiffrement des réponses (T7.1)', () => {
  const crypto = new CryptoService(config);
  const saved: Array<{ entity: unknown; data: Record<string, unknown> }> = [];

  const donor = {
    userId: 'u1',
    eligibilityStatus: EligibilityStatus.Temporaire,
    lastDonationDate: null,
    nextDonationPossibleDate: null,
    reevalDate: null,
  } as unknown as Donor;

  const m = {
    save: (entity: unknown, data: Record<string, unknown>) => {
      saved.push({ entity, data });
      return Promise.resolve(data);
    },
  };
  const donors = {
    findOne: () => Promise.resolve(donor),
    manager: { transaction: (cb: (mgr: typeof m) => Promise<void>) => cb(m) },
  };

  const service = new EligibilityFormService(donors as never, crypto);
  const requester = { id: 'u1' } as AuthenticatedUser;
  const dto = { consent: true, chronicDisease: false } as unknown as EligibilityFormDto;

  beforeEach(() => { saved.length = 0; });

  it('answersEncrypted ne contient aucune réponse en clair et se déchiffre', async () => {
    await service.submit(requester, 'u1', dto);
    const form = saved.find((s) => s.entity === EligibilityForm);
    const stored = String(form?.data.answersEncrypted);
    expect(stored).not.toContain('chronicDisease');
    expect(stored.split('.')).toHaveLength(3); // iv.tag.chiffré
    expect(JSON.parse(crypto.decrypt(stored))).toMatchObject({ chronicDisease: false });
  });

  it('sans consentement : rien n\'est enregistré', async () => {
    await expect(
      service.submit(requester, 'u1', { ...dto, consent: false } as EligibilityFormDto),
    ).rejects.toThrow();
    expect(saved).toHaveLength(0);
  });

  it('la réponse API ne renvoie jamais les réponses de santé (R4)', async () => {
    const res = await service.submit(requester, 'u1', dto);
    expect(JSON.stringify(res)).not.toContain('chronicDisease');
  });
});
