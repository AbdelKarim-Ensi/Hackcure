import { NestFactory } from '@nestjs/core';
// AJOUT : T3 - ObserveInstrument n'est pas exporté par app.module (erreur TS2305), import d'origine conservé en commentaire
// import { AppModule, ObserveInstrument } from './app.module';
import { AppModule } from './app.module';
// AJOUT : T3 - validation globale et Swagger
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './swagger';
// AJOUT T5.3 : adaptateur Socket.IO sur Redis
import type Redis from 'ioredis';
import { RedisIoAdapter } from './live/redis-io.adapter';
import { REDIS } from './redis/redis.module';

async function bootstrap() {
  // AJOUT : T3 - option instrument désactivée tant que @nestjs/observe n'est pas branché dans app.module
  // const app = await NestFactory.create(AppModule, {
  //   instrument: ObserveInstrument,
  // });
  const app = await NestFactory.create(AppModule);
  // AJOUT : T3 - DTO validés à l'entrée, champs inconnus ignorés (whitelist), conversion des query params
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // AJOUT : T3 - CORS ouvert pour le dashboard (M4) en développement ; restreint en T7.5 via CORS_ORIGIN
  app.enableCors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true });
  // AJOUT : T3 - Swagger UI sur /docs, JSON sur /docs/json
  setupSwagger(app);
  // AJOUT T5.3 : WebSocket /live avec adaptateur Redis (doit être posé avant listen)
  const ioAdapter = new RedisIoAdapter(app);
  ioAdapter.connectToRedis(app.get<Redis>(REDIS));
  app.useWebSocketAdapter(ioAdapter);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
