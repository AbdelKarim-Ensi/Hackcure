import {
  BadRequestException, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { Institution, User } from '../database/entities';
import { UserRole, UserStatus, ValidationStatus } from '../database/enums';
import {
  AuthUserDto, LoginDto, RegisterDto, RegisterResponseDto, TokensDto,
} from './auth.dto';
import { ACCESS_TTL_SECONDS, JwtPayload, REFRESH_TTL_SECONDS } from './auth.types';

@Injectable()
export class AuthService {
  // Hash factice : égalise le temps de réponse quand le téléphone n'existe pas.
  private readonly dummyHash = argon2.hash('dummy-password', { type: argon2.argon2id });

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Institution) private readonly institutions: Repository<Institution>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get devMode(): boolean {
    return this.config.get<string>('OTP_DEV_MODE') === 'true';
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    if (await this.users.exists({ where: { phone: dto.phone } })) {
      throw new BadRequestException('Téléphone déjà utilisé');
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.users.save(
        this.users.create({
          phone: dto.phone,
          passwordHash,
          fullName: dto.fullName ?? null,
          role: dto.role ?? UserRole.Donneur,
          phoneVerified: false,
        }),
      );
      // T2.2 : l'envoi du code OTP sera branché ici.
      return { userId: user.id, otpSent: false };
    } catch (e: any) {
      if (e?.code === '23505') throw new BadRequestException('Téléphone déjà utilisé');
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.users.findOne({ where: { phone: dto.phone } });
    const hash = user ? user.passwordHash : await this.dummyHash;
    const ok = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !ok) throw new UnauthorizedException('Identifiants invalides');
    await this.assertUsable(user);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokensDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Refresh token invalide ou expiré');
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Refresh token invalide ou expiré');
    await this.assertUsable(user);
    return this.issueTokens(user);
  }

  /** Marque le téléphone vérifié et émet les tokens. Réutilisé par T2.2. */
  async markVerifiedAndIssue(phone: string): Promise<TokensDto> {
    const user = await this.users.findOne({ where: { phone } });
    if (!user) throw new BadRequestException("Code incorrect, expiré ou trop d'essais");
    if (!user.phoneVerified) {
      user.phoneVerified = true;
      await this.users.save(user);
    }
    await this.assertUsable(user);
    return this.issueTokens(user);
  }

  private async assertUsable(user: User): Promise<void> {
    if (user.status !== UserStatus.Actif) throw new UnauthorizedException('Compte suspendu');
    if (!user.phoneVerified) throw new UnauthorizedException('Téléphone non vérifié');
    if (user.role === UserRole.Hopital || user.role === UserRole.Crt) {
      const inst = user.institutionId
        ? await this.institutions.findOne({ where: { id: user.institutionId } })
        : null;
      if (!inst || inst.validationStatus !== ValidationStatus.Valide) {
        throw new ForbiddenException("Établissement non validé par un administrateur");
      }
    }
  }

  private async issueTokens(user: User): Promise<TokensDto> {
    const base = { sub: user.id, role: user.role, institutionId: user.institutionId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, typ: 'access' } satisfies JwtPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TTL_SECONDS,
      }),
      this.jwt.signAsync({ ...base, typ: 'refresh' } satisfies JwtPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TTL_SECONDS,
      }),
    ]);
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, user: this.toAuthUser(user) };
  }

  private toAuthUser(u: User): AuthUserDto {
    return {
      id: u.id,
      role: u.role,
      phone: u.phone,
      ...(u.fullName ? { fullName: u.fullName } : {}),
      ...(u.institutionId ? { institutionId: u.institutionId } : {}),
    };
  }
}
