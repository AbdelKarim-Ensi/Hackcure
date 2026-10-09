import {
  ELIGIBILITY_RULES,
  QUESTIONNAIRE,
  evaluateEligibility,
  isQuestionVisible,
  validateAnswers,
} from './index';

const NOW = new Date('2026-10-04T12:00:00Z');
const minimal = {
  birthDate: '1995-06-15',
  weightKg: 72,
  feverInfectionRecent: false,
  infectiousHistory: false,
  injectedDrugUseEver: false,
  chronicDisease: false,
  regularMedication: false,
};
const ARABIC = /[\u0600-\u06FF]/;

describe('Schéma du questionnaire', () => {
  it('chaque règle F1 (sauf E03 délégué à F2) a sa question', () => {
    const ids = QUESTIONNAIRE.questions.map((q) => q.id);
    for (const r of ELIGIBILITY_RULES) {
      if (r.id === 'E01b') continue; // même question que E01 (date de naissance)
      expect(ids).toContain(r.id);
    }
  });
  it('identifiants uniques', () => {
    const ids = QUESTIONNAIRE.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('tous les textes existent en français et en arabe', () => {
    for (const q of QUESTIONNAIRE.questions) {
      expect(q.label.fr.length).toBeGreaterThan(5);
      expect(ARABIC.test(q.label.ar)).toBe(true);
      if (q.help) expect(ARABIC.test(q.help.ar)).toBe(true);
    }
    expect(ARABIC.test(QUESTIONNAIRE.intro.ar)).toBe(true);
    expect(ARABIC.test(QUESTIONNAIRE.sensitiveNotice.ar)).toBe(true);
  });
  it('aucun seuil chiffré dans les textes (les durées vivent dans les règles)', () => {
    for (const q of QUESTIONNAIRE.questions) {
      expect(`${q.label.fr} ${q.help?.fr ?? ''}`).not.toMatch(/\b\d+\s*(mois|jours|kg)\b/i);
    }
  });
});

describe('Validation des réponses', () => {
  it('réponses minimales valides (homme)', () => {
    const r = validateAnswers(minimal, { sex: 'homme' }, NOW);
    expect(r.ok).toBe(true);
  });
  it('champs obligatoires manquants', () => {
    const r = validateAnswers({ weightKg: 70 }, { sex: 'homme' }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toContain('birthDate');
  });
  it('grossesse ignorée pour un homme, obligatoire pour une femme', () => {
    expect(validateAnswers({ ...minimal, pregnant: true }, { sex: 'homme' }, NOW).ok).toBe(true);
    const f = validateAnswers(minimal, { sex: 'femme' }, NOW);
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.errors.map((e) => e.field)).toEqual(['pregnant']);
    expect(validateAnswers({ ...minimal, pregnant: false }, { sex: 'femme' }, NOW).ok).toBe(true);
  });
  it('la date de guérison n’apparaît que si fièvre = oui', () => {
    const fever = QUESTIONNAIRE.questions.find((q) => q.id === 'E04b')!;
    expect(isQuestionVisible(fever, { feverInfectionRecent: false }, {})).toBe(false);
    expect(isQuestionVisible(fever, { feverInfectionRecent: true }, {})).toBe(true);
  });
  it('poids hors limites et type invalide', () => {
    const a = validateAnswers({ ...minimal, weightKg: 5 }, { sex: 'homme' }, NOW);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors[0].code).toBe('out_of_range');
    const b = validateAnswers({ ...minimal, weightKg: '72' }, { sex: 'homme' }, NOW);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.errors[0].code).toBe('invalid_type');
  });
  it('dates : format invalide, future interdite, future autorisée pour la fin des antibiotiques', () => {
    const bad = validateAnswers({ ...minimal, tattooPiercingDate: '2026-13-45' }, { sex: 'homme' }, NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].code).toBe('invalid_date');
    const future = validateAnswers({ ...minimal, tattooPiercingDate: '2027-01-01' }, { sex: 'homme' }, NOW);
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.errors[0].code).toBe('future_date');
    expect(validateAnswers({ ...minimal, antibioticsEndDate: '2026-10-10' }, { sex: 'homme' }, NOW).ok).toBe(true);
  });
  it('de bout en bout : réponses validées -> évaluation F1', () => {
    const r = validateAnswers({ ...minimal, tattooPiercingDate: '2026-08-04' }, { sex: 'homme' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const res = evaluateEligibility(r.answers, NOW);
      expect(res.status).toBe('temporaire');
      expect(res.reevalDate).toBe('2026-12-04');
    }
  });
  it('antécédent infectieux : definitif', () => {
    const r = validateAnswers({ ...minimal, infectiousHistory: true }, { sex: 'homme' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(evaluateEligibility(r.answers, NOW).status).toBe('definitif');
  });
});
