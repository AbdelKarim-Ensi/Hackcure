// T5.4 : respond() publie les événements temps réel (fichier séparé de requests.service.spec.ts).
import { ConflictException } from '@nestjs/common';
import { BloodGroup, EligibilityStatus } from '../database/enums';
import { RequestsService } from './requests.service';

const GROUP = Object.values(BloodGroup)[0] as BloodGroup;
const REQ = { id: 'r1', status: 'active', deadline: new Date('2099-01-01T00:00:00Z'), bloodGroup: GROUP, quantity: 4 };
const DONOR = { userId: 'u1', bloodGroup: GROUP, eligibilityStatus: EligibilityStatus.Eligible, nextDonationPossibleDate: null };

function setup(withLive = true) {
  const requests = { findOne: jest.fn().mockResolvedValue(REQ) };
  const responses = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    count: jest.fn().mockResolvedValue(1),
  };
  const donors = { findOne: jest.fn().mockResolvedValue(DONOR) };
  const live = { publishAccepted: jest.fn().mockResolvedValue(undefined) };
  const svc = new RequestsService(
    requests as never,
    responses as never,
    donors as never,
    {} as never,
    undefined,
    withLive ? (live as never) : undefined,
  );
  svc.now = () => new Date('2026-10-05T12:00:00Z');
  return { svc, responses, live };
}

const USER = { id: 'u1' } as never;
const JE_VIENS = { response: 'je_viens' } as never;
const NE_PEUT_PAS = { response: 'ne_peut_pas' } as never;

describe('RequestsService.respond : temps réel (T5.4)', () => {
  it('« Je viens » : publie la jauge à jour', async () => {
    const { svc, live } = setup();
    const res = await svc.respond('r1', JE_VIENS, USER);
    expect(res.gauge).toEqual({ accepted: 1, needed: 4, percent: 25 });
    expect(live.publishAccepted).toHaveBeenCalledWith('r1', { accepted: 1, needed: 4, percent: 25 });
  });

  it('« Je ne peux pas » : rien n’est publié', async () => {
    const { svc, live } = setup();
    await svc.respond('r1', NE_PEUT_PAS, USER);
    expect(live.publishAccepted).not.toHaveBeenCalled();
  });

  it('réponse refusée (déjà répondu) : rien n’est publié', async () => {
    const { svc, responses, live } = setup();
    responses.findOne.mockResolvedValue({ id: 'x' });
    await expect(svc.respond('r1', JE_VIENS, USER)).rejects.toBeInstanceOf(ConflictException);
    expect(live.publishAccepted).not.toHaveBeenCalled();
  });

  it('échec de publication : la réponse du donneur réussit quand même', async () => {
    const { svc, live } = setup();
    live.publishAccepted.mockRejectedValue(new Error('redis down'));
    await expect(svc.respond('r1', JE_VIENS, USER)).resolves.toMatchObject({ accepted: true });
  });

  it('sans LiveEventsService (@Optional) : respond fonctionne', async () => {
    const { svc } = setup(false);
    await expect(svc.respond('r1', JE_VIENS, USER)).resolves.toMatchObject({ accepted: true });
  });
});
