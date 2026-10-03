import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, JwtPayload } from '../../auth/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const MESSAGE = 'Token absent, invalide ou expiré';

interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Le WebSocket vérifie son propre JWT au handshake (T5.3).
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers['authorization'];
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException(MESSAGE);

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(MESSAGE);
    }
    // Un refresh token ne doit jamais servir d'access token.
    if (payload.typ !== 'access') throw new UnauthorizedException(MESSAGE);

    req.user = { id: payload.sub, role: payload.role, institutionId: payload.institutionId ?? null };
    return true;
  }
}
