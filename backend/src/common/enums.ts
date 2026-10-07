// AJOUT : T3 - énumérations partagées, valeurs identiques aux types ENUM de la migration Init1790000000000

export enum UserRole {
  DONNEUR = 'donneur',
  HOPITAL = 'hopital',
  CRT = 'crt',
  DIRECTION = 'direction',
  ADMIN = 'admin',
}

export enum BloodGroup {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
  O_POS = 'O+',
  O_NEG = 'O-',
}

export enum Sex {
  HOMME = 'homme',
  FEMME = 'femme',
}

export enum EligibilityStatus {
  EN_ATTENTE = 'en_attente',
  ELIGIBLE = 'eligible',
  TEMPORAIRE = 'temporaire',
  DEFINITIF = 'definitif',
}

export enum DonationType {
  SANG_TOTAL = 'sang_total',
  PLAQUETTES = 'plaquettes',
  PLASMA = 'plasma',
}

export enum DonationSource {
  URGENCE = 'urgence',
  EVENEMENT = 'evenement',
}

export enum InstitutionType {
  HOPITAL = 'hopital',
  BANQUE_SANG = 'banque_sang',
  CENTRE_TRANSFUSION = 'centre_transfusion',
  // AJOUT : type Croissant-Rouge (collectes de don volontaire), migration CroissantRouge1790000000001
  CROISSANT_ROUGE = 'croissant_rouge',
}

export enum ValidationStatus {
  EN_ATTENTE = 'en_attente',
  VALIDE = 'valide',
  REJETE = 'rejete',
}

export enum UrgencyLevel {
  NORMALE = 'normale',
  URGENTE = 'urgente',
  CRITIQUE = 'critique',
}

export enum RequestStatus {
  EN_REVUE = 'en_revue',
  ACTIVE = 'active',
  COUVERTE = 'couverte',
  CLOTUREE = 'cloturee',
  EXPIREE = 'expiree',
}

export enum ResponseType {
  JE_VIENS = 'je_viens',
  NE_PEUT_PAS = 'ne_peut_pas',
}

export enum EventStatus {
  PUBLIE = 'publie',
  ANNULE = 'annule',
  TERMINE = 'termine',
}

export enum RegistrationStatus {
  INSCRIT = 'inscrit',
  PRESENT = 'present',
  ABSENT = 'absent',
  ANNULE = 'annule',
}

export enum NotificationType {
  URGENCE = 'urgence',
  EVENEMENT = 'evenement',
  RAPPEL = 'rappel',
}

export enum NotificationStatus {
  EN_ATTENTE = 'en_attente',
  ENVOYEE = 'envoyee',
  ECHEC = 'echec',
  LUE = 'lue',
}

/** Niveau d'alerte d'un stock pour la carte de M4 (rouge, orange, vert). */
export enum StockLevel {
  ROUGE = 'rouge',
  ORANGE = 'orange',
  VERT = 'vert',
}
