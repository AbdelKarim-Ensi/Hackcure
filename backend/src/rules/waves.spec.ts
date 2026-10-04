import {
  Candidate,
  WaveState,
  decideWaveAction,
  radiusForWave,
  rankDonors,
  toDateString,
  toRulesAvailability,
  toRulesDonationType,
  toRulesSex,
  toRulesUrgency,
} from './index';

const NOW = new Date('2026-10-04T12:00:00Z');
const min = (n: number) => new Date(NOW.getTime() + n * 60_000);

const state = (o: Partial<WaveState> = {}): WaveState => ({
  urgency: 'normal',
  unitsNeeded: 3,
  unitsConfirmed: 0,
  initialRadiusKm: 10,
  maxRadiusKm: 30,
  wavesSent: 0,
  lastWaveAt: null,
  lastWaveRadiusKm: null,
  deadline: min(240),
  ...o,
});

describe('Planificateur de vagues', () => {
  it('première vague : rayon initial', () =>
    expect(decideWaveAction(state(), NOW)).toEqual({ action: 'launch', waveNumber: 1, radiusKm: 10 }));

  it('besoin couvert : covered', () =>
    expect(decideWaveAction(state({ unitsConfirmed: 3, wavesSent: 1, lastWaveAt: min(-30) }), NOW)).toEqual({ action: 'covered' }));

  it('échéance dépassée : expired', () =>
    expect(decideWaveAction(state({ deadline: min(-1) }), NOW)).toEqual({ action: 'expired' }));

  it('délai non écoulé (normal 15 min) : wait', () => {
    const d = decideWaveAction(state({ wavesSent: 1, lastWaveAt: min(-5), lastWaveRadiusKm: 10 }), NOW);
    expect(d).toEqual({ action: 'wait', nextCheckAt: min(10) });
  });

  it('délai écoulé : vague 2 à 20 km', () =>
    expect(decideWaveAction(state({ wavesSent: 1, lastWaveAt: min(-16), lastWaveRadiusKm: 10 }), NOW)).toEqual({
      action: 'launch',
      waveNumber: 2,
      radiusKm: 20,
    }));

  it('critique : le délai n’est que de 5 min', () => {
    const s = state({ urgency: 'critical', wavesSent: 1, lastWaveAt: min(-6), lastWaveRadiusKm: 10 });
    expect(decideWaveAction(s, NOW)).toMatchObject({ action: 'launch', waveNumber: 2 });
  });

  it('vague 3 plafonnée au rayon max (30 km)', () =>
    expect(decideWaveAction(state({ wavesSent: 2, lastWaveAt: min(-20), lastWaveRadiusKm: 20 }), NOW)).toEqual({
      action: 'launch',
      waveNumber: 3,
      radiusKm: 30,
    }));

  it('dernière vague déjà au rayon max : exhausted', () =>
    expect(decideWaveAction(state({ wavesSent: 3, lastWaveAt: min(-20), lastWaveRadiusKm: 30 }), NOW)).toEqual({ action: 'exhausted' }));

  it('rayon max propre à la demande (15 km)', () => {
    expect(radiusForWave(3, 10, 15)).toBe(15);
    expect(decideWaveAction(state({ maxRadiusKm: 15, wavesSent: 1, lastWaveAt: min(-20), lastWaveRadiusKm: 10 }), NOW)).toMatchObject({ radiusKm: 15 });
  });
});

describe('Rayon maximal du donneur', () => {
  const cand = (o: Partial<Candidate>): Candidate => ({
    donorId: 'd1',
    bloodGroup: 'O+',
    sex: 'male',
    eligibilityStatus: 'eligible',
    lastDonationDate: null,
    distanceKm: 8,
    availability: 'now',
    alertsReceived: 0,
    alertsAccepted: 0,
    showedUp: 0,
    ...o,
  });
  const req = { bloodGroup: 'O+', urgency: 'normal' } as const;

  it('donneur à 8 km avec maxRadiusKm = 5 : exclu même si la vague couvre 20 km', () => {
    const { ranked, rejected } = rankDonors(req, [cand({ maxRadiusKm: 5 })], 20, NOW);
    expect(ranked).toHaveLength(0);
    expect(rejected[0].reason).toBe('hors_rayon');
  });
  it('donneur à 8 km avec maxRadiusKm = 20 : retenu', () =>
    expect(rankDonors(req, [cand({ maxRadiusKm: 20 })], 20, NOW).ranked).toHaveLength(1));
});

describe('Adaptateurs base de données -> règles', () => {
  it('urgence', () => {
    expect(toRulesUrgency('critique')).toBe('critical');
    expect(toRulesUrgency('urgente')).toBe('normal');
    expect(toRulesUrgency('normale')).toBe('normal');
  });
  it('sexe', () => {
    expect(toRulesSex('homme')).toBe('male');
    expect(toRulesSex('femme')).toBe('female');
    expect(toRulesSex(null)).toBeUndefined();
  });
  it('type de don', () => {
    expect(toRulesDonationType('sang_total')).toBe('whole_blood');
    expect(toRulesDonationType('plaquettes')).toBe('platelets');
    expect(toRulesDonationType('plasma')).toBe('plasma');
  });
  it('disponibilité', () => {
    expect(toRulesAvailability(true)).toBe('now');
    expect(toRulesAvailability(false)).toBe('none');
  });
  it('dates venant de pg', () => {
    expect(toDateString('2026-05-01')).toBe('2026-05-01');
    expect(toDateString(new Date(2026, 4, 1))).toBe('2026-05-01');
    expect(toDateString(null)).toBeNull();
  });
});
