// T4.2 : chiffrement AES-256-GCM des réponses de santé (F1.5). T7.1 ajoutera le transformer TypeORM.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.get<string>('HEALTH_DATA_KEY') ?? '', 'hex');
    if (this.key.length !== 32) {
      throw new Error(
        'HEALTH_DATA_KEY doit faire 64 caractères hexadécimaux (32 octets)',
      );
    }
  }

  /** Format : iv.tag.chiffré (base64). IV aléatoire par valeur. */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc]
      .map((b) => b.toString('base64'))
      .join('.');
  }

  decrypt(payload: string): string {
    const [iv, tag, enc] = payload
      .split('.')
      .map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8',
    );
  }
}
