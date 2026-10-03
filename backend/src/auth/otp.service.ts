import {
  BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export const OTP_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const GENERIC_ERROR = "Code incorrect, expiré ou trop d'essais";

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  private get devMode(): boolean {
    return this.config.get<string>('OTP_DEV_MODE') === 'true';
  }

  private codeKey = (phone: string) => `otp:code:${phone}`;
  private attemptsKey = (phone: string) => `otp:attempts:${phone}`;
  private cooldownKey = (phone: string) => `otp:cooldown:${phone}`;

  private hash(phone: string, code: string): string {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
  }

  /** Génère un code, le stocke haché (TTL 5 min) et le renvoie à l'appelant. */
  async issue(phone: string): Promise<string> {
    if (!this.devMode) {
      const ok = await this.redis.set(this.cooldownKey(phone), '1', 'EX', RESEND_COOLDOWN_SECONDS, 'NX');
      if (ok === null) {
        throw new HttpException('Veuillez patienter avant de redemander un code', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis
      .multi()
      .set(this.codeKey(phone), this.hash(phone, code), 'EX', OTP_TTL_SECONDS)
      .del(this.attemptsKey(phone))
      .exec();
    if (this.devMode) this.logger.debug(`OTP ${phone}: ${code}`);
    else this.logger.warn('Aucun fournisseur SMS configuré : le code n\'a pas été envoyé');
    return code;
  }

  /** Lève une 400 générique si le code est faux, expiré ou si les essais sont épuisés. */
  async verify(phone: string, code: string): Promise<void> {
    const attempts = await this.redis.incr(this.attemptsKey(phone));
    if (attempts === 1) await this.redis.expire(this.attemptsKey(phone), OTP_TTL_SECONDS);
    if (attempts > MAX_ATTEMPTS) {
      await this.redis.del(this.codeKey(phone));
      throw new BadRequestException(GENERIC_ERROR);
    }
    const stored = await this.redis.get(this.codeKey(phone));
    if (!stored) throw new BadRequestException(GENERIC_ERROR);
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(this.hash(phone, code), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException(GENERIC_ERROR);
    await this.redis.del(this.codeKey(phone), this.attemptsKey(phone));
  }
}
