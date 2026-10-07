// AJOUT : T5.5 : clôture automatique quand le besoin est couvert (fichier séparé, comme requests.live.spec.ts).
import { BloodGroup, EligibilityStatus, RequestStatus } from '../database/enums';
import { RequestsService } from './requests.service';

const GROUP = Object.values(BloodGroup)[0] as BloodGroup;
const REQ = { id: 'r1', status: 'active', deadline: new Date('2099-01-01T00:00:00Z'), bloodGroup: GROUP, quantity: 4 };
const DONOR = { userId: 'u1', bloodGroup: GROUP, eligibilityStatus: EligibilityStatus.Eligible, nextDonationPossibleDate: null };

function setup(accepted: number) {
  const requests = {
    findOne: jest.fn().mockResolvedValue(REQ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const responses = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    count: jest.fn().mockResolvedValue(accepted),
  };
  const donors = { findOne: jest.fn().mockResolvedValue(DONOR) };
  const svc = new RequestsService(requests as never, responses as never, donors as never, {} as never);
  svc.now = () => new Date('2026-10-05T12:00:00Z');
  return { svc, requests };
}

const USER = { id: 'u1' } as never;
const JE_VIENS = { response: 'je_viens' } as never;
const NE_PEUT_PAS = { response: 'ne_peut_pas' } as never;

describe('RequestsService.respond : clôture automatique (T5.5)', () => {
  it('besoin couvert (4/4) : la demande passe en couverte, filtrée sur le statut actif', async () => {
    const { svc, requests } = setup(4);
    const res = await svc.respond('r1', JE_VIENS, USER);
    expect(res.gauge).toEqual({ accepted: 4, needed: 4, percent: 100 });
    expect(requests.update).toHaveBeenCalledTimes(1);
    expect(requests.update).toHaveBeenCalledWith(
      { id: 'r1', status: RequestStatus.Active },
      expect.objectContaining({ status: RequestStatus.Couverte, closedAt: expect.any(Date) }),
    );
  });

  it('besoin dépassé (5/4) : la demande est aussi clôturée', async () => {
    const { svc, requests } = setup(5);
    await svc.respond('r1', JE_VIENS, USER);
    expect(requests.update).toHaveBeenCalledTimes(1);
  });

  it('besoin non couvert (3/4) : aucune clôture', async () => {
    const { svc, requests } = setup(3);
    await svc.respond('r1', JE_VIENS, USER);
    expect(requests.update).not.toHaveBeenCalled();
  });

  it('« Je ne peux pas » : jamais de clôture, même si la jauge est pleine', async () => {
    const { svc, requests } = setup(4);
    await svc.respond('r1', NE_PEUT_PAS, USER);
    expect(requests.update).not.toHaveBeenCalled();
  });

  it('échec de la clôture : la réponse du donneur réussit quand même', async () => {
    const { svc, requests } = setup(4);
    requests.update.mockRejectedValue(new Error('db down'));
    await expect(svc.respond('r1', JE_VIENS, USER)).resolves.toMatchObject({ accepted: true });
  });
});
