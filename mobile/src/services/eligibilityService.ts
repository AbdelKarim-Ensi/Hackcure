import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

/**
 * DTO officiel conforme au contrat M1 (POST /donors/:id/eligibility-form)
 */
export interface EligibilityAnswers {
    birthDate: string; // Format AAAA-MM-JJ
    weightKg: number;
    feverInfectionRecent: boolean;
    feverRecoveryDate?: string;
    antibioticsEndDate?: string;
    tattooPiercingDate?: string;
    surgeryDate?: string;
    transfusionReceivedDate?: string;
    pregnant?: boolean;
    deliveryDate?: string;
    vaccinationDate?: string;
    malariaZoneReturnDate?: string;
    infectiousHistory: boolean;
    injectedDrugUseEver: boolean;
    chronicDisease: boolean;
    regularMedication: boolean;
    consent: boolean;
}

export interface EvaluationResult {
    isEligible: boolean;
    status: 'eligible' | 'temporaire' | 'definitif' | 'en_attente' | string;
    reevalDate?: string | null;
    reasons: string[];
}

/**
 * 🔒 Fonction utilitaire pour sauvegarder le statut dans TOUTES les clés de cache du profil
 */
const saveProfileEligibility = async (status: string, reevalDate?: string | null) => {
    try {
        const profileStr = await AsyncStorage.getItem('user_profile');
        if (profileStr) {
            const profile = JSON.parse(profileStr);
            profile.eligibilityStatus = status;
            profile.reevalDate = reevalDate || null;

            // 1. Sauvegarde dans la clé principale
            await AsyncStorage.setItem('user_profile', JSON.stringify(profile));

            // 2. Sauvegarde dans la clé par numéro de téléphone
            if (profile.phone) {
                await AsyncStorage.setItem(`user_profile_${profile.phone}`, JSON.stringify(profile));
            }
        }
    } catch (err) {
        console.log('Erreur sauvegarde locale du statut d’éligibilité:', err);
    }
};

/**
 * Évaluation locale de secours (Fallback)
 */
export const evaluateEligibilityLocal = (answers: EligibilityAnswers): EvaluationResult => {
    const reasons: string[] = [];
    let status: 'eligible' | 'temporaire' | 'definitif' = 'eligible';

    if (answers.birthDate) {
        const birth = new Date(answers.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        if (age < 18) {
            reasons.push('العمر أقل من 18 سنة (الحد الأدنى 18 سنة) / Âge inférieur à 18 ans');
            status = 'temporaire';
        } else if (age > 65) {
            reasons.push('العمر يتجاوز 65 سنة / Âge supérieur à 65 ans');
            status = 'temporaire';
        }
    }

    if (answers.weightKg < 50) {
        reasons.push('الوزن أقل من 50 كغ (الحد الأدنى 50 كغ) / Poids < 50kg');
        status = 'temporaire';
    }

    if (answers.infectiousHistory || answers.injectedDrugUseEver) {
        reasons.push('سجل أمراض معدية أو تعاطي مخدرات / Antécédents infectieux ou substances');
        status = 'definitif';
    }

    if (answers.chronicDisease) {
        reasons.push('وجود مرض مزمن / Maladie chronique');
        status = 'temporaire';
    }

    if (answers.pregnant) {
        reasons.push('حمل حالي / Grossesse en cours');
        status = 'temporaire';
    }

    return {
        isEligible: status === 'eligible',
        status,
        reasons,
    };
};

/**
 * Soumission du formulaire d'éligibilité au backend NestJS (T4.2)
 */
export const submitEligibilityForm = async (
    answers: EligibilityAnswers,
    token: string,
    userId: string
): Promise<EvaluationResult> => {
    if (!token || token === 'undefined' || token === 'null') {
        throw new Error('Jeton d’authentification manquant. Veuillez vous reconnecter.');
    }

    if (!userId || userId === 'undefined') {
        throw new Error('Identifiant utilisateur introuvable.');
    }

    const localEval = evaluateEligibilityLocal(answers);

    try {
        const response = await fetch(`${API_URL}/donors/${userId}/eligibility-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(answers),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let message = 'Erreur lors de la soumission';
            if (Array.isArray(errorData.message)) {
                message = errorData.message.join('\n');
            } else if (typeof errorData.message === 'string') {
                message = errorData.message;
            }
            throw new Error(message);
        }

        const backendData = await response.json();

        // Extraction stricte du statut selon l'Enum Swagger (eligible, temporaire, definitif, en_attente)
        const status: 'en_attente' | 'eligible' | 'temporaire' | 'definitif' =
            backendData.result || backendData.status || (backendData.isEligible ? 'eligible' : 'temporaire');

        const reevalDate = backendData.reevalDate || null;
        const isEligible = status === 'eligible';

        // 🔒 Enregistrement dans les deux clés de profil AsyncStorage
        await saveProfileEligibility(status, reevalDate);

        return {
            isEligible,
            status,
            reevalDate,
            reasons: Array.isArray(backendData.reasons) ? backendData.reasons : localEval.reasons,
        };
    } catch (error: any) {
        console.warn('API non disponible, utilisation du fallback local:', error.message);

        // 🔒 SAUVEGARDE DU RESULTAT DU FALLBACK LOCAL (Cas sans backend)
        await saveProfileEligibility(localEval.status, localEval.reevalDate || null);

        return localEval;
    }
};