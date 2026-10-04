// T3 : génère docs/openapi.json (à la racine du dépôt).
// T4 : les modules ont de vrais services, donc le générateur monte la même configuration que AppModule
// (ConfigModule + TypeORM + modules du contrat), sans AppController. Base et Redis doivent donc tourner.
// Usage : npm run openapi:generate   (depuis backend/)
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiContractModule } from '../api-contract.module';
import { dataSourceOptions } from '../database/data-source';
import { createOpenApiDocument } from '../swagger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ApiContractModule,
  ],
})
class OpenApiGenerationModule {}

async function main(): Promise<void> {
  const app = await NestFactory.create(OpenApiGenerationModule, {
    logger: ['error'],
  });
  await app.init();

  const document = createOpenApiDocument(app);
  const outFile = resolve(
    process.cwd(),
    process.env.OPENAPI_OUT ?? '../docs/openapi.json',
  );
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(document, null, 2) + '\n', 'utf8');

  await app.close();
  console.log(
    `openapi.json généré : ${outFile} (${Object.keys(document.paths).length} chemins)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
