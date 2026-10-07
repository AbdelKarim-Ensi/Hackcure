// AJOUT : nouveau type d'établissement pour le Croissant-Rouge (collectes de don volontaire).
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CroissantRouge1790000000001 implements MigrationInterface {
  name = 'CroissantRouge1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE institution_type ADD VALUE IF NOT EXISTS 'croissant_rouge'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL ne permet pas de retirer une valeur d'un ENUM : rien à défaire.
  }
}
