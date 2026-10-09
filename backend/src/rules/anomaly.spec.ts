import { DraftRequest, PastRequest, assessRequest } from './index';

const NOW = new Date('2026-10-04T12:00:00Z');
const minAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const inHours = (n: number) => new Date(NOW.getTime() + n * 3600_000);

const draft = (o: Partial<DraftRequest> = {}): DraftRequest => ({
  institutionId: 'h1',
  bloodGroup: 'O-',
  quantity: 2,
  urgency: 'urgente',
  deadline: inHours(4),
  ...o,
});
const past = (o: Partial<PastRequest> = {}): PastRequest => ({
  bloodGroup: 'A+',
  quantity: 2,
  createdAt: minAgo(600),
  status: 'cloturee',
  ...o,
});
const normalHistory = [past(), past({ quantity: 3 }), past({ quantity: 2 })];
const codes = (a: ReturnType<typeof assessRequest>) => a.flags.map((f) => f.code);

describe('Détection d’anomalies (T14)', () => {
  it('demande normale : score 0, ok', () => {
    const a = assessRequest(draft(), normalHistory, NOW);
    expect(a.score).toBe(0);
    expect(a.level).toBe('ok');
    expect(a.flags).toEqual([]);
    expect(a.scoreForDb).toBe('0.000');
  });

  it('échéance dépassée : reject', () => {
    const a = assessRequest(draft({ deadline: minAgo(5) }), normalHistory, NOW);
    expect(a.level).toBe('reject');
    expect(codes(a)).toEqual(['DEADLINE_PASSED']);
  });

  it('doublon exact (même groupe, même quantité, 10 min) : review', () => {
    const a = assessRequest(draft(), [...normalHistory, past({ bloodGroup: 'O-', quantity: 2, createdAt: minAgo(10), status: 'active' })], NOW);
    expect(a.level).toBe('review');
    expect(codes(a)).toContain('DUPLICATE_ACTIVE');
    expect(a.score).toBeCloseTo(0.85, 3);
  });

  it('même groupe mais quantité différente : warn seulement', () => {
    const a = assessRequest(draft({ quantity: 3 }), [...normalHistory, past({ bloodGroup: 'O-', quantity: 2, createdAt: minAgo(10), status: 'active' })], NOW);
    expect(a.level).toBe('warn');
  });

  it('ancienne demande clôturée du même groupe : pas un doublon', () => {
    const a = assessRequest(draft(), [...normalHistory, past({ bloodGroup: 'O-', createdAt: minAgo(10), status: 'cloturee' })], NOW);
    expect(codes(a)).not.toContain('DUPLICATE_ACTIVE');
  });

  it('doublon hors fenêtre (45 min) : ignoré', () => {
    const a = assessRequest(draft(), [...normalHistory, past({ bloodGroup: 'O-', createdAt: minAgo(45), status: 'active' })], NOW);
    expect(codes(a)).not.toContain('DUPLICATE_ACTIVE');
  });

  it('rafale : 4e demande en moins d’une heure', () => {
    const recent = [10, 20, 30].map((m) => past({ createdAt: minAgo(m), bloodGroup: 'B+' }));
    const a = assessRequest(draft(), [...normalHistory, ...recent], NOW);
    expect(codes(a)).toContain('BURST');
    expect(a.score).toBeCloseTo(0.4, 3);
  });

  it('quantité très élevée (40) : review', () => {
    const a = assessRequest(draft({ quantity: 40 }), normalHistory, NOW);
    expect(codes(a)).toContain('QUANTITY_ABSOLUTE');
    expect(a.level).toBe('review');
  });

  it('quantité 20 pour une institution qui demande habituellement 15 : warn seulement', () => {
    const big = [past({ quantity: 14 }), past({ quantity: 15 }), past({ quantity: 16 })];
    const a = assessRequest(draft({ quantity: 20 }), big, NOW);
    expect(codes(a)).toEqual(['QUANTITY_ABSOLUTE']);
    expect(a.level).toBe('warn');
  });

  it('quantité 20 pour une institution qui demande habituellement 2 : review (élevée ET aberrante)', () => {
    const a = assessRequest(draft({ quantity: 20 }), normalHistory, NOW);
    expect(codes(a)).toEqual(['QUANTITY_ABSOLUTE', 'QUANTITY_OUTLIER']);
    expect(a.level).toBe('review');
  });

  it('valeur aberrante vs médiane de l’institution (10 vs 2)', () => {
    const a = assessRequest(draft({ quantity: 10 }), normalHistory, NOW);
    expect(codes(a)).toContain('QUANTITY_OUTLIER');
  });

  it('pas assez d’historique : pas de test d’aberrance', () => {
    const a = assessRequest(draft({ quantity: 10 }), [past()], NOW);
    expect(codes(a)).not.toContain('QUANTITY_OUTLIER');
  });

  it('critique avec échéance à 72 h : incohérent', () => {
    const a = assessRequest(draft({ urgency: 'critique', deadline: inHours(72) }), normalHistory, NOW);
    expect(codes(a)).toContain('URGENCY_DEADLINE_MISMATCH');
  });

  it('« normale » avec échéance à 10 min : incohérent', () => {
    const a = assessRequest(draft({ urgency: 'normale', deadline: new Date(NOW.getTime() + 10 * 60_000) }), normalHistory, NOW);
    expect(codes(a)).toContain('URGENCY_DEADLINE_MISMATCH');
  });

  it('nouvelle institution avec gros volume', () => {
    const a = assessRequest(draft({ quantity: 9 }), [], NOW);
    expect(codes(a)).toContain('NEW_INSTITUTION_LARGE');
    expect(a.level).toBe('warn');
  });

  it('nouvelle institution, petite demande : ok', () =>
    expect(assessRequest(draft({ quantity: 2 }), [], NOW).level).toBe('ok'));

  it('signaux combinés : le score augmente (OU bruité) et reste ≤ 1', () => {
    const hist = [...normalHistory, past({ bloodGroup: 'O-', quantity: 12, createdAt: minAgo(5), status: 'active' })];
    const a = assessRequest(draft({ quantity: 12, urgency: 'critique', deadline: inHours(100) }), hist, NOW);
    expect(a.score).toBeGreaterThan(0.85);
    expect(a.score).toBeLessThanOrEqual(1);
    expect(a.level).toBe('review');
  });

  it('chaque signal est expliqué en français', () => {
    const a = assessRequest(draft({ quantity: 40 }), normalHistory, NOW);
    for (const f of a.flags) expect(f.message.length).toBeGreaterThan(10);
  });
});
