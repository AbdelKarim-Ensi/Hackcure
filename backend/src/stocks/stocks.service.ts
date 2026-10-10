// AJOUT : T6.6 - stocks réels par établissement et par groupe sanguin, niveaux rouge/orange/vert.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BloodGroup, StockLevel, UserRole } from '../common/enums';
import { Institution } from '../database/entities/identity.entities';
import { Stock } from '../database/entities/ops.entities';
import type { InstitutionStockDto, StockLineDto } from './stocks.controller';

const DEFAULT_THRESHOLD = 10;

/** rouge : sous le seuil ; orange : jusqu'à 1,5 fois le seuil ; vert : au-delà. */
export const levelOf = (quantity: number, threshold: number): StockLevel =>
  quantity < threshold ? StockLevel.ROUGE : quantity <= threshold * 1.5 ? StockLevel.ORANGE : StockLevel.VERT;

type Row = {
  institutionId: string;
  institutionName: string;
  lat: string | null;
  lng: string | null;
  bloodGroup: string;
  quantity: number;
  alertThreshold: number;
};

@Injectable()
export class StocksService {
  constructor(@InjectRepository(Stock) private readonly stocks: Repository<Stock>) {}

  async list(actor: AuthenticatedUser, institutionId?: string): Promise<InstitutionStockDto[]> {
    let scope = institutionId;
    if ((actor.role as string) === UserRole.HOPITAL) {
      if (!actor.institutionId) throw new ForbiddenException('Aucun établissement rattaché à ce compte');
      if (institutionId && institutionId !== actor.institutionId) {
        throw new ForbiddenException('Vous ne pouvez consulter que le stock de votre établissement');
      }
      scope = actor.institutionId;
    }

    const qb = this.stocks
      .createQueryBuilder('s')
      .innerJoin(Institution, 'i', 'i.id = s.institutionId')
      .select('s.institutionId', 'institutionId')
      .addSelect('i.name', 'institutionName')
      .addSelect('ST_Y(i.position::geometry)', 'lat')
      .addSelect('ST_X(i.position::geometry)', 'lng')
      .addSelect('s.bloodGroup', 'bloodGroup')
      .addSelect('s.quantity', 'quantity')
      .addSelect('s.alertThreshold', 'alertThreshold');
    if (scope) qb.where('s.institutionId = :scope', { scope });
    const rows = await qb.orderBy('i.name', 'ASC').getRawMany<Row>();

    const byInstitution = new Map<string, { name: string; lat: number; lng: number; lines: Map<string, Row> }>();
    for (const r of rows) {
      let inst = byInstitution.get(r.institutionId);
      if (!inst) {
        inst = {
          name: r.institutionName,
          lat: r.lat != null ? Number(r.lat) : 0,
          lng: r.lng != null ? Number(r.lng) : 0,
          lines: new Map(),
        };
        byInstitution.set(r.institutionId, inst);
      }
      inst.lines.set(r.bloodGroup, r);
    }

    return [...byInstitution.entries()].map(([id, inst]) => ({
      institutionId: id,
      institutionName: inst.name,
      position: { latitude: inst.lat, longitude: inst.lng },
      stocks: Object.values(BloodGroup).map((bloodGroup): StockLineDto => {
        const r = inst.lines.get(bloodGroup);
        const quantity = r ? Number(r.quantity) : 0;
        const alertThreshold = r ? Number(r.alertThreshold) : DEFAULT_THRESHOLD;
        return { bloodGroup, quantity, alertThreshold, level: levelOf(quantity, alertThreshold) };
      }),
    }));
  }
}
