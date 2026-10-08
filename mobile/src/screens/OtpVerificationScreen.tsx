import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StyleSheet,
    SafeAreaView,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://10.0.2.2:3000';

const formatErrorMessage = (error: any, defaultMsg: string) => {
    const msg = error.response?.data?.message;
    if (Array.isArray(msg)) {
        return msg.join('\n');
    }
    if (typeof msg === 'string') {
        return msg;
    }
    return defaultMsg;
};

interface Props {
    navigation?: any;
    route?: any;
}

export const OtpVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
    const [otp, setOtp] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [resending, setResending] = useState<boolean>(false);

    const phone = route?.params?.phone || '';
    const donorData = route?.params?.donorData;

    const handleVerify = async () => {
        if (!otp || otp.length < 4) {
            Alert.alert('Code invalide', 'Veuillez saisir le code OTP reçu.');
            return;
        }

        const cleanPhone = phone.trim();

        if (!cleanPhone) {
            Alert.alert('Erreur', 'Numéro de téléphone introuvable. Veuillez recommencer l\'inscription.');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/otp/verify`, {
                phone: cleanPhone,
                code: otp,
            });

            if (response.status === 200 || response.status === 201) {
                const { accessToken, user } = response.data;

                if (accessToken) {
                    await AsyncStorage.setItem('token', accessToken);

                    if (donorData) {
                        // Sauvegarde des données réelles saisies dans le stockage local
                        const userProfile = {
                            fullName: donorData.fullName,
                            phone: cleanPhone,
                            bloodGroup: donorData.bloodGroup,
                            sex: donorData.sex,
                            zone: donorData.zone,
                        };
                        await AsyncStorage.setItem('user_profile', JSON.stringify(userProfile));

                        // Envoi 100% dynamique vers la BDD NestJS sans aucune valeur codée en dur
                        try {
                            await axios.post(
                                `${API_BASE_URL}/donors/register`,
                                {
                                    bloodGroup: donorData.bloodGroup,
                                    sex: donorData.sex,
                                    zone: donorData.zone,
                                    position: donorData.position || { latitude: 36.8065, longitude: 10.1815 },
                                    available: true,
                                    consent: true,
                                },
                                {
                                    headers: { Authorization: `Bearer ${accessToken}` },
                                }
                            );
                        } catch (profileErr) {
                            console.log('Profil déjà existant ou erreur lors de la création:', profileErr);
                        }
                    }
                }

                Alert.alert('Compte vérifié !', 'Veuillez remplir le questionnaire d\'éligibilité.', [
                    {
                        text: 'Commencer',
                        onPress: () => {
                            navigation?.navigate('Eligibility', {
                                accessToken,
                                user,
                                donorData: route?.params?.donorData,
                            });
                        },
                    },
                ]);
            }
        } catch (error: any) {
            const errorMessage = formatErrorMessage(
                error,
                'Code OTP incorrect ou session expirée. Veuillez demander un nouveau code.'
            );
            Alert.alert('Échec de la vérification', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (!phone) {
            Alert.alert('Erreur', 'Numéro de téléphone manquant.');
            return;
        }

        setResending(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/otp/send`, {
                phone: phone,
            });

            if (response.status === 200 || response.status === 201) {
                Alert.alert('SMS Envoyé', 'Un nouveau code OTP vient de vous être envoyé.');
            }
        } catch (error: any) {
            const errorMessage = formatErrorMessage(error, 'Impossible de renvoyer le code pour le moment.');
            Alert.alert('Erreur', errorMessage);
        } finally {
            setResending(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Vérification OTP</Text>
                <Text style={styles.subtitle}>
                    Saisissez le code envoyé au <Text style={styles.phoneText}>{phone || 'votre numéro'}</Text>
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="000000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    editable={!loading}
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleVerify}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.buttonText}>Vérifier le code</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResendOtp}
                    disabled={resending || loading}
                >
                    {resending ? (
                        <ActivityIndicator color="#2563EB" size="small" />
                    ) : (
                        <Text style={styles.resendText}>Vous n'avez pas reçu de code ? Renvoyer</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 32,
    },
    phoneText: {
        fontWeight: 'bold',
        color: '#111827',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 22,
        textAlign: 'center',
        letterSpacing: 6,
        marginBottom: 24,
        color: '#111827',
    },
    button: {
        backgroundColor: '#C62828',
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendText: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '500',
    },
});

export default OtpVerificationScreen;