import { Platform } from 'react-native';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export interface EligibilityAnswers {
    age: number;
    weightKg: number;
    lastDonationDate?: string; // Format YYYY-MM-DD
    chronicDisease: boolean;
    onTreatment: boolean;
    hepatitisOrHivHistory: boolean;
    recentSurgery: boolean;
    recentTattooOrPiercing: boolean;
    recentTransfusion: boolean;
    riskAreaTravel: boolean;
    recentVaccination: boolean;
    recentFeverOrInfection: boolean;
    pregnantOrBreastfeeding?: boolean;
    consent: boolean;
}

export interface EvaluationResult {
    isEligible: boolean;
    status: 'eligible' | 'temporaire' | 'definitif';
    reasons: string[];
}

/**
 * Évaluation médicale côté mobile (fallback / affichage immédiat)
 */
export const evaluateEligibility = (answers: EligibilityAnswers): EvaluationResult => {
    const reasons: string[] = [];
    let status: 'eligible' | 'temporaire' | 'definitif' = 'eligible';

    if (answers.age < 18) {
        reasons.push('العمر أقل من 18 سنة (الحد الأدنى 18 سنة)');
        status = 'temporaire';
    } else if (answers.age > 65) {
        reasons.push('العمر يتجاوز 65 سنة');
        status = 'temporaire';
    }

    if (answers.weightKg < 50) {
        reasons.push('الوزن أقل من 50 كغ (الحد الأدنى 50 كغ)');
        status = 'temporaire';
    }

    if (answers.chronicDisease) {
        reasons.push('وجود مرض مزمن');
        status = 'temporaire';
    }

    if (answers.onTreatment) {
        reasons.push('تناول أدوية أو مضادات حيوية حالياً');
        status = 'temporaire';
    }

    if (answers.recentTattooOrPiercing) {
        reasons.push('عمل وشم أو ثقب خلال الـ 4 أشهر الأخيرة');
        status = 'temporaire';
    }

    if (answers.hepatitisOrHivHistory) {
        reasons.push('سجل إصابة بأمراض كبدية أو فيروسية');
        status = 'definitif';
    }

    if (answers.lastDonationDate) {
        const lastDate = new Date(answers.lastDonationDate);
        const today = new Date();
        const diffTime = today.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

        if (diffDays < 60) {
            const remainingDays = 60 - diffDays;
            reasons.push(`الفترة بين التبرعين غير كافية (متبقي ${remainingDays} يوم)`);
            status = 'temporaire';
        }
    }

    return {
        isEligible: status === 'eligible',
        status,
        reasons,
    };
};

/**
 * Soumission du formulaire d'éligibilité au backend NestJS
 */
export const submitEligibilityForm = async (
    answers: EligibilityAnswers,
    token: string,
    userId: string
): Promise<EvaluationResult> => {
    // 1. Protection contre l'envoi d'un token ou userId invalide
    if (!token || token === 'undefined' || token === 'null') {
        throw new Error('Jeton d’authentification manquant. Veuillez vous reconnecter.');
    }

    if (!userId || userId === 'undefined') {
        throw new Error('Identifiant utilisateur introuvable.');
    }

    const localEval = evaluateEligibility(answers);

    // Payload conforme au DTO attendu par POST /donors/{id}/eligibility-form
    const payload = {
        age: answers.age,
        weightKg: answers.weightKg,
        lastDonationDate: answers.lastDonationDate || null,
        chronicDisease: answers.chronicDisease,
        onTreatment: answers.onTreatment,
        hepatitisOrHivHistory: answers.hepatitisOrHivHistory,
        recentSurgery: answers.recentSurgery,
        recentTattooOrPiercing: answers.recentTattooOrPiercing,
        recentTransfusion: answers.recentTransfusion,
        riskAreaTravel: answers.riskAreaTravel,
        recentVaccination: answers.recentVaccination,
        recentFeverOrInfection: answers.recentFeverOrInfection,
        pregnantOrBreastfeeding: answers.pregnantOrBreastfeeding ?? false,
        consent: answers.consent,
    };

    const response = await fetch(`${API_URL}/donors/${userId}/eligibility-form`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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

    return {
        isEligible: backendData.result === 'eligible',
        status: backendData.result,
        reasons: backendData.reasons && backendData.reasons.length > 0 ? backendData.reasons : localEval.reasons,
    };
};