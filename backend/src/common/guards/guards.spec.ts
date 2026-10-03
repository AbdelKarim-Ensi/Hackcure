import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-access',
  JWT_REFRESH_SECRET: 'test-refresh',
};
const config = { getOrThrow: (k: string) => SECRETS[k] } as unknown as ConfigService;
const jwt = new JwtService({});
const reflector = new Reflector();

function makeCtx(req: any, meta: Record<string, unknown> = {}): ExecutionContext {
  const handler = () => undefined;
  class Cls {}
  for (const [k, v] of Object.entries(meta)) Reflect.defineMetadata(k, v, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => Cls,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const sign = (typ: 'access' | 'refresh', role = 'donneur', secret = SECRETS.JWT_ACCESS_SECRET) =>
  jwt.signAsync({ sub: 'u1', role, institutionId: null, typ }, { secret, expiresIn: 60 });

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(jwt, config, reflector);

  it('laisse passer une route @Public sans token', async () => {
    await expect(guard.canActivate(makeCtx({ headers: {} }, { [IS_PUBLIC_KEY]: true }))).resolves.toBe(true);
  });

  it('refuse sans en-tête Authorization (401)', async () => {
    await expect(guard.canActivate(makeCtx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un token invalide (401)', async () => {
    const req = { headers: { authorization: 'Bearer nimporte.quoi.ici' } };
    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un token signé avec un autre secret (401)', async () => {
    const token = await sign('access', 'admin', 'autre-secret');
    await expect(guard.canActivate(makeCtx({ headers: { authorization: `Bearer ${token}` } })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuse un refresh token utilisé comme access token (401)', async () => {
    const token = await sign('refresh', 'donneur', SECRETS.JWT_REFRESH_SECRET);
    await expect(guard.canActivate(makeCtx({ headers: { authorization: `Bearer ${token}` } })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepte un access token valide et pose req.user', async () => {
    const token = await sign('access', 'hopital');
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', role: 'hopital', institutionId: null });
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(reflector);

  it('laisse passer si aucun rôle n\'est exigé', () => {
    expect(guard.canActivate(makeCtx({ user: { role: 'donneur' } }))).toBe(true);
  });

  it('laisse passer un rôle autorisé', () => {
    expect(guard.canActivate(makeCtx({ user: { role: 'admin' } }, { [ROLES_KEY]: ['admin'] }))).toBe(true);
  });

  it('refuse un rôle non autorisé (403) avec le message du contrat', () => {
    const ctx = makeCtx({ user: { role: 'donneur' } }, { [ROLES_KEY]: ['hopital', 'admin'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Rôle insuffisant. Rôles autorisés : hopital, admin');
  });

  it('refuse (401) si rôles exigés mais aucun utilisateur', () => {
    expect(() => guard.canActivate(makeCtx({}, { [ROLES_KEY]: ['admin'] }))).toThrow(UnauthorizedException);
  });
});
