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

// ------------------------------------------------------------------
// 🛠️ FONCTIONS UTILITAIRES DE DATES (Exactement identiques à rules/dates.ts)
// ------------------------------------------------------------------
const toDate = (isoStr: string): Date => {
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const addDays = (d: Date, days: number): Date => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
};

const addMonths = (d: Date, months: number): Date => {
    const res = new Date(d);
    res.setMonth(res.getMonth() + months);
    return res;
};

const ageOn = (birth: Date, now: Date): number => {
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

const iso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * 🔒 Transposition directe de evaluateEligibility() de backend/src/rules/eligibility.ts
 */
export const evaluateEligibilityLocal = (
    answers: EligibilityAnswers,
    now: Date = new Date()
): EvaluationResult => {
    type RuleOutcome = 'PERMANENT' | 'MEDICAL_REVIEW' | 'TEMP_DEFERRED';
    interface Hit {
        id: string;
        outcome: RuleOutcome;
        reeval?: Date | null;
    }

    const hits: Hit[] = [];

    // E01 : Moins de 18 ans
    if (answers.birthDate) {
        const birth = toDate(answers.birthDate);
        if (ageOn(birth, now) < 18) {
            hits.push({ id: 'E01', outcome: 'TEMP_DEFERRED', reeval: addMonths(birth, 18 * 12) });
        }
    }

    // E01b : Plus de 65 ans
    if (answers.birthDate) {
        const birth = toDate(answers.birthDate);
        if (ageOn(birth, now) > 65) {
            hits.push({ id: 'E01b', outcome: 'MEDICAL_REVIEW' });
        }
    }

    // E02 : Poids < 50kg
    if (answers.weightKg !== undefined && answers.weightKg < 50) {
        hits.push({ id: 'E02', outcome: 'TEMP_DEFERRED', reeval: null });
    }

    // E04 : Fièvre / Infection récente (14 jours)
    if (answers.feverInfectionRecent) {
        const base = answers.feverRecoveryDate ? toDate(answers.feverRecoveryDate) : now;
        const reeval = addDays(base, 14);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E04', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E05 : Antibiotiques (14 jours après fin du traitement)
    if (answers.antibioticsEndDate) {
        const start = toDate(answers.antibioticsEndDate);
        const reeval = addDays(start, 14);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E05', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E06 : Tatouage / Piercing (4 mois)
    if (answers.tattooPiercingDate) {
        const start = toDate(answers.tattooPiercingDate);
        const reeval = addMonths(start, 4);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E06', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E07 : Chirurgie (6 mois)
    if (answers.surgeryDate) {
        const start = toDate(answers.surgeryDate);
        const reeval = addMonths(start, 6);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E07', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E08 : Transfusion reçue (4 mois)
    if (answers.transfusionReceivedDate) {
        const start = toDate(answers.transfusionReceivedDate);
        const reeval = addMonths(start, 4);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E08', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E09 : Grossesse / Accouchement (6 mois)
    if (answers.deliveryDate) {
        const reeval = addMonths(toDate(answers.deliveryDate), 6);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E09', outcome: 'TEMP_DEFERRED', reeval });
        }
    } else if (answers.pregnant) {
        hits.push({ id: 'E09', outcome: 'TEMP_DEFERRED', reeval: null });
    }

    // E10 : Vaccination récente (1 mois)
    if (answers.vaccinationDate) {
        const start = toDate(answers.vaccinationDate);
        const reeval = addMonths(start, 1);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E10', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E11 : Séjour zone paludisme (6 mois)
    if (answers.malariaZoneReturnDate) {
        const start = toDate(answers.malariaZoneReturnDate);
        const reeval = addMonths(start, 6);
        if (now.getTime() < reeval.getTime()) {
            hits.push({ id: 'E11', outcome: 'TEMP_DEFERRED', reeval });
        }
    }

    // E12 : Antécédents infectieux (VIH / Hépatite) -> Définitif
    if (answers.infectiousHistory) {
        hits.push({ id: 'E12', outcome: 'PERMANENT' });
    }

    // E13 : Drogues injectables -> Définitif
    if (answers.injectedDrugUseEver) {
        hits.push({ id: 'E13', outcome: 'PERMANENT' });
    }

    // E14 : Maladie chronique -> Avis médical
    if (answers.chronicDisease) {
        hits.push({ id: 'E14', outcome: 'MEDICAL_REVIEW' });
    }

    // E15 : Médicaments réguliers -> Avis médical
    if (answers.regularMedication) {
        hits.push({ id: 'E15', outcome: 'MEDICAL_REVIEW' });
    }

    // --- CALCUL DE LA DATE DE RÉÉVALUATION LA PLUS TARDIVE ---
    const validReevals = hits
        .map((h) => h.reeval)
        .filter((d): d is Date => d instanceof Date);

    let latestReeval: Date | null = null;
    if (validReevals.length > 0) {
        latestReeval = validReevals.reduce(
            (acc, d) => (d.getTime() > acc.getTime() ? d : acc),
            validReevals[0]
        );
    }

    const reevalDate = latestReeval ? iso(latestReeval) : null;
    const firedRules = hits.map((h) => h.id);

    const has = (outcome: RuleOutcome) => hits.some((h) => h.outcome === outcome);

    // --- PRIORITÉS : PERMANENT > MEDICAL_REVIEW > TEMP_DEFERRED > ELIGIBLE ---
    if (has('PERMANENT')) {
        return { isEligible: false, status: 'definitif', reevalDate: null, reasons: firedRules };
    }
    if (has('MEDICAL_REVIEW')) {
        return { isEligible: false, status: 'en_attente', reevalDate, reasons: firedRules };
    }
    if (has('TEMP_DEFERRED')) {
        return { isEligible: false, status: 'temporaire', reevalDate, reasons: firedRules };
    }

    return { isEligible: true, status: 'eligible', reevalDate: null, reasons: [] };
};

/**
 * Persistance dans AsyncStorage pour le profil global et le profil par téléphone
 */
const saveProfileEligibility = async (status: string, reevalDate?: string | null) => {
    try {
        const profileStr = await AsyncStorage.getItem('user_profile');
        if (profileStr) {
            const profile = JSON.parse(profileStr);
            profile.eligibilityStatus = status;
            profile.reevalDate = reevalDate || null;

            await AsyncStorage.setItem('user_profile', JSON.stringify(profile));

            if (profile.phone) {
                await AsyncStorage.setItem(`user_profile_${profile.phone}`, JSON.stringify(profile));
            }
        }
    } catch (err) {
        console.log('Erreur sauvegarde locale eligibility:', err);
    }
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

        const status: 'en_attente' | 'eligible' | 'temporaire' | 'definitif' =
            backendData.status || backendData.result || localEval.status;

        const reevalDate = backendData.reevalDate !== undefined ? backendData.reevalDate : localEval.reevalDate;
        const isEligible = status === 'eligible';

        await saveProfileEligibility(status, reevalDate);

        return {
            isEligible,
            status,
            reevalDate,
            reasons: Array.isArray(backendData.reasons) ? backendData.reasons : (Array.isArray(backendData.firedRules) ? backendData.firedRules : localEval.reasons),
        };
    } catch (error: any) {
        console.warn('API non disponible, utilisation du fallback local:', error.message);

        // Sauvegarde synchrone du résultat calculé par le moteur de règles local
        await saveProfileEligibility(localEval.status, localEval.reevalDate);

        return localEval;
    }
};