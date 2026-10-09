import { WavesService } from './waves.service';

// launch() est privé : on l'appelle directement avec une vague vide (0 destinataire), seule la publication nous intéresse.
function setup(withLive = true) {
  const requests = { update: jest.fn().mockResolvedValue(undefined) };
  const waves = { create: jest.fn((x: unknown) => x), save: jest.fn().mockResolvedValue(undefined) };
  const queue = { scheduleCheck: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const live = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new WavesService(
    requests as never, waves as never, {} as never, {} as never, {} as never, queue as never, config as never,
    withLive ? (live as never) : undefined,
  );
  const request = { id: 'r1', urgency: 'urgente', bloodGroup: 'A+', deadline: new Date(Date.now() + 3_600_000), institution: { name: 'H' } };
  const launch = () =>
    (service as unknown as { launch: (...a: unknown[]) => Promise<unknown> }).launch(request, { donorIds: [], ranked: [] }, 2, 20);
  return { launch, live };
}

describe('WavesService.launch : wave_started (T5.3)', () => {
  it('publie wave_started avec le numéro et le rayon, sans autre champ (R4)', async () => {
    const { launch, live } = setup();
    await launch();
    expect(live.publish).toHaveBeenCalledTimes(1);
    const event = live.publish.mock.calls[0][0] as Record<string, unknown>;
    expect(event).toMatchObject({ type: 'wave_started', requestId: 'r1', waveNumber: 2, radiusKm: 20 });
    expect(Object.keys(event).sort()).toEqual(['at', 'radiusKm', 'requestId', 'type', 'waveNumber']);
  });

  it('sans LiveEventsService (optionnel) : aucune erreur', async () => {
    const { launch } = setup(false);
    await expect(launch()).resolves.toBeDefined();
  });
});
