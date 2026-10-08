export interface DonorProfile {
    userId: string;
    fullName: string;
    phone: string;
    bloodGroup: string;
    eligibilityStatus: 'eligible' | 'temporaire' | 'definitif' | 'en_attente';
    nextDonationPossibleDate: string;
    position: {
        latitude: number;
        longitude: number;
    };
    zone: string;
}

export interface EventSlot {
    time: string;
    capacity: number;
}

export interface BloodEvent {
    id: string;
    organizerId: string;
    title: string;
    placeName: string;
    address: string;
    position: {
        latitude: number;
        longitude: number;
    };
    eventDate: string;
    slots: EventSlot[];
    capacity: number;
    registeredCount: number;
    targetGroups: string[];
    conditions?: string;
    status: 'publie' | 'annule' | 'termine';
    distanceKm?: number;
}

export interface EventRegistrationResponse {
    id: string;
    eventId: string;
    donorId: string;
    slot: string;
    status: string;
    qrToken: string;
}