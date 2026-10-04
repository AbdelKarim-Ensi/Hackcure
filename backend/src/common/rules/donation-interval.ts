// T4.3 : règle F2 PROVISOIRE (délai minimal entre dons).
// À remplacer par les fonctions pures de M2 (T11) une fois les valeurs validées avec le CNTS.
export const DONATION_INTERVAL_DAYS: Readonly<Record<string, number>> = {
  sang_total: 90,
  plaquettes: 14,
  plasma: 14,
};

export function intervalDays(type: string): number {
  const days = DONATION_INTERVAL_DAYS[type];
  if (days === undefined) throw new Error(`Type de don inconnu : ${type}`);
  return days;
}

/** Ajoute des jours à une date YYYY-MM-DD (calcul en UTC, sans décalage horaire). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Date à partir de laquelle un nouveau don est possible. */
export function computeNextDonationDate(donatedAt: string, type: string): string {
  return addDays(donatedAt, intervalDays(type));
}

/** Date du jour (UTC) au format YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Vrai pour un jour réel du calendrier au format YYYY-MM-DD (refuse 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
