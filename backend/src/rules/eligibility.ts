import { addDays, addMonths, ageOn, iso, toDate } from './dates.js';
import {
  EligibilityAnswers,
  EligibilityResult,
  RuleOutcome,
} from './types.js';

interface Hit {
  /** Date de réévaluation (null = le donneur doit redéclarer). */
  reeval?: Date | null;
}

interface Rule {
  id: string;
  outcome: RuleOutcome;
  /** true tant que la valeur n'est pas confirmée par le CNTS / un professionnel de santé. */
  toValidate: boolean;
  test: (a: EligibilityAnswers, now: Date) => Hit | null;
}

/** Règle « une date + une durée » : bloquante tant que now < date + durée. */
const dateRule = (
  id: string,
  field: keyof EligibilityAnswers,
  period: { months?: number; days?: number },
): Rule => ({
  id,
  outcome: 'TEMP_DEFERRED',
  toValidate: true,
  test: (a, now) => {
    const raw = a[field] as string | undefined;
    if (!raw) return null;
    const start = toDate(raw);
    const reeval = period.months ? addMonths(start, period.months) : addDays(start, period.days ?? 0);
    return now.getTime() < reeval.getTime() ? { reeval } : null;
  },
});

const flagRule = (
  id: string,
  field: keyof EligibilityAnswers,
  outcome: RuleOutcome,
): Rule => ({
  id,
  outcome,
  toValidate: true,
  test: (a) => (a[field] === true ? {} : null),
});

/** Catalogue des règles F1 (indicatif, à valider). E03 (délai entre dons) est géré par interval.ts. */
export const ELIGIBILITY_RULES: Rule[] = [
  {
    id: 'E01',
    outcome: 'TEMP_DEFERRED',
    toValidate: true,
    test: (a, now) => {
      const birth = toDate(a.birthDate);
      return ageOn(birth, now) < 18 ? { reeval: addMonths(birth, 18 * 12) } : null;
    },
  },
  {
    id: 'E01b',
    outcome: 'MEDICAL_REVIEW',
    toValidate: true,
    test: (a, now) => (ageOn(toDate(a.birthDate), now) > 65 ? {} : null),
  },
  {
    id: 'E02',
    outcome: 'TEMP_DEFERRED',
    toValidate: true,
    test: (a) => (a.weightKg < 50 ? { reeval: null } : null),
  },
  {
    id: 'E04',
    outcome: 'TEMP_DEFERRED',
    toValidate: true,
    test: (a, now) => {
      if (!a.feverInfectionRecent) return null;
      const base = a.feverRecoveryDate ? toDate(a.feverRecoveryDate) : now;
      const reeval = addDays(base, 14);
      return now.getTime() < reeval.getTime() ? { reeval } : null;
    },
  },
  dateRule('E05', 'antibioticsEndDate', { days: 14 }),
  dateRule('E06', 'tattooPiercingDate', { months: 4 }),
  dateRule('E07', 'surgeryDate', { months: 6 }),
  dateRule('E08', 'transfusionReceivedDate', { months: 4 }),
  {
    id: 'E09',
    outcome: 'TEMP_DEFERRED',
    toValidate: true,
    test: (a, now) => {
      if (a.deliveryDate) {
        const reeval = addMonths(toDate(a.deliveryDate), 6);
        if (now.getTime() < reeval.getTime()) return { reeval };
      }
      return a.pregnant ? { reeval: null } : null;
    },
  },
  dateRule('E10', 'vaccinationDate', { months: 1 }),
  dateRule('E11', 'malariaZoneReturnDate', { months: 6 }),
  flagRule('E12', 'infectiousHistory', 'PERMANENT'),
  flagRule('E13', 'injectedDrugUseEver', 'PERMANENT'),
  flagRule('E14', 'chronicDisease', 'MEDICAL_REVIEW'),
  flagRule('E15', 'regularMedication', 'MEDICAL_REVIEW'),
];

/**
 * F1 : évalue le formulaire d'éligibilité. Fonction pure et déterministe.
 * Priorité : PERMANENT > MEDICAL_REVIEW > TEMP_DEFERRED > ELIGIBLE.
 * Plusieurs blocages temporaires : la date de réévaluation retenue est la plus tardive.
 * La décision finale reste confirmée par le personnel médical.
 */
export function evaluateEligibility(
  answers: EligibilityAnswers,
  now: Date = new Date(),
): EligibilityResult {
  const hits = ELIGIBILITY_RULES.map((rule) => ({ rule, hit: rule.test(answers, now) })).filter(
    (x): x is { rule: Rule; hit: Hit } => x.hit !== null,
  );
  const firedRules = hits.map((h) => h.rule.id);

  const latestReeval = hits
    .map((h) => h.hit.reeval)
    .filter((d): d is Date => d instanceof Date)
    .reduce<Date | null>((acc, d) => (acc === null || d.getTime() > acc.getTime() ? d : acc), null);
  const reevalDate = latestReeval ? iso(latestReeval) : null;

  const has = (o: RuleOutcome) => hits.some((h) => h.rule.outcome === o);

  if (has('PERMANENT')) {
    return { status: 'definitif', reevalDate: null, firedRules, requiresMedicalReview: false };
  }
  if (has('MEDICAL_REVIEW')) {
    return { status: 'en_attente', reevalDate, firedRules, requiresMedicalReview: true };
  }
  if (has('TEMP_DEFERRED')) {
    return { status: 'temporaire', reevalDate, firedRules, requiresMedicalReview: false };
  }
  return { status: 'eligible', reevalDate: null, firedRules, requiresMedicalReview: false };
}
