import type { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const config = (key?: string) =>
  ({ get: () => key }) as unknown as ConfigService;
const KEY = 'ab'.repeat(32);

describe('CryptoService (AES-256-GCM)', () => {
  const c = new CryptoService(config(KEY));

  it('aller-retour correct, texte clair absent du chiffré', () => {
    const enc = c.encrypt('{"chronicDisease":false}');
    expect(enc).not.toContain('chronicDisease');
    expect(c.decrypt(enc)).toBe('{"chronicDisease":false}');
  });

  it('IV aléatoire : deux chiffrements du même texte diffèrent', () => {
    expect(c.encrypt('x')).not.toBe(c.encrypt('x'));
  });

  it('chiffré altéré : déchiffrement refusé', () => {
    const parts = c.encrypt('secret').split('.');
    parts[2] = Buffer.from('altere').toString('base64');
    expect(() => c.decrypt(parts.join('.'))).toThrow();
  });

  it('clé absente ou invalide : démarrage refusé', () => {
    expect(() => new CryptoService(config(undefined))).toThrow();
    expect(() => new CryptoService(config('abcd'))).toThrow();
  });
});
