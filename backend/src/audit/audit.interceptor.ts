// AJOUT : T7.2 interceptor global : écrit dans audit_log (append-only) après une action réussie
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities';
import { findAuditRule } from './audit-rules';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const routePath: string = req.route?.path ?? req.routeOptions?.url ?? req.path;
    const rule = findAuditRule(req.method, routePath);
    if (!rule) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const entityId = req.params?.id ?? (result as { id?: string } | null)?.id ?? null;
        // Un échec d'écriture de l'audit ne doit jamais casser la réponse métier
        void this.repo
          .insert({
            actorId: req.user?.id ?? null,
            action: rule.action,
            entity: rule.entity,
            entityId: entityId ? String(entityId).slice(0, 64) : null,
            ip: req.ip ?? null,
          })
          .catch((err: unknown) => this.logger.warn(`audit non écrit : ${String(err)}`));
      }),
    );
  }
}
