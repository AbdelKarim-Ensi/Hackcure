import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { CrtEvent } from '../database/entities/events.entities';
import { Donor } from '../database/entities/identity.entities';
import { EligibilityStatus, EventStatus } from '../database/enums';
import { addDays, iso } from '../rules';
import { eligibleOn, EventsService } from './events.service';

const day = (offset: number): string => iso(addDays(new Date(), offset));
const USER = { id: 'u1', role: 'donneur' as never, institutionId: null };
const dto = { slot: '09:00' };

function setup(donor: Record<string, unknown>, eventDate: string) {
  const event = {
    id: 'e1',
    status: EventStatus.Publie,
    eventDate,
    capacity: 60,
    slots: [{ time: '09:00', capacity: 20 }],
  };
  const full = {
    userId: 'u1',
    eligibilityStatus: EligibilityStatus.Eligible,
    lastDonationDate: null,
    nextDonationPossibleDate: null,
    sex: 'homme',
    ...donor,
  };
  const m = {
    findOne: jest.fn(async (entity: unknown) => (entity === CrtEvent ? event : entity === Donor ? full : null)),
    count: jest.fn(async () => 0),
    create: jest.fn((_e: unknown, x: object) => ({ ...x })),
    save: jest.fn(async (x: object) => ({ id: 'reg1', ...x })),
  };
  const dataSource = { transaction: jest.fn(async (cb: (mm: unknown) => unknown) => cb(m)) };
  const qr = { sign: jest.fn(() => 'qr') };
  const notifier = { scheduleReminders: jest.fn(async () => undefined) };
  const service = new EventsService({} as never, {} as never, dataSource as never, qr as never, notifier as never);
  return { service };
}

describe('eligibleOn (R5 : à la date de l’événement)', () => {
  const base = { sex: 'homme' as never, nextDonationPossibleDate: null };

  it('dernier don trop récent à la date de l’événement : false', () => {
    expect(eligibleOn({ ...base, lastDonationDate: day(-30) }, day(10))).toBe(false);
  });
  it('événement assez éloigné dans le temps : true', () => {
    expect(eligibleOn({ ...base, lastDonationDate: day(-30) }, day(300))).toBe(true);
  });
  it('jamais donné : true', () => {
    expect(eligibleOn({ ...base, lastDonationDate: null }, day(10))).toBe(true);
  });
  it('prochain don possible après l’événement : false', () => {
    expect(eligibleOn({ ...base, lastDonationDate: null, nextDonationPossibleDate: day(20) }, day(10))).toBe(false);
  });
});

describe('EventsService.register : contrôle R5 côté serveur', () => {
  it('refuse en 409 si le donneur n’est pas éligible à la date de l’événement', async () => {
    const { service } = setup({ lastDonationDate: day(-30) }, day(10));
    const p = service.register('e1', dto, USER);
    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.toThrow(/prochain don possible le \d{4}-\d{2}-\d{2}/);
  });

  it('accepte pour un événement assez éloigné dans le temps', async () => {
    const { service } = setup({ lastDonationDate: day(-30) }, day(300));
    await expect(service.register('e1', dto, USER)).resolves.toMatchObject({ slot: '09:00', status: 'inscrit' });
  });

  it('accepte un donneur qui n’a jamais donné', async () => {
    const { service } = setup({ lastDonationDate: null }, day(10));
    await expect(service.register('e1', dto, USER)).resolves.toMatchObject({ eventId: 'e1' });
  });

  it('refuse en 409 si nextDonationPossibleDate est après l’événement', async () => {
    const { service } = setup({ nextDonationPossibleDate: day(20) }, day(10));
    await expect(service.register('e1', dto, USER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('statut d’éligibilité global non éligible : toujours 422', async () => {
    const { service } = setup({ eligibilityStatus: EligibilityStatus.EnAttente }, day(10));
    await expect(service.register('e1', dto, USER)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
