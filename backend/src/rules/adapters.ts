import { Availability, DonationType, Sex, Urgency } from './types';

/**
 * Adaptateurs entre les enums de la base (français) et les types des règles.
 * Ils acceptent des `string` pour que `rules/` ne dépende pas de `database/`.
 */

/** `critique` -> poids « critical » ; `normale` et `urgente` -> poids « normal ». */
export const toRulesUrgency = (u: string): Urgency => (u === 'critique' ? 'critical' : 'normal');

export const toRulesSex = (s?: string | null): Sex | undefined =>
  s === 'homme' ? 'male' : s === 'femme' ? 'female' : undefined;

export const toRulesDonationType = (t?: string | null): DonationType =>
  t === 'plasma' ? 'plasma' : t === 'plaquettes' ? 'platelets' : 'whole_blood';

/** Le schéma n'a qu'un booléen `available` : pas de niveau « window » pour l'instant. */
export const toRulesAvailability = (available: boolean): Availability => (available ? 'now' : 'none');

/**
 * Normalise une colonne `date` renvoyée par `pg` (string « AAAA-MM-JJ » ou objet Date local)
 * en « AAAA-MM-JJ ».
 */
export function toDateString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return null;
}
