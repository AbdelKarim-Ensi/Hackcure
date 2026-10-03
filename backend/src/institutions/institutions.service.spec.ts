import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';

const inst = (status: string) => ({ id: 'i1', name: 'H1', type: 'hopital', validationStatus: status, address: null, position: null });

function make(opts: { inst?: any; user?: any }) {
  const institutions = {
    findOne: async () => opts.inst ?? null,
    save: async (x: any) => x,
  };
  const users = { findOne: async () => opts.user ?? null };
  return new InstitutionsService(institutions as any, users as any);
}

describe('InstitutionsService', () => {
  it('validate : 404 si établissement absent', async () => {
    await expect(make({}).validate('x', 'valide')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validate : met à jour le statut', async () => {
    const dto = await make({ inst: inst('en_attente') }).validate('i1', 'valide');
    expect(dto.validationStatus).toBe('valide');
  });

  it('F5 : refuse un compte sans établissement', async () => {
    await expect(make({ user: { institutionId: null } }).assertHospitalValidated('u1'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['en_attente', 'rejete'])('F5 : refuse un établissement %s', async (s) => {
    await expect(make({ user: { institutionId: 'i1' }, inst: inst(s) }).assertHospitalValidated('u1'))
      .rejects.toThrow('Établissement non validé par un administrateur');
  });

  it('F5 : accepte un établissement valide', async () => {
    await expect(make({ user: { institutionId: 'i1' }, inst: inst('valide') }).assertHospitalValidated('u1'))
      .resolves.toMatchObject({ id: 'i1' });
  });
});
