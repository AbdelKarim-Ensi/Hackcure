export enum UserRole { Donneur = 'donneur', Hopital = 'hopital', Crt = 'crt', Direction = 'direction', Admin = 'admin' }
export enum UserStatus { Actif = 'actif', Suspendu = 'suspendu' }
export enum BloodGroup { APos = 'A+', ANeg = 'A-', BPos = 'B+', BNeg = 'B-', ABPos = 'AB+', ABNeg = 'AB-', OPos = 'O+', ONeg = 'O-' }
export enum Sex { Homme = 'homme', Femme = 'femme' }
export enum EligibilityStatus { EnAttente = 'en_attente', Eligible = 'eligible', Temporaire = 'temporaire', Definitif = 'definitif' }
export enum DonationType { SangTotal = 'sang_total', Plaquettes = 'plaquettes', Plasma = 'plasma' }
export enum DonationSource { Urgence = 'urgence', Evenement = 'evenement' }
// AJOUT : CroissantRouge (valeurs d'origine : Hopital, BanqueSang, CentreTransfusion)
export enum InstitutionType { Hopital = 'hopital', BanqueSang = 'banque_sang', CentreTransfusion = 'centre_transfusion', CroissantRouge = 'croissant_rouge' }
export enum ValidationStatus { EnAttente = 'en_attente', Valide = 'valide', Rejete = 'rejete' }
export enum UrgencyLevel { Normale = 'normale', Urgente = 'urgente', Critique = 'critique' }
export enum RequestStatus { EnRevue = 'en_revue', Active = 'active', Couverte = 'couverte', Cloturee = 'cloturee', Expiree = 'expiree' }
export enum ResponseType { JeViens = 'je_viens', NePeutPas = 'ne_peut_pas' }
export enum EventStatus { Publie = 'publie', Annule = 'annule', Termine = 'termine' }
export enum RegistrationStatus { Inscrit = 'inscrit', Present = 'present', Absent = 'absent', Annule = 'annule' }
export enum NotificationType { Urgence = 'urgence', Evenement = 'evenement', Rappel = 'rappel' }
export enum NotificationStatus { EnAttente = 'en_attente', Envoyee = 'envoyee', Echec = 'echec', Lue = 'lue' }
