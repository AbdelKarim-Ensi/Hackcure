import { DataSource } from 'typeorm';
import { DonationSource, EligibilityStatus, NotificationStatus, NotificationType, ResponseType } from '../database/enums';
import { Donation } from '../database/entities/health.entities';
import { Donor, Institution } from '../database/entities/identity.entities';
import { AppNotification } from '../database/entities/ops.entities';
import { BloodRequest, RequestResponse } from '../database/entities/requests.entities';
import {
  BloodGroup as RulesBloodGroup,
  COMPATIBILITY,
  Candidate,
  isCompatible,
  toDateString,
  toRulesAvailability,
  toRulesSex,
} from '../rules';

interface DonorRow {
  donorId: string;
  bloodGroup: string;
  sex: string | null;
  lastDonationDate: unknown;
  maxRadiusKm: number | string;
  available: boolean;
  distanceKm: number | string;
}
interface CountRow {
  userId: string;
  received?: string;
  thisWeek?: string;
  forRequest?: string;
  cnt?: string;
}

const num = (v: unknown): number => (v === undefined || v === null ? 0 : Number(v));

/**
 * Construit la liste de `Candidate` pour une demande et un rayon donnés (T13).
 *
 * Préfiltrage en SQL (index spatial) : donneurs `eligible`, groupe compatible, position connue,
 * alertes activées, dans le rayon. Le reste des règles (délai entre dons, rayon propre au donneur,
 * quota, déjà alerté) est appliqué ensuite par `rankDonors` : une seule source de vérité.
 *
 * Historique d'un donneur :
 *  - alertes reçues    = notifications `urgence` non échouées
 *  - alertes acceptées = réponses `je_viens`
 *  - présences (approx.) = dons confirmés de source `urgence`
 */
export async function findCandidates(
  ds: DataSource,
  request: BloodRequest,
  radiusKm: number,
  now: Date = new Date(),
): Promise<Candidate[]> {
  const compatibleGroups = (Object.keys(COMPATIBILITY) as RulesBloodGroup[]).filter((g) =>
    isCompatible(g, request.bloodGroup as RulesBloodGroup),
  );

  const rows: DonorRow[] = await ds
    .getRepository(Donor)
    .createQueryBuilder('donor')
    .innerJoin(Institution, 'inst', 'inst.id = :instId', { instId: request.institutionId })
    .select('donor.userId', 'donorId')
    .addSelect('donor.bloodGroup', 'bloodGroup')
    .addSelect('donor.sex', 'sex')
    .addSelect('donor.lastDonationDate', 'lastDonationDate')
    .addSelect('donor.maxRadiusKm', 'maxRadiusKm')
    .addSelect('donor.available', 'available')
    .addSelect('ST_Distance(donor.position, inst.position) / 1000.0', 'distanceKm')
    .where('donor.eligibilityStatus = :elig', { elig: EligibilityStatus.Eligible })
    .andWhere('donor.bloodGroup IN (:...groups)', { groups: compatibleGroups })
    .andWhere('donor.position IS NOT NULL')
    .andWhere('inst.position IS NOT NULL')
    .andWhere('ST_DWithin(donor.position, inst.position, :meters)', { meters: radiusKm * 1000 })
    .andWhere("COALESCE((donor.notifPrefs ->> 'alertsEnabled')::boolean, true) = true")
    .getRawMany<DonorRow>();

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.donorId);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [notifs, accepted, showed] = await Promise.all([
    ds
      .getRepository(AppNotification)
      .createQueryBuilder('n')
      .select('n.userId', 'userId')
      .addSelect('COUNT(*)', 'received')
      .addSelect('COUNT(*) FILTER (WHERE n.createdAt >= :weekAgo)', 'thisWeek')
      .addSelect('COUNT(*) FILTER (WHERE n.requestId = :requestId)', 'forRequest')
      .where('n.userId IN (:...ids)', { ids })
      .andWhere('n.type = :type', { type: NotificationType.Urgence })
      .andWhere('n.status != :failed', { failed: NotificationStatus.Echec })
      .setParameters({ weekAgo, requestId: request.id })
      .groupBy('n.userId')
      .getRawMany<CountRow>(),
    ds
      .getRepository(RequestResponse)
      .createQueryBuilder('r')
      .select('r.donorId', 'userId')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.donorId IN (:...ids)', { ids })
      .andWhere('r.response = :resp', { resp: ResponseType.JeViens })
      .groupBy('r.donorId')
      .getRawMany<CountRow>(),
    ds
      .getRepository(Donation)
      .createQueryBuilder('d')
      .select('d.donorId', 'userId')
      .addSelect('COUNT(*)', 'cnt')
      .where('d.donorId IN (:...ids)', { ids })
      .andWhere('d.source = :src', { src: DonationSource.Urgence })
      .groupBy('d.donorId')
      .getRawMany<CountRow>(),
  ]);

  const byUser = <T extends CountRow>(list: T[]) => new Map(list.map((r) => [r.userId, r]));
  const nMap = byUser(notifs);
  const aMap = byUser(accepted);
  const sMap = byUser(showed);

  return rows.map((r): Candidate => {
    const n = nMap.get(r.donorId);
    return {
      donorId: r.donorId,
      bloodGroup: r.bloodGroup as RulesBloodGroup,
      sex: toRulesSex(r.sex),
      eligibilityStatus: 'eligible',
      lastDonationDate: toDateString(r.lastDonationDate),
      distanceKm: Number(r.distanceKm),
      maxRadiusKm: Number(r.maxRadiusKm),
      availability: toRulesAvailability(r.available),
      alertsReceived: num(n?.received),
      alertsAccepted: num(aMap.get(r.donorId)?.cnt),
      showedUp: num(sMap.get(r.donorId)?.cnt),
      alreadyAlertedForRequest: num(n?.forRequest) > 0,
      urgentAlertsThisWeek: num(n?.thisWeek),
    };
  });
}
