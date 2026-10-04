import { SCORING, WAVES } from './config.js';
import { isCompatible } from './compatibility.js';
import { canDonateOn } from './interval.js';
import {
  BloodRequestInput,
  Candidate,
  RankedDonor,
  RejectReason,
  ScoreComponents,
  Urgency,
} from './types.js';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Filtres éliminatoires H1..H5. Un donneur rejeté n'est jamais alerté, quel que soit son score. */
export function filterCandidates(
  request: BloodRequestInput,
  candidates: Candidate[],
  radiusKm: number,
  now: Date = new Date(),
): { kept: Candidate[]; rejected: { donorId: string; reason: RejectReason }[] } {
  const kept: Candidate[] = [];
  const rejected: { donorId: string; reason: RejectReason }[] = [];
  const type = request.donationType ?? 'whole_blood';

  for (const c of candidates) {
    let reason: RejectReason | null = null;
    if (!isCompatible(c.bloodGroup, request.bloodGroup, request.exactMatchOnly)) reason = 'incompatible';
    else if (c.eligibilityStatus !== 'eligible') reason = 'non_eligible';
    else if (!canDonateOn(c.lastDonationDate, now, type, c.sex)) reason = 'delai_entre_dons';
    else if (c.distanceKm > radiusKm) reason = 'hors_rayon';
    else if (c.alreadyAlertedForRequest) reason = 'deja_alerte';
    else if ((c.urgentAlertsThisWeek ?? 0) >= WAVES.maxUrgentAlertsPerWeek) reason = 'quota_hebdo';

    if (reason) rejected.push({ donorId: c.donorId, reason });
    else kept.push(c);
  }
  return { kept, rejected };
}

export function scoreComponents(
  request: BloodRequestInput,
  c: Candidate,
  radiusKm: number,
): ScoreComponents {
  const { p0, alpha } = SCORING.probSmoothing;
  const prob = (c.alertsAccepted + alpha * p0) / (c.alertsReceived + alpha);
  const rel = (c.showedUp + 1) / (c.alertsAccepted + 2);
  const dist = clamp01(1 - c.distanceKm / radiusKm);
  const avail = SCORING.availabilityScores[c.availability];

  let match: number = SCORING.matchScores.compatible;
  if (c.bloodGroup === request.bloodGroup) match = SCORING.matchScores.exact;
  else if (c.bloodGroup === 'O-') match = SCORING.matchScores.universalDonorOnOtherGroup;

  return { prob, dist, rel, avail, match };
}

export function scoreCandidate(
  request: BloodRequestInput,
  c: Candidate,
  radiusKm: number,
): { score: number; components: ScoreComponents } {
  const comp = scoreComponents(request, c, radiusKm);
  const w = SCORING.weights[request.urgency];
  const score =
    100 * (w.prob * comp.prob + w.dist * comp.dist + w.rel * comp.rel + w.avail * comp.avail + w.match * comp.match);
  return { score: round1(score), components: comp };
}

function explain(c: Candidate, request: BloodRequestInput, comp: ScoreComponents): string[] {
  const reasons: string[] = [];
  reasons.push(c.bloodGroup === request.bloodGroup ? 'Même groupe sanguin' : 'Groupe compatible');
  reasons.push(`À ${c.distanceKm.toFixed(1).replace('.', ',')} km de l'hôpital`);
  if (c.alertsReceived > 0) reasons.push(`A accepté ${c.alertsAccepted} alertes sur ${c.alertsReceived}`);
  else reasons.push('Nouveau donneur (probabilité de réponse estimée)');
  if (comp.avail === 1) reasons.push('Disponible maintenant');
  else if (comp.avail === 0.5) reasons.push('Disponible sur son créneau habituel');
  return reasons;
}

/** Classe les candidats (déjà filtrés) par score décroissant, avec explication. */
export function rankDonors(
  request: BloodRequestInput,
  candidates: Candidate[],
  radiusKm: number,
  now: Date = new Date(),
): { ranked: RankedDonor[]; rejected: { donorId: string; reason: RejectReason }[] } {
  const { kept, rejected } = filterCandidates(request, candidates, radiusKm, now);
  const scored = kept.map((c) => {
    const { score, components } = scoreCandidate(request, c, radiusKm);
    return { c, score, components };
  });
  scored.sort((a, b) => b.score - a.score || a.c.distanceKm - b.c.distanceKm || a.c.donorId.localeCompare(b.c.donorId));

  const ranked: RankedDonor[] = scored.map((s, i) => ({
    donorId: s.c.donorId,
    score: s.score,
    rank: i + 1,
    components: s.components,
    reasons: explain(s.c, request, s.components),
    expectedYield: s.components.prob * s.components.rel,
  }));
  return { ranked, rejected };
}

/** Taille de la vague : on ajoute des donneurs jusqu'à ce que Σ(P_réponse × fiabilité) ≥ besoin × facteur de sécurité. */
export function selectWave(
  ranked: RankedDonor[],
  unitsRemaining: number,
  urgency: Urgency,
): { donorIds: string[]; expectedCoverage: number; target: number } {
  const target = Math.max(0, unitsRemaining) * WAVES.safetyFactor[urgency];
  const donorIds: string[] = [];
  let expected = 0;
  if (target > 0) {
    for (const d of ranked) {
      if (expected >= target) break;
      donorIds.push(d.donorId);
      expected += d.expectedYield;
    }
  }
  return { donorIds, expectedCoverage: Math.round(expected * 100) / 100, target };
}

/** Rayon de la vague k (k = 0 pour la première) : min(R_max, R0 + k × Δ). */
export function radiusForWave(waveIndex: number, r0: number = WAVES.radiusKm.r0Default): number {
  return Math.min(WAVES.radiusKm.rMax, r0 + waveIndex * WAVES.radiusKm.delta);
}

/** Délai avant de lancer la vague suivante si la couverture est insuffisante. */
export const waveTimeoutMinutes = (urgency: Urgency): number => WAVES.timeoutMinutes[urgency];
