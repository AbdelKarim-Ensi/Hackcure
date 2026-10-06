import { Platform } from 'react-native';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const DEV_USER = {
    phone: '+21612345678',
    password: 'Password123!',
};

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
 * Moteur d'évaluation médicale côté mobile
 */
export const evaluateEligibility = (answers: EligibilityAnswers): EvaluationResult => {
    const reasons: string[] = [];
    let status: 'eligible' | 'temporaire' | 'definitif' = 'eligible';

    // 1. Contrôle de l'âge
    if (answers.age < 18) {
        reasons.push('العمر أقل من 18 سنة (الحد الأدنى 18 سنة)');
        status = 'temporaire';
    } else if (answers.age > 65) {
        reasons.push('العمر يتجاوز 65 سنة');
        status = 'temporaire';
    }

    // 2. Contrôle du poids
    if (answers.weightKg < 50) {
        reasons.push('الوزن أقل من 50 كغ (الحد الأدنى 50 كغ)');
        status = 'temporaire';
    }

    // 3. الأمراض المزمنة
    if (answers.chronicDisease) {
        reasons.push('وجود مرض مزمن');
        status = 'temporaire';
    }

    // 4. الأدوية والمضادات الحيوية
    if (answers.onTreatment) {
        reasons.push('تناول أدوية أو مضادات حيوية حالياً');
        status = 'temporaire';
    }

    // 5. الوشم أو الثقب
    if (answers.recentTattooOrPiercing) {
        reasons.push('عمل وشم أو ثقب خلال الـ 4 أشهر الأخيرة');
        status = 'temporaire';
    }

    // 6. الأمراض الفيروسية (دائم)
    if (answers.hepatitisOrHivHistory) {
        reasons.push('سجل إصابة بأمراض كبدية أو فيروسية');
        status = 'definitif';
    }

    // 7. تاريخ آخر تبرع (الحد الأدنى 60 يوم)
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

export const getValidAuthToken = async (): Promise<{ token: string; userId: string }> => {
    try {
        let loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEV_USER),
        });

        if (loginRes.ok) {
            const data = await loginRes.json();
            return { token: data.accessToken, userId: data.user?.id || data.userId };
        }

        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: DEV_USER.phone,
                password: DEV_USER.password,
                role: 'donneur',
                fullName: 'Donneur Test',
            }),
        });

        const regData = await regRes.json().catch(() => ({}));
        let otpCode = regData.devOtp;

        if (!otpCode) {
            const otpRes = await fetch(`${API_URL}/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: DEV_USER.phone }),
            });
            const otpData = await otpRes.json().catch(() => ({}));
            otpCode = otpData.devOtp;
        }

        const verifyRes = await fetch(`${API_URL}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: DEV_USER.phone,
                code: otpCode || '056657',
            }),
        });

        if (!verifyRes.ok) {
            const err = await verifyRes.json().catch(() => ({}));
            throw new Error(err.message || 'Échec de la vérification OTP');
        }

        const data = await verifyRes.json();
        return { token: data.accessToken, userId: data.user?.id || data.userId };
    } catch (error: any) {
        throw new Error(`Erreur d'authentification: ${error.message}`);
    }
};

export const submitEligibilityForm = async (answers: EligibilityAnswers) => {
    const { token, userId } = await getValidAuthToken();

    // Évaluation locale des règles
    const evaluation = evaluateEligibility(answers);

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
        result: evaluation.status,
        answersEncrypted: JSON.stringify(answers),
        questionnaireVersion: 'v1',
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

    // Retourne le résultat évalué localement avec les raisons précises
    return evaluation;
};