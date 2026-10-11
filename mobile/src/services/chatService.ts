import axios from 'axios';
import { Platform } from 'react-native';

// ⚠️ En React Native, localhost ne fonctionne pas toujours sur l'émulateur Android.
// On utilise 10.0.2.2 pour Android et localhost pour iOS.
const AI_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8001' : 'http://localhost:8001';

export interface ChatMessageRequest {
    message: string;
    language?: string;
    session_id?: string;
}

export interface ChatSource {
    id: string;
    title: string;
}

export interface ChatMessageResponse {
    answer: string;
    language: string;
    intent: string;
    sources?: ChatSource[];
    needs_staff: boolean;
    disclaimer: string;
}

export const sendChatMessage = async (
    message: string,
    sessionId?: string
): Promise<ChatMessageResponse> => {
    try {
        const payload: ChatMessageRequest = {
            message,
            language: 'auto',
            session_id: sessionId,
        };

        // 🔒 Conformité Règle N°5 : Aucune donnée patient/santé n'est ajoutée au payload.
        const response = await axios.post<ChatMessageResponse>(`${AI_API_BASE_URL}/chat`, payload);
        return response.data;
    } catch (error: any) {
        console.error('Erreur API Chatbot AI:', error?.message);
        throw new Error("L'assistant est actuellement indisponible. Veuillez réessayer plus tard.");
    }
};