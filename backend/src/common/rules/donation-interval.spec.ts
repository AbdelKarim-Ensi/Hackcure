import { addDays, computeNextDonationDate, intervalDays, isValidIsoDate, todayIso } from './donation-interval';

describe('donation-interval (F2 provisoire)', () => {
  it('délais par type de don', () => {
    expect(intervalDays('sang_total')).toBe(90);
    expect(intervalDays('plaquettes')).toBe(14);
    expect(intervalDays('plasma')).toBe(14);
  });

  it('type inconnu : erreur', () => {
    expect(() => intervalDays('autre')).toThrow('Type de don inconnu');
  });

  it('addDays : passage de mois, d\'année et année bissextile', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('sang total : 90 jours (exemple du contrat v1)', () => {
    expect(computeNextDonationDate('2026-06-12', 'sang_total')).toBe('2026-09-10');
    expect(computeNextDonationDate('2026-10-03', 'sang_total')).toBe('2027-01-01');
  });

  it('plaquettes : 14 jours', () => {
    expect(computeNextDonationDate('2026-10-03', 'plaquettes')).toBe('2026-10-17');
  });

  it('todayIso : date UTC', () => {
    expect(todayIso(new Date('2026-10-04T23:30:00.000Z'))).toBe('2026-10-04');
  });

  it('isValidIsoDate : refuse les jours inexistants et les formats libres', () => {
    expect(isValidIsoDate('2026-10-03')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('03/10/2026')).toBe(false);
  });
});
