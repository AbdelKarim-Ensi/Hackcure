export type BloodGroup = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';
export type Sex = 'male' | 'female';
export type DonationType = 'whole_blood' | 'plasma' | 'platelets';
export type Urgency = 'normal' | 'critical';
export type Availability = 'now' | 'window' | 'none';

/** Valeurs identiques à l'enum d'éligibilité de la base (BACKEND.md §4). */
export type EligibilityStatus = 'en_attente' | 'eligible' | 'temporaire' | 'definitif';

export type RuleOutcome = 'PERMANENT' | 'MEDICAL_REVIEW' | 'TEMP_DEFERRED';

/** Réponses du formulaire (dates au format ISO « AAAA-MM-JJ »). */
export interface EligibilityAnswers {
  birthDate: string;
  weightKg: number;
  feverInfectionRecent?: boolean;
  feverRecoveryDate?: string;
  antibioticsEndDate?: string;
  tattooPiercingDate?: string;
  surgeryDate?: string;
  transfusionReceivedDate?: string;
  pregnant?: boolean;
  deliveryDate?: string;
  vaccinationDate?: string;
  malariaZoneReturnDate?: string;
  infectiousHistory?: boolean;
  injectedDrugUseEver?: boolean;
  chronicDisease?: boolean;
  regularMedication?: boolean;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  /** Date de réévaluation (AAAA-MM-JJ) ou null si aucune date n'est applicable. */
  reevalDate: string | null;
  firedRules: string[];
  /** true si le personnel médical doit trancher (statut `en_attente`). */
  requiresMedicalReview: boolean;
}

export interface BloodRequestInput {
  bloodGroup: BloodGroup;
  exactMatchOnly?: boolean;
  urgency: Urgency;
  donationType?: DonationType;
}

/** Candidat préparé par le backend (la distance vient de PostGIS : ST_Distance). */
export interface Candidate {
  donorId: string;
  bloodGroup: BloodGroup;
  sex?: Sex;
  eligibilityStatus: EligibilityStatus;
  lastDonationDate?: string | null;
  distanceKm: number;
  availability: Availability;
  alertsReceived: number;
  alertsAccepted: number;
  showedUp: number;
  alreadyAlertedForRequest?: boolean;
  urgentAlertsThisWeek?: number;
}

export type RejectReason =
  | 'incompatible'
  | 'non_eligible'
  | 'delai_entre_dons'
  | 'hors_rayon'
  | 'deja_alerte'
  | 'quota_hebdo';

export interface ScoreComponents {
  prob: number;
  dist: number;
  rel: number;
  avail: number;
  match: number;
}

export interface RankedDonor {
  donorId: string;
  score: number;
  rank: number;
  components: ScoreComponents;
  reasons: string[];
  expectedYield: number;
}
