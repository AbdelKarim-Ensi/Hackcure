export interface NotifPrefs {
    alertsEnabled?: boolean;
    quietHours?: {
        start: string;
        end: string;
    };
}

export interface DonorProfile {
    id?: string;
    fullName?: string;
    phone?: string;
    bloodGroup?: string;
    bloodGroupConfirmed?: boolean; // 👈 Propriété ajoutée
    sex?: 'homme' | 'femme' | string;
    zone?: string;
    maxRadiusKm?: number;
    available?: boolean;
    lastDonationDate?: string;
    nextDonationPossibleDate?: string;
    reevalDate?: string;
    notifPrefs?: NotifPrefs;
    position?: {
        latitude: number;
        longitude: number;
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