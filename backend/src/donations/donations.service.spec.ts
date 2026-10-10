import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DonationsService } from './donations.service';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const hospital = { id: 'h1', role: 'hopital', institutionId: 'i1' } as any;

const donorRow = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  eligibilityStatus: 'eligible',
  reevalDate: null,
  lastDonationDate: null,
  nextDonationPossibleDate: null,
  ...over,
});

function make(opts: { donor?: any; inst?: any } = {}) {
  const writes: { target: string; row: any }[] = [];
  const manager = {
    save: async (target: any, row: any) => {
      writes.push({ target: target.name, row: { ...row } });
      return target.name === 'Donation' ? { ...row, id: 'don1' } : row;
    },
  };
  const donations = { manager: { transaction: async (cb: any) => cb(manager) } };
  const donors = { findOne: async () => opts.donor ?? null };
  const institutions = { findOne: async () => opts.inst ?? null };
  return { service: new DonationsService(donations as any, donors as any, institutions as any), writes };
}

const confirmDto = (over: Record<string, unknown> = {}) =>
  ({ donorId: 'u1', type: 'sang_total', source: 'urgence', ...over }) as any;

describe('DonationsService.nextDonationDate', () => {
  const donneur = { id: 'u1', role: 'donneur', institutionId: null } as any;

  it('403 si un donneur consulte le dossier d\'un autre', async () => {
    await expect(make({ donor: donorRow() }).service.nextDonationDate({ ...donneur, id: 'u2' }, 'u1', NOW))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un hôpital peut consulter n\'importe quel donneur', async () => {
    const dto = await make({ donor: donorRow() }).service.nextDonationDate(hospital, 'u1', NOW);
    expect(dto.canDonateNow).toBe(true);
  });

  it('404 si le donneur n\'existe pas', async () => {
    await expect(make({}).service.nextDonationDate(donneur, 'u1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eligible, jamais donné : null et peut donner', async () => {
    expect(await make({ donor: donorRow() }).service.nextDonationDate(donneur, 'u1', NOW)).toEqual({
      nextDonationPossibleDate: null,
      canDonateNow: true,
      message: 'Vous pouvez donner dès maintenant',
    });
  });

  it('eligible, délai non écoulé : false et date au format JJ/MM', async () => {
    const dto = await make({ donor: donorRow({ nextDonationPossibleDate: '2026-12-10' }) })
      .service.nextDonationDate(donneur, 'u1', NOW);
    expect(dto).toEqual({
      nextDonationPossibleDate: '2026-12-10',
      canDonateNow: false,
      message: 'Prochain don possible le 10/12',
    });
  });

  it.each(['2026-10-03', '2026-09-10'])('eligible, date atteinte ou passée (%s) : peut donner', async (next) => {
    const dto = await make({ donor: donorRow({ nextDonationPossibleDate: next }) })
      .service.nextDonationDate(donneur, 'u1', NOW);
    expect(dto.canDonateNow).toBe(true);
  });

  it('en_attente : false, invite à remplir le formulaire', async () => {
    const dto = await make({ donor: donorRow({ eligibilityStatus: 'en_attente' }) })
      .service.nextDonationDate(donneur, 'u1', NOW);
    expect(dto.canDonateNow).toBe(false);
    expect(dto.message).toContain("formulaire d'éligibilité");
  });

  it('definitif : false, sans détail médical', async () => {
    const dto = await make({ donor: donorRow({ eligibilityStatus: 'definitif' }) })
      .service.nextDonationDate(donneur, 'u1', NOW);
    expect(dto.canDonateNow).toBe(false);
    expect(dto.message).toBe("Don impossible selon votre statut d'éligibilité");
  });

  it('temporaire : false avec date de réévaluation', async () => {
    const dto = await make({ donor: donorRow({ eligibilityStatus: 'temporaire', reevalDate: '2027-01-15' }) })
      .service.nextDonationDate(donneur, 'u1', NOW);
    expect(dto.canDonateNow).toBe(false);
    expect(dto.message).toBe('Don temporairement impossible, réévaluation prévue le 15/01');
  });
});

describe('DonationsService.confirm', () => {
  it('404 si le donneur n\'existe pas', async () => {
    await expect(make({}).service.confirm(confirmDto(), hospital, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 si la date est dans le futur', async () => {
    await expect(make({ donor: donorRow() }).service.confirm(confirmDto({ donatedAt: '2026-10-04' }), hospital, NOW))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 si la date n\'existe pas au calendrier', async () => {
    await expect(make({ donor: donorRow() }).service.confirm(confirmDto({ donatedAt: '2026-02-30' }), hospital, NOW))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('enregistre le don et recalcule les dates du donneur (sang total : +90 jours)', async () => {
    const { service, writes } = make({ donor: donorRow(), inst: { name: 'Hôpital Charles Nicolle' } });
    const dto = await service.confirm(confirmDto(), hospital, NOW);
    expect(dto).toEqual({
      id: 'don1',
      donorId: 'u1',
      type: 'sang_total',
      donatedAt: '2026-10-03',
      place: 'Hôpital Charles Nicolle',
      source: 'urgence',
      confirmedBy: 'h1',
      nextDonationPossibleDate: '2027-01-01',
    });
    expect(writes.map((w) => w.target)).toEqual(['Donation', 'Donor']);
    expect(writes[1].row).toMatchObject({ lastDonationDate: '2026-10-03', nextDonationPossibleDate: '2027-01-01' });
  });

  it('le lieu fourni prime sur le nom de l\'établissement', async () => {
    const dto = await make({ donor: donorRow(), inst: { name: 'Autre' } })
      .service.confirm(confirmDto({ place: 'Collecte ENSI' }), hospital, NOW);
    expect(dto.place).toBe('Collecte ENSI');
  });

  it('sans lieu ni établissement : pas de champ place', async () => {
    const dto = await make({ donor: donorRow() }).service.confirm(confirmDto(), { ...hospital, institutionId: null }, NOW);
    expect(dto).not.toHaveProperty('place');
  });

  it('plaquettes : délai de 14 jours', async () => {
    const dto = await make({ donor: donorRow() }).service.confirm(confirmDto({ type: 'plaquettes' }), hospital, NOW);
    expect(dto.nextDonationPossibleDate).toBe('2026-10-17');
  });

  it('un don antidaté ne fait pas reculer les dates déjà enregistrées', async () => {
    const donor = donorRow({ lastDonationDate: '2026-09-01', nextDonationPossibleDate: '2026-11-30' });
    const { service, writes } = make({ donor });
    const dto = await service.confirm(confirmDto({ donatedAt: '2026-06-12' }), hospital, NOW);
    expect(dto.nextDonationPossibleDate).toBe('2026-11-30');
    expect(writes[1].row).toMatchObject({ lastDonationDate: '2026-09-01', nextDonationPossibleDate: '2026-11-30' });
  });
});
