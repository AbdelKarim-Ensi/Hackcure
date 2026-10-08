import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BloodEvent, DonorProfile, EventRegistrationResponse } from '../types/events';

const API_BASE_URL = 'http://10.0.2.2:3000';

export const getDonorProfile = async (token: string): Promise<DonorProfile> => {
    let apiData: any = {};
    try {
        const response = await axios.get(`${API_BASE_URL}/donors/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        apiData = response.data || {};
    } catch (error) {
        console.log('Erreur /donors/me, utilisation du profil local');
    }

    const localProfileStr = await AsyncStorage.getItem('user_profile');
    const localProfile = localProfileStr ? JSON.parse(localProfileStr) : null;

    return {
        ...apiData,
        fullName: (apiData.fullName && apiData.fullName !== 'Amine Ben Salah')
            ? apiData.fullName
            : (localProfile?.fullName || apiData.fullName || 'Donneur'),
        bloodGroup: localProfile?.bloodGroup || localProfile?.bloodType || apiData.bloodGroup || 'O+',
        phone: localProfile?.phone || apiData.phone,
    };
};

export const registerDonorProfile = async (
    token: string,
    payload: {
        bloodGroup?: string;
        sex?: string;
        zone?: string;
        position?: { latitude: number; longitude: number };
    }
): Promise<DonorProfile> => {
    const response = await axios.post(
        `${API_BASE_URL}/donors/register`,
        {
            bloodGroup: payload.bloodGroup || 'O+',
            sex: payload.sex || 'homme',
            zone: payload.zone || 'Tunis',
            position: payload.position || { latitude: 36.8065, longitude: 10.1815 },
            available: true,
            consent: true,
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getUpcomingEvents = async (
    token: string,
    params?: { lat?: number; lng?: number; maxDistanceKm?: number; governorate?: string }
): Promise<BloodEvent[]> => {
    try {
        // Nettoyage des parametres pour ne pas bloquer la requete SQL
        const cleanParams: Record<string, any> = {};
        if (params?.governorate && params.governorate.trim() !== '') {
            cleanParams.governorate = params.governorate;
        }
        if (params?.lat && params?.lng) {
            cleanParams.lat = params.lat;
            cleanParams.lng = params.lng;
            if (params.maxDistanceKm) {
                cleanParams.maxDistanceKm = params.maxDistanceKm;
            }
        }

        const response = await axios.get(`${API_BASE_URL}/events`, {
            headers: { Authorization: `Bearer ${token}` },
            params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined,
        });

        const rawEvents = Array.isArray(response.data) ? response.data : [];

        // Normalisation des donnees envoyees par PostgreSQL
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
            // Convertit ["09:00-11:00", ...] en [{ time: "09:00-11:00", capacity: X }] si necessaire
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
        console.error('Erreur lors du chargement des événements depuis NestJS:', error.response?.data || error.message);
        throw error;
    }
};

export const registerToEvent = async (
    token: string,
    eventId: string,
    slot: string
): Promise<EventRegistrationResponse> => {
    const response = await axios.post(
        `${API_BASE_URL}/events/${eventId}/register`,
        { slot },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};