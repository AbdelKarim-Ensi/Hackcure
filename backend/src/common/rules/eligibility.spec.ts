import { evaluateEligibility, type EligibilityAnswers } from './eligibility';

const clean: EligibilityAnswers = {
  age: 30,
  weightKg: 70,
  chronicDisease: false,
  onTreatment: false,
  hepatitisOrHivHistory: false,
  recentSurgery: false,
  recentTattooOrPiercing: false,
  recentTransfusion: false,
  riskAreaTravel: false,
  recentVaccination: false,
  recentFeverOrInfection: false,
  pregnantOrBreastfeeding: false,
};
const NOW = new Date('2026-10-04T10:00:00Z');

describe('evaluateEligibility (règles F1 provisoires)', () => {
  it('aucune contre-indication : eligible, sans date ni motif', () => {
    expect(evaluateEligibility(clean, NOW)).toEqual({
      result: 'eligible',
      reasons: [],
    });
  });
  it('antécédent hépatite/VIH : définitif', () => {
    expect(
      evaluateEligibility({ ...clean, hepatitisOrHivHistory: true }, NOW)
        .result,
    ).toBe('definitif');
  });
  it('maladie chronique ou plus de 65 ans : définitif', () => {
    expect(
      evaluateEligibility({ ...clean, chronicDisease: true }, NOW).result,
    ).toBe('definitif');
    expect(evaluateEligibility({ ...clean, age: 66 }, NOW).result).toBe(
      'definitif',
    );
  });
  it('tatouage récent : temporaire, réévaluation à +120 jours', () => {
    expect(
      evaluateEligibility({ ...clean, recentTattooOrPiercing: true }, NOW),
    ).toMatchObject({
      result: 'temporaire',
      reevalDate: '2027-02-01',
    });
  });
  it("plusieurs reports : la date la plus lointaine l'emporte", () => {
    const r = evaluateEligibility(
      { ...clean, recentVaccination: true, recentTransfusion: true },
      NOW,
    );
    expect(r.reevalDate).toBe('2027-10-04');
  });
  it('poids < 50 kg ou moins de 18 ans : temporaire (peut évoluer)', () => {
    expect(evaluateEligibility({ ...clean, weightKg: 45 }, NOW).result).toBe(
      'temporaire',
    );
    expect(evaluateEligibility({ ...clean, age: 17 }, NOW).result).toBe(
      'temporaire',
    );
  });
  it('les motifs ne révèlent aucun détail médical', () => {
    const r = evaluateEligibility(
      { ...clean, hepatitisOrHivHistory: true },
      NOW,
    );
    expect(r.reasons.join(' ').toLowerCase()).not.toMatch(/hépatite|vih|hiv/);
  });
});
