import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const inst = { id: 'i1', name: 'Hôpital Test' };
const hospital = { id: 'u-h', role: 'hopital', institutionId: 'i1' } as any;
const donorUser = { id: 'u-d', role: 'donneur', institutionId: null } as any;

const baseReq = (over: any = {}) => ({
  id: 'r1', institutionId: 'i1', institution: inst, bloodGroup: 'A+', quantity: 4, urgency: 'urgente',
  deadline: new Date('2026-10-04T18:00:00.000Z'), initialRadiusKm: 10, currentRadiusKm: 10, maxRadiusKm: 30,
  status: 'active', anomalyScore: null, createdAt: NOW, ...over,
});
const baseDonor = (over: any = {}) => ({
  userId: 'u-d', bloodGroup: 'O+', eligibilityStatus: 'eligible', nextDonationPossibleDate: null, ...over,
});

function make(opts: { req?: any; donor?: any; responses?: any[]; instOk?: boolean; saveError?: any } = {}) {
  const store = [...(opts.responses ?? [])];
  const requests = {
    create: (x: any) => x,
    save: async (x: any) => ({ id: 'new', createdAt: NOW, anomalyScore: null, ...x }),
    findOne: async () => opts.req ?? null,
    find: jest.fn(async () => [baseReq()]),
  };
  const responses = {
    create: (x: any) => x,
    findOne: async ({ where }: any) => store.find((r) => r.requestId === where.requestId && r.donorId === where.donorId) ?? null,
    save: async (x: any) => { if (opts.saveError) throw opts.saveError; store.push(x); return x; },
    count: async ({ where }: any) => store.filter((r) => r.requestId === where.requestId && r.response === where.response).length,
  };
  const donors = { findOne: async () => opts.donor ?? null };
  const institutions = {
    assertHospitalValidated: async () => {
      if (opts.instOk === false) throw new ForbiddenException('Établissement non validé par un administrateur');
      return inst;
    },
  };
  const svc = new RequestsService(requests as any, responses as any, donors as any, institutions as any);
  svc.now = () => NOW;
  return { svc, store, requests };
}

describe('RequestsService.create (T4.4)', () => {
  const dto = { bloodGroup: 'A+', quantity: 4, urgency: 'urgente', deadline: '2026-10-04T18:00:00.000Z' } as any;

  it('F5 : refuse un hôpital non validé', async () => {
    await expect(make({ instOk: false }).svc.create(dto, hospital)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse une échéance passée', async () => {
    await expect(make().svc.create({ ...dto, deadline: '2026-10-04T11:00:00.000Z' }, hospital))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('crée une demande active, rayon par défaut 10 km, établissement de l\'hôpital', async () => {
    const out = await make().svc.create(dto, hospital);
    expect(out).toMatchObject({ institutionId: 'i1', institutionName: 'Hôpital Test', status: 'active', initialRadiusKm: 10, currentRadiusKm: 10 });
  });

  it('respecte le rayon choisi', async () => {
    const out = await make().svc.create({ ...dto, initialRadiusKm: 20 }, hospital);
    expect(out.initialRadiusKm).toBe(20);
    expect(out.currentRadiusKm).toBe(20);
  });
});

describe('RequestsService lecture', () => {
  it('list hôpital : filtre sur son établissement', async () => {
    const { svc, requests } = make();
    await svc.list(hospital, 'active');
    expect((requests.find as jest.Mock).mock.calls[0][0].where).toEqual({ status: 'active', institutionId: 'i1' });
  });

  it('list direction : pas de filtre établissement', async () => {
    const { svc, requests } = make();
    await svc.list({ id: 'u', role: 'direction', institutionId: null } as any);
    expect((requests.find as jest.Mock).mock.calls[0][0].where).toEqual({});
  });

  it('getOne : 404 si absente', async () => {
    await expect(make().svc.getOne('x', hospital)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getOne : un hôpital ne lit pas la demande d\'un autre établissement', async () => {
    await expect(make({ req: baseReq({ institutionId: 'autre' }) }).svc.getOne('r1', hospital))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getOne : renvoie le DTO', async () => {
    const out = await make({ req: baseReq({ anomalyScore: '0.120' }) }).svc.getOne('r1', hospital);
    expect(out).toMatchObject({ id: 'r1', anomalyScore: 0.12, deadline: '2026-10-04T18:00:00.000Z' });
  });
});

describe('RequestsService.respond (T4.5)', () => {
  const yes = { response: 'je_viens' } as any;

  it('404 demande absente / profil donneur absent', async () => {
    await expect(make().svc.respond('r1', yes, donorUser)).rejects.toBeInstanceOf(NotFoundException);
    await expect(make({ req: baseReq() }).svc.respond('r1', yes, donorUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['couverte', 'cloturee', 'expiree', 'en_revue'])('409 si la demande est %s', async (status) => {
    await expect(make({ req: baseReq({ status }), donor: baseDonor() }).svc.respond('r1', yes, donorUser))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('409 si l\'échéance est dépassée', async () => {
    const req = baseReq({ deadline: new Date('2026-10-04T11:59:00.000Z') });
    await expect(make({ req, donor: baseDonor() }).svc.respond('r1', yes, donorUser)).rejects.toThrow('expiré');
  });

  it.each(['en_attente', 'temporaire', 'definitif'])('409 « Je viens » si donneur %s', async (eligibilityStatus) => {
    await expect(make({ req: baseReq(), donor: baseDonor({ eligibilityStatus }) }).svc.respond('r1', yes, donorUser))
      .rejects.toThrow('pas éligible');
  });

  it('409 si groupe incompatible', async () => {
    await expect(make({ req: baseReq({ bloodGroup: 'O-' }), donor: baseDonor({ bloodGroup: 'A+' }) }).svc.respond('r1', yes, donorUser))
      .rejects.toThrow('pas compatible');
  });

  it('F2.4 niveau 3 : 409 si le délai entre dons n\'est pas écoulé', async () => {
    const donor = baseDonor({ nextDonationPossibleDate: '2026-10-05' });
    await expect(make({ req: baseReq(), donor }).svc.respond('r1', yes, donorUser)).rejects.toThrow('Délai entre dons');
  });

  it('accepte quand le prochain don possible est aujourd\'hui', async () => {
    const donor = baseDonor({ nextDonationPossibleDate: '2026-10-04' });
    const out = await make({ req: baseReq(), donor }).svc.respond('r1', yes, donorUser);
    expect(out.accepted).toBe(true);
  });

  it('409 si le donneur a déjà répondu', async () => {
    const { svc } = make({ req: baseReq(), donor: baseDonor(), responses: [{ requestId: 'r1', donorId: 'u-d', response: 'je_viens' }] });
    await expect(svc.respond('r1', yes, donorUser)).rejects.toThrow('déjà répondu');
  });

  it('409 sur violation d\'unicité (course entre deux requêtes)', async () => {
    const { svc } = make({ req: baseReq(), donor: baseDonor(), saveError: { code: '23505' } });
    await expect(svc.respond('r1', yes, donorUser)).rejects.toBeInstanceOf(ConflictException);
  });

  it('« Je viens » : enregistre et met à jour la jauge', async () => {
    const { svc, store } = make({ req: baseReq({ quantity: 4 }), donor: baseDonor() });
    const out = await svc.respond('r1', yes, donorUser);
    expect(store).toHaveLength(1);
    expect(out).toEqual({ requestId: 'r1', response: 'je_viens', accepted: true, gauge: { accepted: 1, needed: 4, percent: 25 } });
  });

  it('« Je ne peux pas » : enregistré, sans contrôle d\'éligibilité, jauge inchangée', async () => {
    const donor = baseDonor({ eligibilityStatus: 'temporaire', nextDonationPossibleDate: '2027-01-01' });
    const out = await make({ req: baseReq(), donor }).svc.respond('r1', { response: 'ne_peut_pas' } as any, donorUser);
    expect(out).toMatchObject({ accepted: false, gauge: { accepted: 0, needed: 4, percent: 0 } });
  });

  it('la jauge est plafonnée à 100 %', async () => {
    const extra = Array.from({ length: 5 }, (_, i) => ({ requestId: 'r1', donorId: `d${i}`, response: 'je_viens' }));
    const out = await make({ req: baseReq({ quantity: 4 }), donor: baseDonor(), responses: extra }).svc.respond('r1', yes, donorUser);
    expect(out.gauge.percent).toBe(100);
  });
});
