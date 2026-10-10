// T4.2 : règles F1 PROVISOIRES (fonctions pures, déterministes, sans LLM : R7).
// À remplacer par celles de M2 (T9 à T11) une fois les valeurs validées avec le CNTS.
// L'éligibilité finale reste confirmée par le personnel médical le jour du don (R6).
import { addDays, todayIso } from './donation-interval';

export const QUESTIONNAIRE_VERSION = 'v1';

export interface EligibilityAnswers {
  age: number;
  weightKg: number;
  chronicDisease: boolean;
  onTreatment: boolean;
  hepatitisOrHivHistory: boolean;
  recentSurgery: boolean;
  recentTattooOrPiercing: boolean;
  recentTransfusion: boolean;
  riskAreaTravel: boolean;
  recentVaccination: boolean;
  recentFeverOrInfection: boolean;
  pregnantOrBreastfeeding?: boolean;
}

export type EligibilityOutcome = 'eligible' | 'temporaire' | 'definitif';

export interface EligibilityEvaluation {
  result: EligibilityOutcome;
  /** YYYY-MM-DD, présente si result = temporaire */
  reevalDate?: string;
  /** Motifs génériques : jamais de détail médical brut. */
  reasons: string[];
}

export const ELIGIBILITY_RULES = {
  minAge: 18,
  maxAge: 65,
  minWeightKg: 50,
  /** Réévaluation après un échec d'âge minimal ou de poids (F1.6). */
  recheckDays: 180,
  deferralDays: {
    surgery: 180,
    tattoo: 120,
    transfusion: 365,
    travel: 180,
    vaccination: 28,
    fever: 14,
    treatment: 30,
    pregnancy: 365,
  },
} as const;

export function evaluateEligibility(
  a: EligibilityAnswers,
  now: Date = new Date(),
): EligibilityEvaluation {
  const r = ELIGIBILITY_RULES;
  const d = r.deferralDays;

  if (a.hepatitisOrHivHistory || a.chronicDisease || a.age > r.maxAge) {
    return {
      result: 'definitif',
      reasons: ['Votre situation ne permet pas de donner votre sang'],
    };
  }

  const waits: number[] = [];
  if (a.age < r.minAge || a.weightKg < r.minWeightKg) waits.push(r.recheckDays);
  if (a.recentSurgery) waits.push(d.surgery);
  if (a.recentTattooOrPiercing) waits.push(d.tattoo);
  if (a.recentTransfusion) waits.push(d.transfusion);
  if (a.riskAreaTravel) waits.push(d.travel);
  if (a.recentVaccination) waits.push(d.vaccination);
  if (a.recentFeverOrInfection) waits.push(d.fever);
  if (a.onTreatment) waits.push(d.treatment);
  if (a.pregnantOrBreastfeeding) waits.push(d.pregnancy);

  if (waits.length === 0) return { result: 'eligible', reasons: [] };
  return {
    result: 'temporaire',
    reevalDate: addDays(todayIso(now), Math.max(...waits)),
    reasons: ['Don reporté : une réévaluation est prévue à la date indiquée'],
  };
}
