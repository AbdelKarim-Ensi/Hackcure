import { BloodGroup, DonationType, Sex } from './types';

/**
 * Tous les paramètres des règles sont ici (source unique).
 * ⚠ Les valeurs marquées « à valider » doivent être confirmées par le CNTS / un professionnel de santé.
 */

/** Matrice donneur -> groupes receveurs (sang total / concentrés de globules rouges). */
export const COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

/** Délai minimal entre deux dons, en jours (à valider). */
export const MIN_INTERVAL_DAYS: Record<DonationType, Record<Sex, number>> = {
  whole_blood: { male: 90, female: 120 },
  plasma: { male: 14, female: 14 },
  platelets: { male: 14, female: 14 },
};

export const SCORING = {
  weights: {
    normal: { prob: 0.3, dist: 0.25, rel: 0.2, avail: 0.15, match: 0.1 },
    critical: { prob: 0.25, dist: 0.4, rel: 0.15, avail: 0.15, match: 0.05 },
  },
  probSmoothing: { p0: 0.3, alpha: 5 },
  matchScores: { exact: 1.0, compatible: 0.7, universalDonorOnOtherGroup: 0.4 },
  availabilityScores: { now: 1.0, window: 0.5, none: 0.0 },
} as const;

export const WAVES = {
  safetyFactor: { normal: 1.5, critical: 2.0 },
  timeoutMinutes: { normal: 15, critical: 5 },
  radiusKm: { r0Default: 10, delta: 10, rMax: 30 },
  maxUrgentAlertsPerWeek: 3,
} as const;
