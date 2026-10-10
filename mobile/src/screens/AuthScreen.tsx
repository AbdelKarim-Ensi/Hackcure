import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
    FlatList,
    Dimensions,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://10.0.2.2:3000';

type BloodGroup = 'A' | 'B' | 'AB' | 'O';
type RhFactor = '+' | '-';
type SexType = 'homme' | 'femme';

const BLOOD_GROUPS: BloodGroup[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['+', '-'];

const TUNISIAN_GOVERNORATES = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Bizerte',
    'Zaghouan', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
    'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
];

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

const formatToTunisianE164 = (rawPhone: string): string => {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('216')) {
        return `+${digits}`;
    }
    return `+216${digits}`;
};

// ------------------------------------------------------------------
// 💓 COMPOSANT HEART RATE ANIMÉ FAÇON ECG (BALAYAGE LUMINEUX)
// ------------------------------------------------------------------
const ECG_PERIOD = 200;   // Largeur d'un battement
const ECG_HEIGHT = 44;    // Hauteur de la zone
const SWEEP_WIDTH = 150;  // Largeur de la partie lumineuse qui défile

// Points d'un battement (x, y) : ligne plate, petite bosse P, pic QRS, bosse T
const ECG_POINTS: [number, number][] = [
    [0, 22], [40, 22], [46, 18], [52, 22], [70, 22],
    [76, 27], [83, 4], [91, 40], [97, 22], [120, 22],
    [130, 16], [140, 22], [200, 22],
];

const EcgPeriod = ({ color, thickness }: { color: string; thickness: number }) => (
    <View style={{ width: ECG_PERIOD, height: ECG_HEIGHT }}>
        {ECG_POINTS.slice(0, -1).map(([x1, y1], i) => {
            const [x2, y2] = ECG_POINTS[i + 1];
            const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            return (
                <View
                    key={i}
                    style={{
                        position: 'absolute',
                        left: (x1 + x2) / 2 - len / 2,
                        top: (y1 + y2) / 2 - thickness / 2,
                        width: len,
                        height: thickness,
                        borderRadius: thickness / 2,
                        backgroundColor: color,
                        transform: [{ rotate: `${angle}rad` }],
                    }}
                />
            );
        })}
    </View>
);

const EcgStrip = ({ color, thickness, repeats }: { color: string; thickness: number; repeats: number }) => (
    <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: repeats }).map((_, i) => (
            <EcgPeriod key={i} color={color} thickness={thickness} />
        ))}
    </View>
);

const AnimatedHeartbeat = () => {
    const screenWidth = Dimensions.get('window').width;
    const repeats = Math.ceil(screenWidth / ECG_PERIOD) + 1;

    // Position de la "fenêtre lumineuse" qui balaie le tracé de gauche à droite
    const sweepX = useRef(new Animated.Value(-SWEEP_WIDTH)).current;
    // La bande blanche à l'intérieur se déplace en sens inverse pour rester alignée sur le tracé
    const innerX = useRef(Animated.multiply(sweepX, -1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(sweepX, {
                    toValue: screenWidth,
                    duration: 2400,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.delay(300),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [sweepX, screenWidth]);

    return (
        <View style={heartbeatStyles.container}>
            {/* Tracé ECG discret (fixe) */}
            <EcgStrip color="rgba(255, 255, 255, 0.28)" thickness={1.5} repeats={repeats} />

            {/* Partie lumineuse blanche qui défile sur le tracé */}
            <Animated.View
                pointerEvents="none"
                style={[heartbeatStyles.sweepWindow, { transform: [{ translateX: sweepX }] }]}
            >
                <Animated.View style={[heartbeatStyles.sweepInner, { transform: [{ translateX: innerX }] }]}>
                    <EcgStrip color="#FFFFFF" thickness={2.5} repeats={repeats} />
                </Animated.View>
            </Animated.View>
        </View>
    );
};

// 🩸 Composant de poche de sang stylisée
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

    // Formulaire
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [sex, setSex] = useState<SexType>('homme');
    const [zone, setZone] = useState('Tunis');
    const [isZoneModalVisible, setIsZoneModalVisible] = useState(false);

    // Groupe sanguin
    const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('B');
    const [selectedRh, setSelectedRh] = useState<RhFactor>('+');
    const [unknownBloodType, setUnknownBloodType] = useState(false);

    const fullBloodType = unknownBloodType ? '?' : `${selectedGroup}${selectedRh}`;
    const bloodGroupToSubmit = unknownBloodType ? 'O+' : `${selectedGroup}${selectedRh}`;

    const handleSubmit = async () => {
        const cleanDigits = phone.replace(/\D/g, '');
        if (!cleanDigits) {
            Alert.alert('Numéro invalide', 'Veuillez saisir un numéro de téléphone valide.');
            return;
        }

        const cleanPhone = formatToTunisianE164(phone);

        if (isLogin) {
            // --- CONNEXION ---
            if (!cleanPhone || !password.trim()) {
                Alert.alert('⚠️ Champs incomplets', 'Veuillez saisir votre numéro de téléphone et votre mot de passe.');
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
                        await AsyncStorage.setItem('userId', response.data?.userId || '');

                        const savedPhoneProfileStr = await AsyncStorage.getItem(`user_profile_${cleanPhone}`);
                        const savedPhoneProfile = savedPhoneProfileStr ? JSON.parse(savedPhoneProfileStr) : null;

                        const finalProfile = {
                            fullName: (savedPhoneProfile?.fullName && savedPhoneProfile.fullName !== 'Amine Ben Salah')
                                ? savedPhoneProfile.fullName
                                : (user?.fullName || fullName || `Utilisateur (${cleanPhone})`),
                            phone: cleanPhone,
                            bloodGroup: savedPhoneProfile?.bloodGroup || user?.bloodGroup || bloodGroupToSubmit,
                            sex: savedPhoneProfile?.sex || sex || 'homme',
                            zone: savedPhoneProfile?.zone || user?.zone || 'Tunis',
                            maxRadiusKm: savedPhoneProfile?.maxRadiusKm || 20,
                            available: savedPhoneProfile?.available ?? true,
                        };

                        await AsyncStorage.setItem('user_profile', JSON.stringify(finalProfile));
                        await AsyncStorage.setItem(`user_profile_${cleanPhone}`, JSON.stringify(finalProfile));

                        Alert.alert('✅ Connexion réussie', `Bienvenue ${finalProfile.fullName} !`);
                        navigation?.navigate('Home');
                    }
                }
            } catch (error: any) {
                const errorMessage = formatErrorMessage(error, 'Identifiants incorrects ou serveur injoignable.');
                Alert.alert('❌ Échec de connexion', errorMessage);
            } finally {
                setLoading(false);
            }
        } else {
            // --- INSCRIPTION ---
            if (!fullName.trim() || !cleanPhone || !password.trim() || !zone.trim()) {
                Alert.alert('⚠️ Champs requis', 'Veuillez remplir tous les champs obligatoires.');
                return;
            }

            setLoading(true);

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
                        '📱 Code OTP envoyé !',
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
                Alert.alert("❌ Échec de l'inscription", errorMessage);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <View style={styles.mainWrapper}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* EN-TÊTE CHARLES NICOLLE AVEC ECG ANIMÉ */}
                    <View style={headerStyles.headerBanner}>
                        <View style={headerStyles.topRow}>
                            <View style={headerStyles.brandContainer}>
                                <Text style={headerStyles.dropIcon}>🩸</Text>
                                <Text style={headerStyles.brandTitle}>Damm</Text>
                                <Text style={headerStyles.arabicTitle}>دمّ</Text>
                            </View>
                            <View style={headerStyles.liveBadge}>
                                <View style={headerStyles.liveDot} />
                                <Text style={headerStyles.liveText}>En direct</Text>
                            </View>
                        </View>

                        <Text style={headerStyles.brandSubtitle}>
                            Chaque goutte compte.
                        </Text>

                        {/* Heart rate animé façon ECG */}
                        <AnimatedHeartbeat />
                    </View>

                    {/* CARTE FORMULAIRE */}
                    <View style={styles.cardContainer}>
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

                        {/* TÉLÉPHONE (+216 OBLIGATOIRE) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Numéro de téléphone *</Text>
                            <View style={phoneInputStyles.container}>
                                <View style={phoneInputStyles.prefixBadge}>
                                    <Text style={phoneInputStyles.flag}>🇹🇳</Text>
                                    <Text style={phoneInputStyles.prefixText}>+216</Text>
                                </View>
                                <TextInput
                                    style={phoneInputStyles.input}
                                    placeholder="12345678"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={phone.replace(/^\+216/, '')}
                                    onChangeText={(val) => setPhone(val)}
                                />
                            </View>
                        </View>

                        {!isLogin && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nom complet *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Myriam Ben Ali"
                                        placeholderTextColor="#94A3B8"
                                        value={fullName}
                                        onChangeText={setFullName}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Adresse Email (optionnel)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="exemple@mail.com"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>

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

                                {/* LISTE DÉROULANTE GOUVERNORAT */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Gouvernorat / Ville *</Text>
                                    <TouchableOpacity
                                        style={dropdownStyles.pickerButton}
                                        onPress={() => setIsZoneModalVisible(true)}
                                    >
                                        <Text style={dropdownStyles.pickerText}>{zone || 'Sélectionner un gouvernorat'}</Text>
                                        <Text style={dropdownStyles.arrow}>▼</Text>
                                    </TouchableOpacity>
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
                                placeholderTextColor="#94A3B8"
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

            {/* MODAL GOUVERNORATS */}
            <Modal
                visible={isZoneModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsZoneModalVisible(false)}
            >
                <TouchableOpacity
                    style={dropdownStyles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsZoneModalVisible(false)}
                >
                    <View style={dropdownStyles.modalContainer}>
                        <Text style={dropdownStyles.modalTitle}>Sélectionner votre Gouvernorat</Text>
                        <FlatList
                            data={TUNISIAN_GOVERNORATES}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        dropdownStyles.itemRow,
                                        zone === item && dropdownStyles.itemRowSelected,
                                    ]}
                                    onPress={() => {
                                        setZone(item);
                                        setIsZoneModalVisible(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            dropdownStyles.itemText,
                                            zone === item && dropdownStyles.itemTextSelected,
                                        ]}
                                    >
                                        {item}
                                    </Text>
                                    {zone === item && <Text style={dropdownStyles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// --- STYLES BATTEMENT DE CŒUR ---
const heartbeatStyles = StyleSheet.create({
    container: {
        height: ECG_HEIGHT,
        marginTop: 12,
        marginHorizontal: -20, // pleine largeur du header (compense paddingHorizontal: 20)
        overflow: 'hidden',
    },
    sweepWindow: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SWEEP_WIDTH,
        height: ECG_HEIGHT,
        overflow: 'hidden',
    },
    sweepInner: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});

const headerStyles = StyleSheet.create({
    headerBanner: {
        backgroundColor: '#901818',
        paddingTop: Platform.OS === 'ios' ? 50 : 35,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropIcon: {
        fontSize: 26,
        marginRight: 8,
    },
    brandTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    arabicTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FCA5A5',
        marginLeft: 10,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#4ADE80',
        marginRight: 6,
    },
    liveText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    brandSubtitle: {
        fontSize: 13,
        color: '#FECACA',
        marginTop: 4,
        letterSpacing: 0.2,
    },
});

const phoneInputStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        overflow: 'hidden',
    },
    prefixBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRightWidth: 1,
        borderRightColor: '#CBD5E1',
    },
    flag: {
        fontSize: 16,
        marginRight: 6,
    },
    prefixText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    input: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
    },
});

const dropdownStyles = StyleSheet.create({
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    pickerText: {
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '500',
    },
    arrow: {
        fontSize: 12,
        color: '#64748B',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 16,
        textAlign: 'center',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemRowSelected: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    itemText: {
        fontSize: 16,
        color: '#334155',
    },
    itemTextSelected: {
        fontWeight: '700',
        color: '#901818',
    },
    checkmark: {
        color: '#901818',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

const bagStyles = StyleSheet.create({
    container: { alignItems: 'center', marginVertical: 10 },
    topHook: { width: 28, height: 14, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 3, borderColor: '#94A3B8', borderBottomWidth: 0 },
    bagBody: { width: 110, height: 135, borderRadius: 20, borderWidth: 3, borderColor: '#94A3B8', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
    bloodLiquid: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', backgroundColor: '#901818', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
    labelCard: { width: 62, height: 52, backgroundColor: '#FFFFFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3, zIndex: 2 },
    labelText: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
    bottomTube: { width: 14, height: 10, backgroundColor: '#94A3B8', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
});

const styles = StyleSheet.create({
    mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
    container: { flex: 1 },
    scrollContainer: { flexGrow: 1, paddingBottom: 30 },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 22,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    toggleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 18 },
    toggleButton: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 8 },
    toggleActive: { backgroundColor: '#901818' },
    toggleText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    toggleTextActive: { color: '#FFFFFF' },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
    bloodSection: { marginVertical: 8, alignItems: 'center' },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', alignSelf: 'flex-start', marginBottom: 6 },
    unknownOptionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, alignSelf: 'flex-start' },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#64748B', justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: '#FFFFFF' },
    checkboxActive: { backgroundColor: '#901818', borderColor: '#901818' },
    checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    unknownOptionText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    selectorRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, marginVertical: 4, width: '100%' },
    selectorButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 7 },
    selectorButtonActive: { backgroundColor: '#901818' },
    selectorText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
    selectorTextActive: { color: '#FFFFFF' },
    forgotPassButton: { alignSelf: 'flex-end', marginBottom: 14 },
    forgotPassText: { fontSize: 13, color: '#901818', fontWeight: '600' },
    submitButton: { backgroundColor: '#901818', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 12, shadowColor: '#901818', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
    submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },
});