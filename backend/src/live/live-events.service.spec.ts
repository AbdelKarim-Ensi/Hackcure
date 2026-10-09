import { LiveEventsService } from './live-events.service';

function setup() {
  const redis = { publish: jest.fn().mockResolvedValue(1) };
  const service = new LiveEventsService(redis as never);
  const calls = () => redis.publish.mock.calls as unknown as [string, string][];
  return { service, redis, calls };
}

describe('LiveEventsService (T5.4)', () => {
  it('publishAccepted : gauge puis donor_en_route sur le canal de la demande', async () => {
    const { service, calls } = setup();
    await service.publishAccepted('r1', { accepted: 1, needed: 4, percent: 25 });

    expect(calls()).toHaveLength(2);
    expect(calls().map(([channel]) => channel)).toEqual(['live:request:r1', 'live:request:r1']);
    const [gauge, enRoute] = calls().map(([, message]) => JSON.parse(message) as Record<string, unknown>);
    expect(gauge).toMatchObject({ type: 'gauge', requestId: 'r1', accepted: 1, needed: 4, percent: 25 });
    expect(enRoute).toMatchObject({ type: 'donor_en_route', requestId: 'r1', accepted: 1 });
  });

  it('R4 : aucun identifiant de donneur ni de patient dans les payloads', async () => {
    const { service, calls } = setup();
    await service.publishAccepted('r1', { accepted: 2, needed: 4, percent: 50 });
    const [gauge, enRoute] = calls().map(([, message]) => JSON.parse(message) as Record<string, unknown>);
    expect(Object.keys(gauge).sort()).toEqual(['accepted', 'at', 'needed', 'percent', 'requestId', 'type']);
    expect(Object.keys(enRoute).sort()).toEqual(['accepted', 'at', 'requestId', 'type']);
  });

  it('Redis en panne : publish ne lève pas', async () => {
    const { service, redis } = setup();
    redis.publish.mockRejectedValue(new Error('down'));
    await expect(service.publishAccepted('r1', { accepted: 1, needed: 4, percent: 25 })).resolves.toBeUndefined();
  });

  it('publish accepte un événement wave_started (utilisé par T5.3)', async () => {
    const { service, calls } = setup();
    await service.publish({ type: 'wave_started', requestId: 'r2', waveNumber: 2, radiusKm: 20, at: '2026-10-05T12:00:00.000Z' });
    expect(calls()[0][0]).toBe('live:request:r2');
  });
});
