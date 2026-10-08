// AJOUT : T7.4 droit à l'effacement : anonymisation transactionnelle (pas de DELETE, pour garder dons, réponses, inscriptions)
import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DonorErasureService {
  constructor(private readonly dataSource: DataSource) {}

  async erase(userId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const rows = await m.query('SELECT user_id FROM donors WHERE user_id = $1 FOR UPDATE', [userId]);
      if (!rows.length) throw new NotFoundException('Profil donneur introuvable');

      // Données de santé et notifications : supprimées
      await m.query('DELETE FROM eligibility_forms WHERE donor_id = $1', [userId]);
      await m.query('DELETE FROM notifications WHERE user_id = $1', [userId]);

      // Profil donneur : position, zone, sexe, consentement effacés, plus d'alertes
      await m.query(
        `UPDATE donors
            SET position = NULL, zone = NULL, sex = NULL, available = false, consent_at = NULL,
                notif_prefs = '{"quietHours": null, "alertsEnabled": false}'::jsonb
          WHERE user_id = $1`,
        [userId],
      );

      // Compte : identité remplacée (phone NOT NULL UNIQUE, varchar(20) => 'del-' + 16 car.), connexion impossible
      await m.query(
        `UPDATE users
            SET phone = 'del-' || substr(replace(id::text, '-', ''), 1, 16),
                full_name = NULL, fcm_token = NULL, phone_verified = false,
                password_hash = $2, status = 'suspendu'
          WHERE id = $1`,
        [userId, randomBytes(32).toString('hex')],
      );
    });
  }
}
