import { NotificationStatus, NotificationType } from '../database/enums';
import { WavesService } from './waves.service';

const REQUEST = {
  id: 'r1',
  bloodGroup: 'O+',
  urgency: 'urgente',
  deadline: new Date('2099-01-01T00:00:00Z'),
  institution: { name: 'Hôpital Test' },
};

const launchPlan = (donorIds: string[]) => ({
  requestId: 'r1',
  decision: { action: 'launch', waveNumber: 1, radiusKm: 10 },
  donorIds,
  ranked: [
    { donorId: 'd1', components: { dist: 0.7 } },
    { donorId: 'd2', components: { dist: 0.5 } },
  ],
});

const idlePlan = (decision: Record<string, unknown>) => ({ requestId: 'r1', decision, donorIds: [], ranked: [] });

function setup(plan: unknown, opts: { lockHeld?: boolean; demoDelay?: string } = {}) {
  const requests = { findOne: jest.fn().mockResolvedValue(REQUEST), update: jest.fn() };
  const waves = { create: jest.fn((x: unknown) => x), save: jest.fn(async (x: unknown) => x) };
  const matching = { planWave: jest.fn().mockResolvedValue(plan) };
  const notifications = { notify: jest.fn(async () => ({ status: NotificationStatus.Envoyee })) };
  const redis = { set: jest.fn(async () => (opts.lockHeld ? null : 'OK')), eval: jest.fn(async () => 1) };
  const queue = { scheduleCheck: jest.fn(async () => undefined) };
  const config = { get: jest.fn((k: string) => (k === 'WAVE_DELAY_SECONDS' ? opts.demoDelay : undefined)) };
  const service = new WavesService(
    requests as never,
    waves as never,
    matching as never,
    notifications as never,
    redis as never,
    queue as never,
    config as never,
  );
  return { service, requests, waves, matching, notifications, redis, queue };
}

describe('WavesService (T5.1)', () => {
  it('vague 1 : trace la vague puis alerte chaque donneur', async () => {
    const { service, waves, notifications, requests } = setup(launchPlan(['d1', 'd2']));
    const res = await service.runWave('r1');

    expect(waves.save).toHaveBeenCalledWith({ requestId: 'r1', waveNumber: 1, radiusKm: 10, sentTo: 2 });
    expect(requests.update).toHaveBeenCalledWith('r1', { currentRadiusKm: 10 });
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ action: 'launch', waveNumber: 1, radiusKm: 10, sent: 2, failed: 0, skipped: 0 });
  });

  it('la trace de la vague est écrite avant le premier envoi', async () => {
    const { service, waves, notifications } = setup(launchPlan(['d1']));
    await service.runWave('r1');
    expect(waves.save.mock.invocationCallOrder[0]).toBeLessThan(notifications.notify.mock.invocationCallOrder[0]);
  });

  it('R4 : le payload ne contient que la liste blanche, avec la distance calculée', async () => {
    const { service, notifications } = setup(launchPlan(['d1']));
    await service.runWave('r1');
    const arg = (notifications.notify.mock.calls[0] as unknown[])[0] as { userId: string; type: string; payload: Record<string, unknown> };
    expect(arg.type).toBe(NotificationType.Urgence);
    expect(arg.userId).toBe('d1');
    expect(Object.keys(arg.payload).sort()).toEqual(
      ['bloodGroup', 'deadline', 'distanceKm', 'hospitalName', 'requestId', 'type', 'urgency'],
    );
    expect(arg.payload.distanceKm).toBe(3);
  });

  it('aucun candidat : la vague est quand même tracée (le rayon pourra s’élargir)', async () => {
    const { service, waves, notifications } = setup(launchPlan([]));
    const res = await service.runWave('r1');
    expect(waves.save).toHaveBeenCalledWith(expect.objectContaining({ sentTo: 0 }));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
  });

  it('compte les échecs et les quotas ignorés', async () => {
    const { service, notifications } = setup(launchPlan(['d1', 'd2']));
    notifications.notify
      .mockResolvedValueOnce({ status: NotificationStatus.Echec } as never)
      .mockResolvedValueOnce(null as never);
    const res = await service.runWave('r1');
    expect(res).toMatchObject({ sent: 0, failed: 1, skipped: 1 });
  });
});

describe('WavesService (T5.2)', () => {
  it('après une vague : planifie le contrôle différé avec un jobId déterministe', async () => {
    const { service, queue } = setup(launchPlan(['d1']));
    await service.runWave('r1');
    expect(queue.scheduleCheck).toHaveBeenCalledWith('r1', expect.any(Number), 'r1-wave-1');
  });

  it('WAVE_DELAY_SECONDS=30 : contrôle à 30 s (+1 s de marge)', async () => {
    const { service, queue } = setup(launchPlan(['d1']), { demoDelay: '30' });
    await service.runWave('r1');
    expect(queue.scheduleCheck).toHaveBeenCalledWith('r1', 31_000, 'r1-wave-1');
  });

  it('wait : rien d’écrit ni d’envoyé, le contrôle est replanifié à l’échéance', async () => {
    const nextCheckAt = new Date(Date.now() + 20_000);
    const { service, waves, notifications, requests, queue } = setup(idlePlan({ action: 'wait', nextCheckAt }));
    const res = await service.runWave('r1');
    expect(res.action).toBe('wait');
    expect(waves.save).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(requests.update).not.toHaveBeenCalled();
    expect(queue.scheduleCheck).toHaveBeenCalledWith('r1', expect.any(Number), `r1-wait-${nextCheckAt.getTime()}`);
  });

  it('covered : la demande est clôturée « couverte », plus aucun contrôle', async () => {
    const { service, requests, queue } = setup(idlePlan({ action: 'covered' }));
    const res = await service.runWave('r1');
    expect(res).toMatchObject({ action: 'covered', closedAs: 'couverte' });
    expect(requests.update).toHaveBeenCalledWith({ id: 'r1', status: 'active' }, { status: 'couverte', closedAt: expect.any(Date) });
    expect(queue.scheduleCheck).not.toHaveBeenCalled();
  });

  it('expired : la demande est clôturée « expiree »', async () => {
    const { service, requests, notifications } = setup(idlePlan({ action: 'expired' }));
    const res = await service.runWave('r1');
    expect(res).toMatchObject({ action: 'expired', closedAs: 'expiree' });
    expect(requests.update).toHaveBeenCalledWith({ id: 'r1', status: 'active' }, { status: 'expiree', closedAt: expect.any(Date) });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('exhausted : pas de clôture immédiate, un contrôle est planifié à l’échéance', async () => {
    const { service, requests, queue } = setup(idlePlan({ action: 'exhausted' }));
    const res = await service.runWave('r1');
    expect(res.action).toBe('exhausted');
    expect(requests.update).not.toHaveBeenCalled();
    expect(queue.scheduleCheck).toHaveBeenCalledWith('r1', expect.any(Number), 'r1-deadline');
  });

  it('verrou déjà pris : aucun traitement', async () => {
    const { service, matching, queue } = setup(launchPlan(['d1']), { lockHeld: true });
    const res = await service.runWave('r1');
    expect(res.action).toBe('skipped');
    expect(matching.planWave).not.toHaveBeenCalled();
    expect(queue.scheduleCheck).not.toHaveBeenCalled();
  });

  it('verrou pris avec SET NX PX et libéré même si le traitement échoue', async () => {
    const { service, matching, redis } = setup(launchPlan(['d1']));
    matching.planWave.mockRejectedValueOnce(new Error('boom'));
    await expect(service.runWave('r1')).rejects.toThrow('boom');
    expect(redis.set).toHaveBeenCalledWith('lock:wave:r1', expect.any(String), 'PX', 60_000, 'NX');
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });
});
