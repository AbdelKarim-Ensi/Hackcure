// AJOUT : T3 - configuration Swagger partagée par main.ts (Swagger UI sur /docs)
// et par le script de génération de docs/openapi.json.
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import {
  AlertPayloadDto,
  WsDonorEnRouteEventDto,
  WsGaugeEventDto,
  WsWaveStartedEventDto,
} from './requests/dto/requests.dto';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Damm API')
    .setDescription(
      [
        'Plateforme intelligente de don de sang (HackCure 48 h).',
        '',
        'Contrat v1 : toute modification passe par une PR sur docs/openapi.json et est annoncée à l\'équipe.',
        'Le suivi en direct (WebSocket /live) est décrit dans docs/ws-live.md ; ses charges utiles',
        'et celle de l\'alerte FCM figurent dans les schémas WsGaugeEventDto, WsDonorEnRouteEventDto,',
        'WsWaveStartedEventDto et AlertPayloadDto.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [
      WsGaugeEventDto,
      WsDonorEnRouteEventDto,
      WsWaveStartedEventDto,
      AlertPayloadDto,
    ],
  });
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/json',
  });
}
