// AJOUT : T14 - création avec évaluation d'anomalie, file en_revue et décision admin.
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { ReviewDecision } from './dto/requests.dto';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const inst = { id: 'i1', name: 'Hôpital Test' };
const hospital = { id: 'u-h', role: 'hopital', institutionId: 'i1' } as any;
const dto = { bloodGroup: 'A+', quantity: 4, urgency: 'urgente', deadline: '2026-10-04T18:00:00.000Z' } as any;

const assessment = (level: string, score = '0.700') => ({
  level,
  score: Number(score),
  scoreForDb: score,
  flags: [{ code: 'QUANTITY_ABSOLUTE', weight: 0.5, message: 'test' }],
});

function make(opts: { level?: string; req?: any; affected?: number } = {}) {
  const requests = {
    create: (x: any) => x,
    save: jest.fn(async (x: any) => ({ id: 'new', createdAt: NOW, anomalyScore: null, ...x })),
    findOne: jest.fn(async () => opts.req ?? null),
    find: jest.fn(async () => []),
    update: jest.fn(async () => ({ affected: opts.affected ?? 1 })),
  };
  const institutions = { assertHospitalValidated: async () => inst };
  const anomaly = { assess: jest.fn(async () => assessment(opts.level ?? 'ok', opts.level === 'ok' ? '0.100' : '0.700')) };
  const waves = { runWave: jest.fn(async () => ({})) };
  const svc = new RequestsService(
    requests as any, {} as any, {} as any, institutions as any, waves as any, undefined, undefined, anomaly as any,
  );
  svc.now = () => NOW;
  return { svc, requests, anomaly, waves };
}

const held = (over: any = {}) => ({
  id: 'r1', institutionId: 'i1', institution: inst, bloodGroup: 'A+', quantity: 40, urgency: 'urgente',
  deadline: new Date('2026-10-04T18:00:00.000Z'), initialRadiusKm: 10, currentRadiusKm: 10, maxRadiusKm: 30,
  status: 'en_revue', anomalyScore: '0.700', createdAt: NOW, closedAt: null, ...over,
});

describe('RequestsService.create + AnomalyService (T14)', () => {
  it('ok : demande active, score enregistré, vague 1 lancée', async () => {
    const { svc, requests, waves } = make({ level: 'ok' });
    const out = await svc.create(dto, hospital);
    expect(requests.save.mock.calls[0][0]).toMatchObject({ status: 'active', anomalyScore: '0.100' });
    expect(out.status).toBe('active');
    expect(waves.runWave).toHaveBeenCalledTimes(1);
  });

  it('warn : activée quand même', async () => {
    const { svc, waves } = make({ level: 'warn' });
    expect((await svc.create(dto, hospital)).status).toBe('active');
    expect(waves.runWave).toHaveBeenCalledTimes(1);
  });

  it('review : en_revue, score enregistré, AUCUNE vague', async () => {
    const { svc, waves } = make({ level: 'review' });
    const out = await svc.create(dto, hospital);
    expect(out.status).toBe('en_revue');
    expect(out.anomalyScore).toBe(0.7);
    expect(waves.runWave).not.toHaveBeenCalled();
  });

  it("reject : 422 et rien d'enregistré", async () => {
    const { svc, requests } = make({ level: 'reject' });
    await expect(svc.create(dto, hospital)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(requests.save).not.toHaveBeenCalled();
  });

  it("assess reçoit les champs de la demande et l'horloge du service", async () => {
    const { svc, anomaly } = make();
    await svc.create(dto, hospital);
    expect(anomaly.assess).toHaveBeenCalledWith(
      { institutionId: 'i1', bloodGroup: 'A+', quantity: 4, urgency: 'urgente', deadline: new Date(dto.deadline) },
      NOW,
    );
  });
});

describe('RequestsService.listForReview / review (T14)', () => {
  it('listForReview : en_revue uniquement, score décroissant', async () => {
    const { svc, requests } = make();
    await svc.listForReview();
    expect(requests.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'en_revue' }, order: { anomalyScore: 'DESC', createdAt: 'ASC' } }),
    );
  });

  it('approve : active + vague 1', async () => {
    const { svc, requests, waves } = make({ req: held() });
    const out = await svc.review('r1', ReviewDecision.APPROVE);
    expect(requests.update).toHaveBeenCalledWith({ id: 'r1', status: 'en_revue' }, { status: 'active' });
    expect(out.status).toBe('active');
    expect(waves.runWave).toHaveBeenCalledWith('r1');
  });

  it('reject : clôturée, aucune vague', async () => {
    const { svc, requests, waves } = make({ req: held() });
    const out = await svc.review('r1', ReviewDecision.REJECT);
    expect(requests.update).toHaveBeenCalledWith({ id: 'r1', status: 'en_revue' }, { status: 'cloturee', closedAt: NOW });
    expect(out.status).toBe('cloturee');
    expect(waves.runWave).not.toHaveBeenCalled();
  });

  it("404 si la demande n'existe pas", async () => {
    await expect(make().svc.review('x', ReviewDecision.APPROVE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("409 si la demande n'est pas en revue", async () => {
    const { svc, requests } = make({ req: held({ status: 'active' }) });
    await expect(svc.review('r1', ReviewDecision.APPROVE)).rejects.toBeInstanceOf(ConflictException);
    expect(requests.update).not.toHaveBeenCalled();
  });

  it("409 si l'échéance est dépassée (approve), mais reject reste possible", async () => {
    const past = held({ deadline: new Date('2026-10-04T11:00:00.000Z') });
    await expect(make({ req: past }).svc.review('r1', ReviewDecision.APPROVE)).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ req: past }).svc.review('r1', ReviewDecision.REJECT)).resolves.toMatchObject({ status: 'cloturee' });
  });

  it("409 si un autre admin a décidé entre-temps (UPDATE sans ligne touchée), pas de vague", async () => {
    const { svc, waves } = make({ req: held(), affected: 0 });
    await expect(svc.review('r1', ReviewDecision.APPROVE)).rejects.toBeInstanceOf(ConflictException);
    expect(waves.runWave).not.toHaveBeenCalled();
  });
});
