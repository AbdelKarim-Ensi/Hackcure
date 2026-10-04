import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const inst = { id: 'i1', name: 'Hôpital Test' };
const hospital = { id: 'u-h', role: 'hopital', institutionId: 'i1' } as any;

const baseReq = (over: any = {}) => ({
  id: 'r1', institutionId: 'i1', institution: inst, bloodGroup: 'A+', quantity: 4, urgency: 'urgente',
  deadline: new Date('2026-10-04T18:00:00.000Z'), initialRadiusKm: 10, currentRadiusKm: 10, maxRadiusKm: 30,
  status: 'active', anomalyScore: null, createdAt: NOW, ...over,
});
function make(opts: { req?: any; instOk?: boolean } = {}) {
  const requests = {
    create: (x: any) => x,
    save: async (x: any) => ({ id: 'new', createdAt: NOW, anomalyScore: null, ...x }),
    findOne: async () => opts.req ?? null,
    find: jest.fn(async () => [baseReq()]),
  };
  const institutions = {
    assertHospitalValidated: async () => {
      if (opts.instOk === false) throw new ForbiddenException('Établissement non validé par un administrateur');
      return inst;
    },
  };
  const svc = new RequestsService(requests as any, institutions as any);
  svc.now = () => NOW;
  return { svc, requests };
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
