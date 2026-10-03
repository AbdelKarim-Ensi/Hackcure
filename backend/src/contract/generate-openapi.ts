// AJOUT : T3 - génère docs/openapi.json (à la racine du dépôt) sans base de données ni Redis.
// Usage : npm run openapi:generate   (depuis backend/)
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { ApiContractModule } from '../api-contract.module';
import { createOpenApiDocument } from '../swagger';

async function main(): Promise<void> {
  const app = await NestFactory.create(ApiContractModule, { logger: ['error'] });
  await app.init();

  const document = createOpenApiDocument(app);
  const outFile = resolve(process.cwd(), process.env.OPENAPI_OUT ?? '../docs/openapi.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(document, null, 2) + '\n', 'utf8');

  await app.close();
  console.log(`openapi.json généré : ${outFile} (${Object.keys(document.paths).length} chemins)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
