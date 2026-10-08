// AJOUT : T7.4
import { NotFoundException } from '@nestjs/common';
import { DonorErasureService } from './donor-erasure.service';

function make(found: boolean, failAt?: string) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const manager = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (failAt && sql.includes(failAt)) throw new Error('boom');
      return sql.startsWith('SELECT') ? (found ? [{ user_id: 'u1' }] : []) : [];
    },
  };
  const dataSource = { transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(manager) };
  return { service: new DonorErasureService(dataSource as any), calls };
}

describe('DonorErasureService', () => {
  it('404 si pas de profil donneur, rien n\'est modifié', async () => {
    const { service, calls } = make(false);
    await expect(service.erase('u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toHaveLength(1);
  });

  it('supprime formulaires et notifications, anonymise donors et users dans l\'ordre', async () => {
    const { service, calls } = make(true);
    await service.erase('u1');
    const sqls = calls.map((c) => c.sql);
    expect(sqls[1]).toContain('DELETE FROM eligibility_forms');
    expect(sqls[2]).toContain('DELETE FROM notifications');
    expect(sqls[3]).toContain('UPDATE donors');
    expect(sqls[3]).toContain('consent_at = NULL');
    expect(sqls[4]).toContain('UPDATE users');
    expect(sqls[4]).toContain("status = 'suspendu'");
    expect(sqls.some((s) => /DELETE FROM (users|donors)/.test(s))).toBe(false);
  });

  it('password_hash aléatoire (64 hex), différent à chaque appel', async () => {
    const a = make(true);
    const b = make(true);
    await a.service.erase('u1');
    await b.service.erase('u1');
    const ha = a.calls[4].params[1] as string;
    const hb = b.calls[4].params[1] as string;
    expect(ha).toMatch(/^[0-9a-f]{64}$/);
    expect(ha).not.toBe(hb);
  });

  it('une erreur remonte (la transaction annule tout)', async () => {
    await expect(make(true, 'UPDATE users').service.erase('u1')).rejects.toThrow('boom');
  });
});
