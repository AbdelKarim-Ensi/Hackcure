import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true; // authentifié suffit

    const user = context.switchToHttp().getRequest().user as { role?: string } | undefined;
    if (!user?.role) throw new UnauthorizedException('Token absent, invalide ou expiré');
    if (!roles.includes(user.role)) {
      throw new ForbiddenException(`Rôle insuffisant. Rôles autorisés : ${roles.join(', ')}`);
    }
    return true;
  }
}
