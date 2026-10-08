import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    Alert,
    ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://10.0.2.2:3000';

type BloodGroup = 'A' | 'B' | 'AB' | 'O';
type RhFactor = '+' | '-';
type SexType = 'homme' | 'femme';

const BLOOD_GROUPS: BloodGroup[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['+', '-'];

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

const BloodBagIllustration = ({ bloodType }: { bloodType: string }) => {
    return (
        <View style={bagStyles.container}>
            <View style={bagStyles.topHook} />
            <View style={bagStyles.bagBody}>
                <View style={bagStyles.bloodLiquid} />
                <View style={bagStyles.labelCard}>
                    <Text style={bagStyles.labelText}>{bloodType}</Text>
                </View>
            </View>
            <View style={bagStyles.bottomTube} />
        </View>
    );
};

export default function AuthScreen({ navigation }: any) {
    const [isLogin, setIsLogin] = useState(false);
    const [loading, setLoading] = useState(false);

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    // Champs requis pour le profil donneur NestJS
    const [sex, setSex] = useState<SexType>('homme');
    const [zone, setZone] = useState('Tunis');

    const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('B');
    const [selectedRh, setSelectedRh] = useState<RhFactor>('+');
    const [unknownBloodType, setUnknownBloodType] = useState(false);

    const fullBloodType = unknownBloodType ? '?' : `${selectedGroup}${selectedRh}`;
    const bloodGroupToSubmit = unknownBloodType ? 'O+' : `${selectedGroup}${selectedRh}`;

    const handleSubmit = async () => {
        const cleanPhone = phone.trim();

        if (isLogin) {
            // --- CONNEXION (POST /auth/login) ---
            if (!cleanPhone || !password.trim()) {
                Alert.alert('Champs incomplets', 'Veuillez saisir votre numéro de téléphone et votre mot de passe.');
                return;
            }

            setLoading(true);
            try {
                const response = await axios.post(`${API_BASE_URL}/auth/login`, {
                    phone: cleanPhone,
                    password: password.trim(),
                });

                if (response.status === 200 || response.status === 201) {
                    const token = response.data?.accessToken || response.data?.token;
                    const user = response.data?.user;

                    if (token) {
                        await AsyncStorage.setItem('token', token);
                    }

                    const userProfile = {
                        fullName: user?.fullName || fullName || `Utilisateur (${cleanPhone})`,
                        phone: cleanPhone,
                        bloodGroup: user?.bloodGroup || user?.bloodType || bloodGroupToSubmit,
                    };
                    await AsyncStorage.setItem('user_profile', JSON.stringify(userProfile));

                    Alert.alert('Connexion réussie', `Bienvenue !`);
                    navigation?.navigate('Home');
                }
            } catch (error: any) {
                const errorMessage = formatErrorMessage(error, 'Identifiants incorrects ou serveur injoignable.');
                Alert.alert('Échec de connexion', errorMessage);
            } finally {
                setLoading(false);
            }
        } else {
            // --- INSCRIPTION (POST /auth/register) ---
            if (!fullName.trim() || !cleanPhone || !password.trim() || !zone.trim()) {
                Alert.alert('Champs requis', 'Veuillez remplir le nom, le téléphone, la zone et le mot de passe.');
                return;
            }

            setLoading(true);

            // Payload dynamique complet transmis à OtpVerification
            const payload = {
                phone: cleanPhone,
                password: password.trim(),
                fullName: fullName.trim(),
                role: 'donneur',
                email: email.trim(),
                bloodGroup: bloodGroupToSubmit,
                sex,
                zone: zone.trim(),
                position: { latitude: 36.8065, longitude: 10.1815 },
            };

            try {
                const response = await axios.post(`${API_BASE_URL}/auth/register`, {
                    phone: payload.phone,
                    password: payload.password,
                    fullName: payload.fullName,
                    role: payload.role,
                });

                if (response.status === 201 || response.status === 200) {
                    Alert.alert(
                        'Code OTP envoyé !',
                        `Un code de vérification SMS a été envoyé au ${cleanPhone}.`,
                        [
                            {
                                text: 'Saisir le code OTP',
                                onPress: () => {
                                    navigation.navigate('OtpVerification', {
                                        phone: cleanPhone,
                                        donorData: payload,
                                    });
                                },
                            },
                        ]
                    );
                }
            } catch (error: any) {
                const errorMessage = formatErrorMessage(error, "Une erreur est survenue lors de l'inscription.");
                Alert.alert("Échec de l'inscription", errorMessage);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <ImageBackground
            source={require('../assets/damm_pattern.jpg')}
            style={styles.backgroundImage}
            resizeMode="repeat"
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.cardContainer}>
                        <View style={styles.header}>
                            <Text style={styles.brandTitle}>Damm</Text>
                            <Text style={styles.brandSubtitle}>
                                {isLogin ? 'Bon retour parmi nous' : 'Chaque goutte compte'}
                            </Text>
                        </View>

                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, isLogin && styles.toggleActive]}
                                onPress={() => setIsLogin(true)}
                            >
                                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                                    Connexion
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleButton, !isLogin && styles.toggleActive]}
                                onPress={() => setIsLogin(false)}
                            >
                                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                                    Inscription
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Numéro de téléphone *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+21612345678"
                                placeholderTextColor="#888"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        </View>

                        {!isLogin && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nom complet *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Myriam Ben Ali"
                                        placeholderTextColor="#888"
                                        value={fullName}
                                        onChangeText={setFullName}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Adresse Email (optionnel)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="exemple@mail.com"
                                        placeholderTextColor="#888"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>

                                {/* Choix du Sexe */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Sexe *</Text>
                                    <View style={styles.selectorRow}>
                                        <TouchableOpacity
                                            style={[styles.selectorButton, sex === 'homme' && styles.selectorButtonActive]}
                                            onPress={() => setSex('homme')}
                                        >
                                            <Text style={[styles.selectorText, sex === 'homme' && styles.selectorTextActive]}>
                                                Homme
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.selectorButton, sex === 'femme' && styles.selectorButtonActive]}
                                            onPress={() => setSex('femme')}
                                        >
                                            <Text style={[styles.selectorText, sex === 'femme' && styles.selectorTextActive]}>
                                                Femme
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Choix de la Gouvernorat / Zone */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Gouvernorat / Ville *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Tunis, Ariana, Sousse..."
                                        placeholderTextColor="#888"
                                        value={zone}
                                        onChangeText={setZone}
                                    />
                                </View>

                                <View style={styles.bloodSection}>
                                    <Text style={styles.sectionTitle}>Votre groupe sanguin</Text>
                                    <BloodBagIllustration bloodType={fullBloodType} />

                                    <TouchableOpacity
                                        style={styles.unknownOptionRow}
                                        onPress={() => setUnknownBloodType(!unknownBloodType)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                unknownBloodType && styles.checkboxActive,
                                            ]}
                                        >
                                            {unknownBloodType && <Text style={styles.checkmark}>✓</Text>}
                                        </View>
                                        <Text style={styles.unknownOptionText}>
                                            Je ne connais pas mon groupe sanguin
                                        </Text>
                                    </TouchableOpacity>

                                    {!unknownBloodType && (
                                        <>
                                            <View style={styles.selectorRow}>
                                                {BLOOD_GROUPS.map((group) => {
                                                    const isSelected = selectedGroup === group;
                                                    return (
                                                        <TouchableOpacity
                                                            key={group}
                                                            style={[
                                                                styles.selectorButton,
                                                                isSelected && styles.selectorButtonActive,
                                                            ]}
                                                            onPress={() => setSelectedGroup(group)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.selectorText,
                                                                    isSelected && styles.selectorTextActive,
                                                                ]}
                                                            >
                                                                {group}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>

                                            <View style={styles.selectorRow}>
                                                {RH_FACTORS.map((rh) => {
                                                    const isSelected = selectedRh === rh;
                                                    return (
                                                        <TouchableOpacity
                                                            key={rh}
                                                            style={[
                                                                styles.selectorButton,
                                                                isSelected && styles.selectorButtonActive,
                                                            ]}
                                                            onPress={() => setSelectedRh(rh)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.selectorText,
                                                                    isSelected && styles.selectorTextActive,
                                                                ]}
                                                            >
                                                                {rh}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </>
                                    )}
                                </View>
                            </>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mot de passe *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#888"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        {isLogin && (
                            <TouchableOpacity style={styles.forgotPassButton}>
                                <Text style={styles.forgotPassText}>Mot de passe oublié ?</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, loading && { opacity: 0.7 }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>
                                    {isLogin ? 'Se Connecter' : "S'inscrire"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const bagStyles = StyleSheet.create({
    container: { alignItems: 'center', marginVertical: 10 },
    topHook: { width: 28, height: 14, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 3, borderColor: '#B0BEC5', borderBottomWidth: 0 },
    bagBody: { width: 110, height: 135, borderRadius: 20, borderWidth: 3, borderColor: '#B0BEC5', backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
    bloodLiquid: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', backgroundColor: '#C62828', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
    labelCard: { width: 62, height: 52, backgroundColor: '#FFFFFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3, zIndex: 2 },
    labelText: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
    bottomTube: { width: 14, height: 10, backgroundColor: '#B0BEC5', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
});

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    container: { flex: 1 },
    scrollContainer: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 24, justifyContent: 'center' },
    cardContainer: { backgroundColor: 'rgba(255, 255, 255, 0.94)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 6 },
    header: { alignItems: 'center', marginBottom: 14 },
    brandTitle: { fontSize: 34, fontWeight: '900', color: '#C62828', letterSpacing: 1 },
    brandSubtitle: { fontSize: 14, color: '#64748B', marginTop: 2 },
    toggleContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4, marginBottom: 16 },
    toggleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleActive: { backgroundColor: '#1E293B' },
    toggleText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#FFFFFF' },
    inputGroup: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#0F172A' },
    bloodSection: { marginVertical: 6, alignItems: 'center' },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', alignSelf: 'flex-start', marginBottom: 4 },
    unknownOptionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, alignSelf: 'flex-start' },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#64748B', justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: '#FFFFFF' },
    checkboxActive: { backgroundColor: '#C62828', borderColor: '#C62828' },
    checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
    unknownOptionText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    selectorRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, marginVertical: 4, width: '100%' },
    selectorButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 7 },
    selectorButtonActive: { backgroundColor: '#C62828' },
    selectorText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
    selectorTextActive: { color: '#FFFFFF' },
    forgotPassButton: { alignSelf: 'flex-end', marginBottom: 14 },
    forgotPassText: { fontSize: 13, color: '#C62828', fontWeight: '600' },
    submitButton: { backgroundColor: '#C62828', paddingVertical: 14, borderRadius: 25, alignItems: 'center', marginTop: 10, shadowColor: '#C62828', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});