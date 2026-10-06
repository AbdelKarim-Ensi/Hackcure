export interface EligibilityFormData {
    age: number;
    weightKg: number;
    lastDonationDate: string; // Format YYYY-MM-DD
    chronicDisease: boolean;
    onTreatment: boolean;
    hepatitisOrHivHistory: boolean;
    recentSurgery: boolean;
    recentTattooOrPiercing: boolean;
    recentTransfusion: boolean;
    riskAreaTravel: boolean;
    recentVaccination: boolean;
    recentFeverOrInfection: boolean;
    pregnantOrBreastfeeding: boolean;
    consent: boolean;
}

export interface EligibilityResponse {
    result: 'eligible' | 'ineligible' | string;
    reevalDate: string | null;
    reasons: string[];
    questionnaireVersion: string;
    medicalConfirmationRequired: boolean;
}