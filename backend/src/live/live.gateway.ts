// AJOUT T5.3 : gateway Socket.IO /live. JWT vérifié au handshake, une room par demande, relais des événements Redis.
import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import type { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.types';
import { BloodRequest } from '../database/entities/requests.entities';
import { REDIS } from '../redis/redis.module';
import { LIVE_CHANNEL_PATTERN } from './live.constants';
import { roomOf, toClientEvent } from './live.serializer';

const UNAUTHORIZED = 'Token absent, invalide ou expiré';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LiveSocketData {
  user?: AuthenticatedUser;
}

export type JoinResult = { ok: true; requestId: string } | { ok: false; error: string };

function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token) return auth.token.replace(/^Bearer\s+/i, '');
  const header = socket.handshake.headers['authorization'];
  const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

@WebSocketGateway({ namespace: '/live' })
export class LiveGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveGateway.name);
  private sub?: Redis;

  @WebSocketServer() server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(BloodRequest) private readonly requests: Repository<BloodRequest>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Middleware du namespace : refuse la connexion tant que le JWT d'accès n'est pas valide. */
  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      void this.authenticateHandshake(socket, next);
    });
  }

  async authenticateHandshake(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const token = extractToken(socket);
    if (!token) return next(new Error(UNAUTHORIZED));

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return next(new Error(UNAUTHORIZED));
    }
    // Un refresh token ne doit jamais servir d'access token (même règle que JwtAuthGuard).
    if (payload.typ !== 'access') return next(new Error(UNAUTHORIZED));

    (socket.data as LiveSocketData).user = {
      id: payload.sub,
      role: payload.role,
      institutionId: payload.institutionId ?? null,
    };
    next();
  }

  @SubscribeMessage('join_request')
  async joinRequest(@ConnectedSocket() socket: Socket, @MessageBody() body: { requestId?: unknown }): Promise<JoinResult> {
    const user = (socket.data as LiveSocketData).user;
    if (!user) return { ok: false, error: 'unauthorized' };

    const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
    if (!UUID_RE.test(requestId)) return { ok: false, error: 'invalid_request_id' };
    if (!(await this.canAccess(user, requestId))) return { ok: false, error: 'forbidden' };

    await socket.join(roomOf(requestId));
    return { ok: true, requestId };
  }

  @SubscribeMessage('leave_request')
  async leaveRequest(@ConnectedSocket() socket: Socket, @MessageBody() body: { requestId?: unknown }): Promise<JoinResult> {
    const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
    if (!UUID_RE.test(requestId)) return { ok: false, error: 'invalid_request_id' };
    await socket.leave(roomOf(requestId));
    return { ok: true, requestId };
  }

  /** hôpital : sa propre demande ; crt, direction, admin : toutes ; donneur : jamais. */
  private async canAccess(user: AuthenticatedUser, requestId: string): Promise<boolean> {
    const role: string = user.role;
    if (role !== 'hopital' && role !== 'crt' && role !== 'direction' && role !== 'admin') return false;

    const request = await this.requests.findOne({ where: { id: requestId }, select: { id: true, institutionId: true } });
    if (!request) return false;
    if (role === 'hopital') return !!user.institutionId && request.institutionId === user.institutionId;
    return true;
  }

  onModuleInit(): void {
    // Connexion dédiée : un client Redis en mode subscribe ne peut plus exécuter d'autres commandes.
    this.sub = this.redis.duplicate();
    this.sub.on('error', (e: Error) => this.logger.warn(`Redis (abonnement live) : ${e.message}`));
    this.sub.on('pmessage', (_pattern: string, channel: string, message: string) => this.relay(channel, message));
    // Pas d'await : un Redis indisponible au démarrage ne doit pas bloquer l'application.
    void this.sub
      .psubscribe(LIVE_CHANNEL_PATTERN)
      .catch((e: Error) => this.logger.warn(`Abonnement ${LIVE_CHANNEL_PATTERN} impossible : ${e.message}`));
  }

  onModuleDestroy(): void {
    this.sub?.disconnect();
  }

  /** Émission locale : chaque instance relaie pour ses propres clients, l'adaptateur ne doit pas dupliquer. */
  relay(channel: string, message: string): void {
    const out = toClientEvent(channel, message);
    if (!out) return;
    this.server.local.to(roomOf(out.requestId)).emit(out.event, out.data);
  }
}
