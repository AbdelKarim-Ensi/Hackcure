/** Utilitaires de dates en UTC (aucune dépendance). */
export const toDate = (d: string | Date): Date =>
  d instanceof Date ? d : new Date(d.length === 10 ? `${d}T00:00:00Z` : d);

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

export const addMonths = (d: Date, n: number): Date => {
  const x = new Date(d.getTime());
  const day = x.getUTCDate();
  x.setUTCMonth(x.getUTCMonth() + n);
  if (x.getUTCDate() !== day) x.setUTCDate(0); // 31 janv. + 1 mois -> 28/29 févr.
  return x;
};

export const ageOn = (birth: Date, on: Date): number => {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export const iso = (d: Date): string => d.toISOString().slice(0, 10);
