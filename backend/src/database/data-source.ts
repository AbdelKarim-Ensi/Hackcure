import { config } from 'dotenv';
config({ path: ['.env', '../.env'] });

import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ALL_ENTITIES } from './entities';
import { Init1790000000000 } from './migrations/1790000000000-init';
import { CroissantRouge1790000000001 } from './migrations/1790000000001-croissant-rouge';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'damm',
  entities: ALL_ENTITIES,
  migrations: [Init1790000000000, CroissantRouge1790000000001], // ajouter ici chaque nouvelle migration
  namingStrategy: new SnakeNamingStrategy(),
  uuidExtension: 'pgcrypto',
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
