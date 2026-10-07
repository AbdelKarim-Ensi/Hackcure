// AJOUT : T6.2 - jeton QR signé (HMAC-SHA256), valable jusqu'à la fin du jour de l'événement.
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface QrPayload {
  registrationId: string;
  eventId: string;
  donorId: string;
  exp: number;
}

@Injectable()
export class QrTokenService {
  private secret(): string {
    const s = process.env.QR_TOKEN_SECRET;
    if (!s || s.length < 16) {
      throw new InternalServerErrorException('QR_TOKEN_SECRET manquant ou trop court');
    }
    return s;
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret()).update(body).digest('base64url');
  }

  sign(p: Omit<QrPayload, 'exp'>, eventDate: string): string {
    const exp = Math.floor(new Date(`${eventDate}T23:59:59Z`).getTime() / 1000);
    const body = Buffer.from(JSON.stringify({ ...p, exp })).toString('base64url');
    return `${body}.${this.signature(body)}`;
  }

  /** Lève NotFoundException (404 du contrat checkin) si le jeton est invalide ou expiré. */
  verify(token: string): QrPayload {
    const invalid = new NotFoundException('Jeton QR invalide ou expiré');
    const [body, sig] = (token ?? '').split('.');
    if (!body || !sig) throw invalid;

    const expected = Buffer.from(this.signature(body));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid;

    let payload: QrPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QrPayload;
    } catch {
      throw invalid;
    }
    if (!payload.exp || payload.exp * 1000 < Date.now()) throw invalid;
    return payload;
  }
}
