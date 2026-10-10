import {
  Candidate,
  SCORING,
  addDays,
  canDonateOn,
  evaluateEligibility,
  isCompatible,
  nextDonationDate,
  radiusForWave,
  rankDonors,
  selectWave,
  latestDonationDate,
  iso,
} from './index';

const NOW = new Date('2026-10-04T12:00:00Z');
const base = { birthDate: '1995-06-15', weightKg: 72 };
const cand = (o: Partial<Candidate>): Candidate => ({
  donorId: 'd1',
  bloodGroup: 'O+',
  sex: 'male',
  eligibilityStatus: 'eligible',
  lastDonationDate: null,
  distanceKm: 3,
  availability: 'now',
  alertsReceived: 0,
  alertsAccepted: 0,
  showedUp: 0,
  ...o,
});
const daysAgo = (n: number) => iso(addDays(NOW, -n));

describe('Compatibilité (H1)', () => {
  it('A- peut donner à AB+', () => expect(isCompatible('A-', 'AB+')).toBe(true));
  it('AB+ ne peut pas donner à O-', () => expect(isCompatible('AB+', 'O-')).toBe(false));
  it('O- est donneur universel', () => {
    for (const g of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) expect(isCompatible('O-', g)).toBe(true);
  });
  it('exactMatchOnly exclut un groupe seulement compatible', () => {
    expect(isCompatible('O-', 'A+', true)).toBe(false);
    expect(isCompatible('A+', 'A+', true)).toBe(true);
  });
});

describe('Délai entre dons (F2)', () => {
  it("homme, dernier don il y a 60 jours : exclu aujourd'hui", () =>
    expect(canDonateOn(daysAgo(60), NOW, 'whole_blood', 'male')).toBe(false));
  it("même donneur : éligible à un événement dans 45 jours", () =>
    expect(canDonateOn(daysAgo(60), addDays(NOW, 45), 'whole_blood', 'male')).toBe(true));
  it('femme : 120 jours', () => {
    expect(canDonateOn(daysAgo(100), NOW, 'whole_blood', 'female')).toBe(false);
    expect(canDonateOn(daysAgo(120), NOW, 'whole_blood', 'female')).toBe(true);
  });
  it('jamais donné : éligible, pas de prochaine date', () => {
    expect(nextDonationDate(null)).toBeNull();
    expect(canDonateOn(null, NOW)).toBe(true);
  });
  it('sexe inconnu : délai le plus long appliqué', () =>
    expect(canDonateOn(daysAgo(100), NOW, 'whole_blood')).toBe(false));
  it('le don le plus récent (confirmé ou déclaré) l’emporte', () =>
    expect(latestDonationDate('2026-05-01', '2026-08-01')).toBe('2026-08-01'));
});

describe('Éligibilité (F1)', () => {
  it('aucun blocage : eligible', () => {
    const r = evaluateEligibility(base, NOW);
    expect(r.status).toBe('eligible');
    expect(r.firedRules).toEqual([]);
  });
  it('tatouage il y a 2 mois : temporaire, réévaluation +4 mois', () => {
    const r = evaluateEligibility({ ...base, tattooPiercingDate: '2026-08-04' }, NOW);
    expect(r.status).toBe('temporaire');
    expect(r.reevalDate).toBe('2026-12-04');
    expect(r.firedRules).toEqual(['E06']);
  });
  it('tatouage ancien (5 mois) : plus bloquant', () =>
    expect(evaluateEligibility({ ...base, tattooPiercingDate: '2026-05-04' }, NOW).status).toBe('eligible'));
  it('plusieurs blocages : la date la plus tardive', () => {
    const r = evaluateEligibility(
      { ...base, tattooPiercingDate: '2026-08-04', antibioticsEndDate: '2026-12-01' },
      NOW,
    );
    expect(r.status).toBe('temporaire');
    expect(r.reevalDate).toBe('2026-12-15');
  });
  it('antécédent VIH/hépatite + tatouage récent : definitif (priorité)', () => {
    const r = evaluateEligibility({ ...base, infectiousHistory: true, tattooPiercingDate: '2026-08-04' }, NOW);
    expect(r.status).toBe('definitif');
    expect(r.reevalDate).toBeNull();
  });
  it('maladie chronique : en_attente (avis médical)', () => {
    const r = evaluateEligibility({ ...base, chronicDisease: true }, NOW);
    expect(r.status).toBe('en_attente');
    expect(r.requiresMedicalReview).toBe(true);
  });
  it('mineur : temporaire jusqu’au 18e anniversaire', () => {
    const r = evaluateEligibility({ ...base, birthDate: '2009-01-10' }, NOW);
    expect(r.status).toBe('temporaire');
    expect(r.reevalDate).toBe('2027-01-10');
  });
  it('poids < 50 kg : temporaire sans date', () => {
    const r = evaluateEligibility({ ...base, weightKg: 47 }, NOW);
    expect(r.status).toBe('temporaire');
    expect(r.reevalDate).toBeNull();
  });
  it('plus de 65 ans : en_attente', () =>
    expect(evaluateEligibility({ ...base, birthDate: '1955-01-01' }, NOW).status).toBe('en_attente'));
});

describe('Filtres, score et vagues', () => {
  const req = { bloodGroup: 'O+', urgency: 'normal' } as const;

  it('donneur à 12 km : hors rayon en vague 1 (10 km), retenu en vague 2 (20 km)', () => {
    const c = [cand({ distanceKm: 12 })];
    const w1 = rankDonors(req, c, radiusForWave(0), NOW);
    expect(w1.ranked).toHaveLength(0);
    expect(w1.rejected[0].reason).toBe('hors_rayon');
    expect(rankDonors(req, c, radiusForWave(1), NOW).ranked).toHaveLength(1);
  });
  it('rayon plafonné à 30 km', () => expect(radiusForWave(5)).toBe(30));
  it('nouveau donneur : P_réponse = 0,30', () => {
    const { ranked } = rankDonors(req, [cand({})], 10, NOW);
    expect(ranked[0].components.prob).toBeCloseTo(0.3, 5);
  });
  it('exactMatchOnly : donneur compatible mais non identique exclu', () => {
    const { rejected } = rankDonors({ bloodGroup: 'A+', urgency: 'normal', exactMatchOnly: true }, [cand({ bloodGroup: 'O-' })], 10, NOW);
    expect(rejected[0].reason).toBe('incompatible');
  });
  it('donneur déjà alerté pour la demande : exclu', () => {
    const { rejected } = rankDonors(req, [cand({ alreadyAlertedForRequest: true })], 10, NOW);
    expect(rejected[0].reason).toBe('deja_alerte');
  });
  it('quota hebdomadaire atteint : exclu', () => {
    const { rejected } = rankDonors(req, [cand({ urgentAlertsThisWeek: 3 })], 10, NOW);
    expect(rejected[0].reason).toBe('quota_hebdo');
  });
  it('délai entre dons non écoulé : exclu', () => {
    const { rejected } = rankDonors(req, [cand({ lastDonationDate: daysAgo(30) })], 10, NOW);
    expect(rejected[0].reason).toBe('delai_entre_dons');
  });
  it('statut non éligible : exclu', () => {
    const { rejected } = rankDonors(req, [cand({ eligibilityStatus: 'temporaire' })], 10, NOW);
    expect(rejected[0].reason).toBe('non_eligible');
  });
  it('classement : plus proche et plus fiable en premier, avec explication', () => {
    const { ranked } = rankDonors(
      req,
      [
        cand({ donorId: 'far', distanceKm: 9, alertsReceived: 5, alertsAccepted: 1, showedUp: 1 }),
        cand({ donorId: 'best', distanceKm: 1, alertsReceived: 5, alertsAccepted: 4, showedUp: 4 }),
      ],
      10,
      NOW,
    );
    expect(ranked.map((r) => r.donorId)).toEqual(['best', 'far']);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].reasons.length).toBeGreaterThan(2);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
  it('donneur universel O- ménagé sur une demande non O-', () => {
    const { ranked } = rankDonors(
      { bloodGroup: 'A+', urgency: 'normal' },
      [cand({ donorId: 'oneg', bloodGroup: 'O-' }), cand({ donorId: 'aplus', bloodGroup: 'A+' })],
      10,
      NOW,
    );
    expect(ranked[0].donorId).toBe('aplus');
  });
  it('vague : s’arrête quand la couverture attendue atteint besoin × facteur', () => {
    const many = Array.from({ length: 30 }, (_, i) => cand({ donorId: `d${i}`, distanceKm: 1 + i * 0.1 }));
    const { ranked } = rankDonors(req, many, 10, NOW);
    const w = selectWave(ranked, 2, 'normal');
    expect(w.expectedCoverage).toBeGreaterThanOrEqual(w.target);
    expect(w.donorIds.length).toBeLessThan(30);
    expect(selectWave(ranked, 0, 'normal').donorIds).toEqual([]);
  });
  it('les poids de score somment à 1', () => {
    for (const w of Object.values(SCORING.weights)) {
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
  });
});
