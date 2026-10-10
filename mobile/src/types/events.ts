export interface NotifPrefs {
    alertsEnabled?: boolean;
    quietHours?: {
        start: string;
        end: string;
    };
}

export interface DonorProfile {
    id?: string;
    fullName: string;
    phone: string;
    bloodGroup: string;
    sex: 'homme' | 'femme';
    zone: string;
    maxRadiusKm: number;
    available: boolean;
    bloodGroupConfirmed?: boolean;
    lastDonationDate?: string;
    nextDonationPossibleDate?: string;
    // 🔒 Nouveaux champs d'état d'éligibilité par profil
    eligibilityStatus?: 'en_attente' | 'eligible' | 'temporaire' | 'definitif';
    reevalDate?: string | null;
    notifPrefs?: {
        alertsEnabled?: boolean;
        quietHours?: { start: string; end: string };
    };
}
export interface EventSlot {
    time: string;
    capacity: number;
}

export interface BloodEvent {
    id: string;
    organizerId?: string;
    title: string;
    placeName: string;
    address: string;
    position?: {
        latitude: number;
        longitude: number;
    };
    eventDate: string;
    slots: EventSlot[];
    capacity: number;
    registeredCount: number;
    targetGroups: string[];
    conditions?: string;
    status: 'publie' | 'annule' | string;
    distanceKm?: number;
}

export interface EventRegistrationResponse {
    id: string;
    eventId: string;
    donorId: string;
    slot: string;
    status: 'inscrit' | 'present' | 'don_effectue' | 'annule';
    qrToken: string;
}