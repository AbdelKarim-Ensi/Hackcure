import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BloodEvent, DonorProfile, EventRegistrationResponse } from '../types/events';

const API_BASE_URL = 'http://10.0.2.2:3000';

export interface RegistrationHistoryItem {
    id: string;
    eventId: string;
    donorId: string;
    slot: string;
    status: 'inscrit' | 'present' | 'don_effectue' | 'annule';
    qrToken: string;
    registeredAt: string;
    event?: {
        title: string;
        placeName: string;
        address: string;
        eventDate: string;
    };
}

export const getDonorProfile = async (token: string): Promise<DonorProfile> => {
    let apiData: any = {};
    try {
        const response = await axios.get(`${API_BASE_URL}/donors/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        apiData = response.data || {};
    } catch (error: any) {
        console.log('Erreur /donors/me, bascule en local');
    }

    const localProfileStr = await AsyncStorage.getItem('user_profile');
    const localProfile = localProfileStr ? JSON.parse(localProfileStr) : null;

    return {
        ...apiData,
        fullName: (apiData.fullName && apiData.fullName !== 'Amine Ben Salah')
            ? apiData.fullName
            : (localProfile?.fullName || 'Donneur'),
        bloodGroup: localProfile?.bloodGroup || apiData.bloodGroup || 'O+',
        phone: localProfile?.phone || apiData.phone || '',
        sex: localProfile?.sex || apiData.sex || 'homme',
        zone: localProfile?.zone || apiData.zone || 'Tunis',
        maxRadiusKm: localProfile?.maxRadiusKm ?? apiData.maxRadiusKm ?? 20,
        available: localProfile?.available ?? apiData.available ?? true,
    };
};

export const updateDonorProfile = async (
    token: string,
    payload: {
        fullName?: string;
        sex?: string;
        bloodGroup?: string;
        zone?: string;
        position?: { latitude: number; longitude: number };
        available?: boolean;
        maxRadiusKm?: number;
        notifPrefs?: {
            alertsEnabled?: boolean;
            quietHours?: { start: string; end: string };
        };
    }
): Promise<DonorProfile> => {
    let apiData: any = {};
    try {
        const response = await axios.patch(
            `${API_BASE_URL}/donors/me`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        apiData = response.data || {};
    } catch (e: any) {
        console.log('Erreur PATCH API');
    }

    const localProfileStr = await AsyncStorage.getItem('user_profile');
    const localProfile = localProfileStr ? JSON.parse(localProfileStr) : {};

    const updatedProfile: DonorProfile = {
        ...apiData,
        ...localProfile,
        ...payload,
    };

    const userPhone = updatedProfile.phone || localProfile.phone;
    if (userPhone) {
        updatedProfile.phone = userPhone;
        await AsyncStorage.setItem(`user_profile_${userPhone}`, JSON.stringify(updatedProfile));
    }

    await AsyncStorage.setItem('user_profile', JSON.stringify(updatedProfile));
    return updatedProfile;
};

export const getUpcomingEvents = async (
    token: string,
    params?: { lat?: number; lng?: number; maxDistanceKm?: number; governorate?: string }
): Promise<BloodEvent[]> => {
    try {
        const cleanParams: Record<string, any> = {};
        if (params?.governorate && params.governorate.trim() !== '') {
            cleanParams.governorate = params.governorate;
        }

        const response = await axios.get(`${API_BASE_URL}/events`, {
            headers: { Authorization: `Bearer ${token}` },
            params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
        });

        const rawEvents = Array.isArray(response.data) ? response.data : [];

        return rawEvents.map((evt: any) => ({
            id: evt.id,
            organizerId: evt.organizerId || evt.organizer_id,
            title: evt.title,
            placeName: evt.placeName || evt.place_name || 'Lieu non spécifié',
            address: evt.address || '',
            position: (typeof evt.position === 'object' && evt.position !== null && 'latitude' in evt.position)
                ? evt.position
                : { latitude: 36.8065, longitude: 10.1815 },
            eventDate: evt.eventDate || evt.event_date,
            slots: Array.isArray(evt.slots)
                ? evt.slots.map((s: any) =>
                    typeof s === 'string' ? { time: s, capacity: evt.capacity || 20 } : s
                )
                : [],
            capacity: evt.capacity || 40,
            registeredCount: evt.registeredCount ?? evt.registered_count ?? 0,
            targetGroups: evt.targetGroups || evt.target_groups || [],
            conditions: evt.conditions || '',
            status: evt.status || 'publie',
            distanceKm: evt.distanceKm ?? evt.distance_km ?? 0,
        }));
    } catch (error: any) {
        console.error('Erreur chargement événements:', error.message);
        throw error;
    }
};

/**
 * 🎯 Inscription à une collecte + enregistrement immédiat dans l'historique spécifique à l'utilisateur
 */
export const registerToEvent = async (
    token: string,
    eventId: string,
    slot: string,
    eventDetails?: BloodEvent
): Promise<EventRegistrationResponse> => {
    let registrationData: EventRegistrationResponse;

    try {
        const response = await axios.post(
            `${API_BASE_URL}/events/${eventId}/register`,
            { slot },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        registrationData = response.data;
    } catch (e: any) {
        // Fallback si l'API est indisponible
        registrationData = {
            id: `reg-${Date.now()}`,
            eventId,
            donorId: 'donor-me',
            slot,
            status: 'inscrit',
            qrToken: `damm.qr.${eventId}.${slot}.${Date.now()}`,
        };
    }

    // 🔒 Clé d'historique propre à l'utilisateur connecté
    try {
        const profileStr = await AsyncStorage.getItem('user_profile');
        const profile = profileStr ? JSON.parse(profileStr) : null;
        const userKey = profile?.phone ? `user_registrations_${profile.phone}` : 'user_registrations';

        const historyStr = await AsyncStorage.getItem(userKey);
        const history: RegistrationHistoryItem[] = historyStr ? JSON.parse(historyStr) : [];

        const newItem: RegistrationHistoryItem = {
            id: registrationData.id,
            eventId: registrationData.eventId,
            donorId: registrationData.donorId,
            slot: registrationData.slot,
            status: 'inscrit',
            qrToken: registrationData.qrToken,
            registeredAt: new Date().toISOString(),
            event: {
                title: eventDetails?.title || 'Collecte de sang',
                placeName: eventDetails?.placeName || 'Centre de transfusion',
                address: eventDetails?.address || 'Tunisie',
                eventDate: eventDetails?.eventDate || new Date().toISOString().split('T')[0],
            },
        };

        const updatedHistory = [newItem, ...history.filter(item => item.eventId !== eventId)];
        await AsyncStorage.setItem(userKey, JSON.stringify(updatedHistory));
    } catch (err) {
        console.log('Erreur sauvegarde historique local:', err);
    }

    return registrationData;
};

/**
 * 🎯 Récupère l'historique propre à l'utilisateur actuellement connecté
 */
export const getUserRegistrations = async (_token?: string): Promise<RegistrationHistoryItem[]> => {
    try {
        const profileStr = await AsyncStorage.getItem('user_profile');
        const profile = profileStr ? JSON.parse(profileStr) : null;

        if (!profile?.phone) {
            return [];
        }

        const userKey = `user_registrations_${profile.phone}`;
        const historyStr = await AsyncStorage.getItem(userKey);

        if (historyStr) {
            return JSON.parse(historyStr);
        }
    } catch (err) {
        console.error('Erreur lecture historique:', err);
    }
    return [];
};

export interface ApiNotification {
    id: string;
    type: string;
    status: string;
    payload?: {
        requestId?: string;
        bloodGroup?: string;
        hospitalName?: string;
        distanceKm?: number;
        urgency?: string;
        title?: string;
        message?: string;
    };
    createdAt: string;
    sentAt?: string;
}

/**
 * 🔔 Récupère la liste des notifications réelles de l'utilisateur connecté
 */
export const getUserNotifications = async (token: string): Promise<ApiNotification[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/notifications/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        console.error('Erreur chargement /notifications/me:', error?.message);
        return [];
    }
};

export interface UrgentRequestItem {
    id: string;
    institutionId?: string;
    institutionName: string;
    bloodGroup: string;
    quantity: number;
    urgency: string;
    status: string;
    currentRadiusKm?: number;
    createdAt?: string;
}

/**
 * 🚨 Récupère les demandes d'urgence actives créées par les hôpitaux (ex: Hôpital Charles Nicolle)
 */
export const getActiveUrgentRequests = async (token: string): Promise<UrgentRequestItem[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/requests`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { status: 'active' },
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
        console.log('Erreur /requests:', error?.message);
        return [];
    }
};

/**
 * 🚑 Répondre à une alerte d'urgence d'hôpital ("Je viens")
 */
export const respondToUrgentRequest = async (
    token: string,
    requestId: string,
    responseValue: 'je_viens' | 'je_ne_peux_pas' = 'je_viens'
): Promise<any> => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/requests/${requestId}/respond`,
            { response: responseValue },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error: any) {
        console.error('Erreur réponse alerte urgence:', error?.message);
        throw error;
    }
};