/**
 * T14 : détection d'anomalies sur les demandes de sang (fonction pure, déterministe, explicable).
 *
 * Chaque signal produit un poids dans [0, 1]. Le score final combine les signaux par
 * « OU bruité » : score = 1 − Π(1 − poids). Un seul signal fort suffit à alerter,
 * plusieurs signaux faibles se renforcent.
 *
 * Résultat -> `BloodRequest.anomalyScore` (numeric 4,3) et décision :
 *   ok / warn  -> la demande est activée (warn : à surveiller sur le tableau de bord)
 *   review     -> statut `en_revue` : validation manuelle avant toute alerte aux donneurs
 *   reject     -> demande invalide, refusée (HTTP 422)
 *
 * ⚠ Les seuils ci-dessous sont des valeurs de départ à ajuster avec un hôpital partenaire.
 */

export type UrgencyName = 'normale' | 'urgente' | 'critique';

export interface DraftRequest {
  institutionId: string;
  bloodGroup: string;
  quantity: number;
  urgency: UrgencyName;
  deadline: Date;
}

/** Demande passée de la même institution (30 derniers jours). */
export interface PastRequest {
  bloodGroup: string;
  quantity: number;
  createdAt: Date;
  /** Valeurs de `RequestStatus` : en_revue, active, couverte, cloturee, expiree. */
  status: string;
}

export type AnomalyLevel = 'ok' | 'warn' | 'review' | 'reject';

export type AnomalyCode =
  | 'DEADLINE_PASSED'
  | 'DUPLICATE_ACTIVE'
  | 'BURST'
  | 'QUANTITY_ABSOLUTE'
  | 'QUANTITY_OUTLIER'
  | 'URGENCY_DEADLINE_MISMATCH'
  | 'NEW_INSTITUTION_LARGE';

export interface AnomalyFlag {
  code: AnomalyCode;
  weight: number;
  /** Explication en français pour le relecteur (tableau de bord / journal d'audit). */
  message: string;
}

export interface AnomalyAssessment {
  score: number;
  /** Valeur prête pour la colonne numeric(4,3). */
  scoreForDb: string;
  level: AnomalyLevel;
  flags: AnomalyFlag[];
}

export const ANOMALY = {
  thresholds: { warn: 0.35, review: 0.6 },
  duplicate: { windowMinutes: 30, weightSameGroup: 0.5, weightSameGroupAndQuantity: 0.85 },
  burst: { windowMinutes: 60, countThreshold: 4, baseWeight: 0.4, perExtra: 0.1, maxWeight: 0.8 },
  quantity: {
    warnAbove: 15, warnWeight: 0.5,
    criticalAbove: 30, criticalWeight: 0.9,
    outlierRatio: 3, outlierMinUnits: 6, outlierMinHistory: 3, outlierBase: 0.3, outlierPerRatio: 0.1, outlierMax: 0.7,
  },
  urgency: { criticalMaxHours: 48, criticalWeight: 0.3, normalMinMinutes: 30, normalWeight: 0.2 },
  newInstitution: { minUnits: 8, weight: 0.35 },
  activeStatuses: ['active', 'en_revue'],
} as const;

const MIN = 60_000;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function assessRequest(
  draft: DraftRequest,
  history: PastRequest[],
  now: Date = new Date(),
): AnomalyAssessment {
  const flags: AnomalyFlag[] = [];
  const add = (code: AnomalyCode, weight: number, message: string) =>
    flags.push({ code, weight: round3(Math.min(1, weight)), message });

  // Demande invalide : refusée d'emblée.
  if (draft.deadline.getTime() <= now.getTime()) {
    add('DEADLINE_PASSED', 1, "L'échéance de la demande est déjà dépassée.");
    return { score: 1, scoreForDb: '1.000', level: 'reject', flags };
  }

  const ageMin = (h: PastRequest) => (now.getTime() - h.createdAt.getTime()) / MIN;

  // 1. Doublon : même groupe, encore active, créée récemment.
  const d = ANOMALY.duplicate;
  const dups = history.filter(
    (h) =>
      h.bloodGroup === draft.bloodGroup &&
      (ANOMALY.activeStatuses as readonly string[]).includes(h.status) &&
      ageMin(h) <= d.windowMinutes,
  );
  if (dups.length > 0) {
    const sameQty = dups.some((h) => h.quantity === draft.quantity);
    add(
      'DUPLICATE_ACTIVE',
      sameQty ? d.weightSameGroupAndQuantity : d.weightSameGroup,
      sameQty
        ? `Demande identique (groupe ${draft.bloodGroup}, ${draft.quantity} unité(s)) déjà active il y a moins de ${d.windowMinutes} min.`
        : `Une demande active pour le groupe ${draft.bloodGroup} existe déjà (moins de ${d.windowMinutes} min).`,
    );
  }

  // 2. Rafale : trop de demandes de la même institution en peu de temps.
  const b = ANOMALY.burst;
  const recentCount = history.filter((h) => ageMin(h) <= b.windowMinutes).length + 1; // + celle-ci
  if (recentCount >= b.countThreshold) {
    add(
      'BURST',
      Math.min(b.maxWeight, b.baseWeight + b.perExtra * (recentCount - b.countThreshold)),
      `${recentCount} demandes de la même institution en moins de ${b.windowMinutes} min.`,
    );
  }

  // 3. Quantité : plausibilité absolue, puis écart à l'historique de l'institution.
  const q = ANOMALY.quantity;
  if (draft.quantity > q.criticalAbove) {
    add('QUANTITY_ABSOLUTE', q.criticalWeight, `Quantité très élevée (${draft.quantity} unités).`);
  } else if (draft.quantity > q.warnAbove) {
    add('QUANTITY_ABSOLUTE', q.warnWeight, `Quantité élevée (${draft.quantity} unités).`);
  }
  if (history.length >= q.outlierMinHistory) {
    const med = Math.max(1, median(history.map((h) => h.quantity)));
    const ratio = draft.quantity / med;
    if (ratio >= q.outlierRatio && draft.quantity >= q.outlierMinUnits) {
      add(
        'QUANTITY_OUTLIER',
        Math.min(q.outlierMax, q.outlierBase + q.outlierPerRatio * (ratio - q.outlierRatio)),
        `Quantité ${ratio.toFixed(1)} fois supérieure à la médiane habituelle de l'institution (${med}).`,
      );
    }
  }

  // 4. Cohérence urgence / échéance.
  const hoursLeft = (draft.deadline.getTime() - now.getTime()) / (60 * MIN);
  const u = ANOMALY.urgency;
  if (draft.urgency === 'critique' && hoursLeft > u.criticalMaxHours) {
    add('URGENCY_DEADLINE_MISMATCH', u.criticalWeight, `Demande critique avec une échéance lointaine (${Math.round(hoursLeft)} h).`);
  } else if (draft.urgency === 'normale' && hoursLeft * 60 < u.normalMinMinutes) {
    add('URGENCY_DEADLINE_MISMATCH', u.normalWeight, `Demande « normale » avec une échéance de moins de ${u.normalMinMinutes} min.`);
  }

  // 5. Institution sans historique qui demande beaucoup d'un coup.
  if (history.length === 0 && draft.quantity >= ANOMALY.newInstitution.minUnits) {
    add('NEW_INSTITUTION_LARGE', ANOMALY.newInstitution.weight, "Première demande de l'institution, pour un volume important.");
  }

  const score = round3(1 - flags.reduce((acc, f) => acc * (1 - f.weight), 1));
  const level: AnomalyLevel =
    score >= ANOMALY.thresholds.review ? 'review' : score >= ANOMALY.thresholds.warn ? 'warn' : 'ok';
  return { score, scoreForDb: score.toFixed(3), level, flags };
}
