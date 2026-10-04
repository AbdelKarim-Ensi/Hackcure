import { MIN_INTERVAL_DAYS } from './config.js';
import { addDays, toDate } from './dates.js';
import { DonationType, Sex } from './types.js';

/** Si le sexe est inconnu, on applique le délai le plus long (prudence). */
export function minIntervalDays(type: DonationType, sex?: Sex): number {
  const row = MIN_INTERVAL_DAYS[type];
  return sex ? row[sex] : Math.max(row.male, row.female);
}

/** Date du prochain don possible, ou null si le donneur n'a jamais donné. */
export function nextDonationDate(
  lastDonationDate: string | Date | null | undefined,
  type: DonationType = 'whole_blood',
  sex?: Sex,
): Date | null {
  if (!lastDonationDate) return null;
  return addDays(toDate(lastDonationDate), minIntervalDays(type, sex));
}

/** Le donneur peut-il donner à `onDate` ? (utiliser la date de l'événement pour une collecte CRT, F2.3) */
export function canDonateOn(
  lastDonationDate: string | Date | null | undefined,
  onDate: string | Date,
  type: DonationType = 'whole_blood',
  sex?: Sex,
): boolean {
  const next = nextDonationDate(lastDonationDate, type, sex);
  return next === null || toDate(onDate).getTime() >= next.getTime();
}

/** Combine le dernier don confirmé et le dernier don déclaré : la date la plus récente l'emporte. */
export function latestDonationDate(
  confirmed?: string | null,
  selfDeclared?: string | null,
): string | null {
  const dates = [confirmed, selfDeclared].filter((d): d is string => !!d);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (toDate(a).getTime() >= toDate(b).getTime() ? a : b));
}
