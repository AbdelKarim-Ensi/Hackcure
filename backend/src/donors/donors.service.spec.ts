import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DonorsService } from './donors.service';

const registerDto = (over: Record<string, unknown> = {}) =>
  ({
    bloodGroup: 'A+',
    sex: 'homme',
    zone: 'Tunis',
    position: { latitude: 36.8065, longitude: 10.1815 },
    consent: true,
    ...over,
  }) as any;

function make(opts: { donor?: any; user?: any; saveError?: unknown } = {}) {
  let stored: any = opts.donor ?? null;
  const donors = {
    exists: async () => stored !== null,
    findOne: async () => stored,
    create: (x: any) => ({
      eligibilityStatus: 'en_attente',
      maxRadiusKm: 20,
      notifPrefs: { alertsEnabled: true, quietHours: null },
      ...x,
    }),
    save: async (x: any) => {
      if (opts.saveError) throw opts.saveError;
      stored = { ...x, user: opts.user };
      return stored;
    },
  };
  const users = { findOne: async () => opts.user ?? null };
  return { service: new DonorsService(donors as any, users as any), peek: () => stored };
}

const user = { id: 'u1', phone: '+21612345678', fullName: 'Amine Ben Salah' };
const donorRow = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  user,
  bloodGroup: 'A+',
  bloodGroupConfirmed: false,
  sex: 'homme',
  zone: 'Tunis',
  position: { type: 'Point', coordinates: [10.1815, 36.8065] },
  available: true,
  eligibilityStatus: 'en_attente',
  reevalDate: null,
  lastDonationDate: null,
  nextDonationPossibleDate: null,
  maxRadiusKm: 20,
  notifPrefs: { alertsEnabled: true, quietHours: null },
  consentAt: new Date('2026-10-04T08:00:00.000Z'),
  ...over,
});

describe('DonorsService', () => {
  describe('register', () => {
    it('refuse sans consentement explicite (400)', async () => {
      await expect(make({ user }).service.register('u1', registerDto({ consent: false })))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('404 si le compte n\'existe pas', async () => {
      await expect(make({}).service.register('u1', registerDto())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si le profil existe déjà', async () => {
      await expect(make({ user, donor: donorRow() }).service.register('u1', registerDto()))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('409 sur violation de clé unique (inscriptions simultanées)', async () => {
      const { service } = make({ user, saveError: { code: '23505' } });
      await expect(service.register('u1', registerDto())).rejects.toBeInstanceOf(ConflictException);
    });

    it('propage les autres erreurs de base', async () => {
      const { service } = make({ user, saveError: new Error('boom') });
      await expect(service.register('u1', registerDto())).rejects.toThrow('boom');
    });

    it('crée le profil : GeoJSON [lon, lat], groupe non confirmé, éligibilité en_attente', async () => {
      const { service, peek } = make({ user });
      const dto = await service.register('u1', registerDto());
      expect(peek().position).toEqual({ type: 'Point', coordinates: [10.1815, 36.8065] });
      expect(peek().bloodGroupConfirmed).toBe(false);
      expect(peek().consentAt).toBeInstanceOf(Date);
      expect(dto).toMatchObject({
        userId: 'u1',
        phone: '+21612345678',
        eligibilityStatus: 'en_attente',
        available: true,
        position: { latitude: 36.8065, longitude: 10.1815 },
      });
    });
  });

  describe('getMe', () => {
    it('404 si pas de profil', async () => {
      await expect(make({ user }).service.getMe('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('omet les champs vides et expose les dates en ISO', async () => {
      const dto = await make({ user, donor: donorRow({ sex: null, zone: null }) }).service.getMe('u1');
      expect(dto).not.toHaveProperty('sex');
      expect(dto).not.toHaveProperty('zone');
      expect(dto).not.toHaveProperty('lastDonationDate');
      expect(dto.consentAt).toBe('2026-10-04T08:00:00.000Z');
    });
  });

  describe('updateMe', () => {
    it('404 si pas de profil', async () => {
      await expect(make({ user }).service.updateMe('u1', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ne modifie que les champs fournis', async () => {
      const { service, peek } = make({ user, donor: donorRow() });
      const dto = await service.updateMe('u1', { available: false, maxRadiusKm: 35 });
      expect(dto).toMatchObject({ available: false, maxRadiusKm: 35, zone: 'Tunis' });
      expect(peek().position.coordinates).toEqual([10.1815, 36.8065]);
    });

    it('met à jour la position (GeoJSON) et la zone', async () => {
      const { service } = make({ user, donor: donorRow() });
      const dto = await service.updateMe('u1', { zone: 'Ariana', position: { latitude: 36.86, longitude: 10.19 } });
      expect(dto).toMatchObject({ zone: 'Ariana', position: { latitude: 36.86, longitude: 10.19 } });
    });

    it('remplace les préférences, plage de silence à null si absente', async () => {
      const { service } = make({ user, donor: donorRow({ notifPrefs: { alertsEnabled: true, quietHours: { start: '22:00', end: '07:00' } } }) });
      const dto = await service.updateMe('u1', { notifPrefs: { alertsEnabled: false } });
      expect(dto.notifPrefs).toEqual({ alertsEnabled: false, quietHours: null });
    });
  });
});
