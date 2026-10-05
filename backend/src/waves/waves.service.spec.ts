import { NotificationStatus, NotificationType } from '../database/enums';
import { WavesService } from './waves.service';

const REQUEST = {
  id: 'r1',
  bloodGroup: 'O+',
  urgency: 'urgente',
  deadline: new Date('2026-10-06T12:00:00Z'),
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

function setup(plan: unknown) {
  const requests = { findOneOrFail: jest.fn().mockResolvedValue(REQUEST), update: jest.fn() };
  const waves = { create: jest.fn((x: unknown) => x), save: jest.fn(async (x: unknown) => x) };
  const matching = { planWave: jest.fn().mockResolvedValue(plan) };
  const notifications = { notify: jest.fn(async () => ({ status: NotificationStatus.Envoyee })) };
  const service = new WavesService(requests as never, waves as never, matching as never, notifications as never);
  return { service, requests, waves, matching, notifications };
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

  it('wait / covered / expired : rien n’est écrit ni envoyé', async () => {
    for (const action of ['wait', 'covered', 'expired', 'exhausted']) {
      const { service, waves, notifications } = setup({ requestId: 'r1', decision: { action }, donorIds: [], ranked: [] });
      const res = await service.runWave('r1');
      expect(res.action).toBe(action);
      expect(waves.save).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    }
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
