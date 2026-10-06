// AJOUT T5.3 : adaptateur Socket.IO sur Redis (rooms partagées entre instances) + CORS aligné sur l'HTTP.
// Les types viennent de la classe de base : npm installe un socket.io imbriqué sous @nestjs/platform-socket.io,
// importer ServerOptions depuis 'socket.io' donnerait deux types incompatibles (TS2416).
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

type CreateOptions = Parameters<IoAdapter['createIOServer']>[1];
type IoServer = ReturnType<IoAdapter['createIOServer']>;

export class RedisIoAdapter extends IoAdapter {
  // Nom distinct : IoAdapter déclare déjà un `logger` (TS2415 si on le redéclare en private).
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  connectToRedis(redis: Redis): void {
    const pub = redis.duplicate();
    const sub = redis.duplicate();
    for (const client of [pub, sub]) {
      client.on('error', (e: Error) => this.redisLogger.warn(`Redis (adaptateur Socket.IO) : ${e.message}`));
    }
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: CreateOptions): IoServer {
    const origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;
    const server = super.createIOServer(port, { ...options, cors: { origin } } as CreateOptions) as IoServer;
    if (this.adapterConstructor) {
      (server as unknown as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}
