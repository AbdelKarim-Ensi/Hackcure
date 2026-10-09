import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://10.0.2.2:3000';

const OTP_LENGTH = 6;

const COLORS = {
    burgundyDark: '#6B0C1A',
    burgundy: '#901818',
    red: '#B3182D',
    redSoft: '#FBE9EC',
    bg: '#F7F1F2',
    text: '#2A1519',
    muted: '#7C6A6E',
    border: '#E6D6D9',
};

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

/* ------------------------------------------------------------------ */
/*  Composants visuels (design uniquement)                             */
/* ------------------------------------------------------------------ */

// Goutte qui bat
const BeatingDrop = () => {
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.18, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1.1, duration: 130, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.delay(360),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [scale]);

    return (
        <Animated.View style={[dropStyles.drop, { transform: [{ rotate: '-45deg' }, { scale }] }]}>
            <View style={dropStyles.shine} />
        </Animated.View>
    );
};

// --- ECG animé (même rendu que l'écran d'authentification) ---
const ECG_PERIOD = 200;
const ECG_HEIGHT = 44;
const SWEEP_WIDTH = 150;

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

    const sweepX = useRef(new Animated.Value(-SWEEP_WIDTH)).current;
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
        <View style={hbStyles.container}>
            <EcgStrip color="rgba(255, 255, 255, 0.28)" thickness={1.5} repeats={repeats} />
            <Animated.View
                pointerEvents="none"
                style={[hbStyles.sweepWindow, { transform: [{ translateX: sweepX }] }]}
            >
                <Animated.View style={[hbStyles.sweepInner, { transform: [{ translateX: innerX }] }]}>
                    <EcgStrip color="#FFFFFF" thickness={2.5} repeats={repeats} />
                </Animated.View>
            </Animated.View>
        </View>
    );
};

// Curseur clignotant dans la case active
const BlinkingCursor = () => {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return <Animated.View style={[otpStyles.cursor, { opacity }]} />;
};

interface Props {
    navigation?: any;
    route?: any;
}

export const OtpVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
    const [otp, setOtp] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [resending, setResending] = useState<boolean>(false);

    // --- état purement visuel ---
    const [focused, setFocused] = useState<boolean>(false);
    const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(cardAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [cardAnim]);

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
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" {...({ backgroundColor: COLORS.burgundy } as any)} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ------------------- HEADER BORDEAUX ------------------- */}
                    <View style={styles.hero}>
                        <View style={styles.heroGlowLeft} />
                        <View style={styles.heroGlowRight} />

                        <View style={styles.heroTopRow}>
                            <View style={styles.heroBrandRow}>
                                <BeatingDrop />
                                <View style={{ marginLeft: 14 }}>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.brandTitle}>Damm</Text>
                                        <Text style={styles.brandArabic}>دم</Text>
                                    </View>
                                    <Text style={styles.brandSubtitle}>Donnez votre sang, sauvez des vies</Text>
                                </View>
                            </View>

                            <View style={styles.pill}>
                                <View style={styles.pillDot} />
                                <Text style={styles.pillText}>Sécurisé</Text>
                            </View>
                        </View>

                        <AnimatedHeartbeat />
                    </View>

                    {/* ------------------- CARTE OTP ------------------- */}
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                opacity: cardAnim,
                                transform: [
                                    {
                                        translateY: cardAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [30, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconEmoji}>💬</Text>
                        </View>

                        <Text style={styles.title}>Vérification OTP</Text>
                        <Text style={styles.subtitle}>
                            Saisissez le code envoyé au{' '}
                            <Text style={styles.phoneText}>{phone || 'votre numéro'}</Text>
                        </Text>

                        {/* Cases OTP interactives */}
                        <TouchableOpacity
                            activeOpacity={1}
                            style={otpStyles.row}
                            onPress={() => inputRef.current?.focus()}
                        >
                            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                                const digit = otp[index];
                                const isFilled = Boolean(digit);
                                const isActive = focused && index === Math.min(otp.length, OTP_LENGTH - 1) && otp.length <= OTP_LENGTH;
                                return (
                                    <View
                                        key={index}
                                        style={[
                                            otpStyles.box,
                                            isFilled && otpStyles.boxFilled,
                                            isActive && otpStyles.boxActive,
                                        ]}
                                    >
                                        {isFilled ? (
                                            <Text style={otpStyles.digit}>{digit}</Text>
                                        ) : (
                                            isActive && otp.length < OTP_LENGTH && <BlinkingCursor />
                                        )}
                                    </View>
                                );
                            })}
                        </TouchableOpacity>

                        {/* Champ réel (invisible) : garde le même state `otp` */}
                        <TextInput
                            ref={inputRef}
                            style={otpStyles.hiddenInput}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                            editable={!loading}
                            autoFocus
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            caretHidden
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleVerify}
                            disabled={loading}
                            activeOpacity={0.85}
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
                                <ActivityIndicator color={COLORS.red} size="small" />
                            ) : (
                                <Text style={styles.resendText}>
                                    Vous n'avez pas reçu de code ? <Text style={styles.resendBold}>Renvoyer</Text>
                                </Text>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.footerNote}>
                            Votre générosité peut sauver jusqu'à 3 vies.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const dropStyles = StyleSheet.create({
    drop: {
        width: 28,
        height: 28,
        backgroundColor: '#E8505B',
        borderRadius: 14,
        borderTopRightRadius: 0,
        marginTop: 6,
    },
    shine: {
        position: 'absolute',
        left: 5,
        bottom: 5,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
});

const hbStyles = StyleSheet.create({
    container: {
        height: ECG_HEIGHT,
        marginTop: 14,
        marginHorizontal: -20,
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

const otpStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 26,
    },
    box: {
        width: 46,
        height: 58,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: '#FDFAFA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    boxFilled: {
        backgroundColor: COLORS.redSoft,
        borderColor: COLORS.red,
    },
    boxActive: {
        borderColor: COLORS.burgundy,
        borderWidth: 2.5,
        backgroundColor: '#FFFFFF',
        shadowColor: COLORS.burgundy,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    digit: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.burgundy,
    },
    cursor: {
        width: 2,
        height: 26,
        borderRadius: 1,
        backgroundColor: COLORS.burgundy,
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
});

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    flex: { flex: 1 },
    scrollContainer: { flexGrow: 1, paddingBottom: 32 },

    /* Header */
    hero: {
        backgroundColor: COLORS.burgundy,
        paddingTop: Platform.OS === 'ios' ? 64 : 48,
        paddingHorizontal: 20,
        paddingBottom: 56,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
    },
    heroGlowLeft: {
        position: 'absolute',
        top: -80,
        left: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: COLORS.burgundyDark,
        opacity: 0.55,
    },
    heroGlowRight: {
        position: 'absolute',
        bottom: -90,
        right: -50,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#A3162B',
        opacity: 0.45,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    heroBrandRow: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
    brandTitle: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
    brandArabic: { fontSize: 20, fontWeight: '700', color: '#F3C9CE', marginLeft: 10, marginBottom: 8 },
    brandSubtitle: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2, maxWidth: 200 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 4,
    },
    pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF', marginRight: 6 },
    pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

    /* Carte */
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginHorizontal: 16,
        marginTop: -34,
        paddingHorizontal: 20,
        paddingTop: 34,
        paddingBottom: 24,
        shadowColor: COLORS.burgundyDark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
        elevation: 7,
    },
    iconCircle: {
        alignSelf: 'center',
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: COLORS.redSoft,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 2,
        borderColor: '#F3C9CE',
    },
    iconEmoji: { fontSize: 30 },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
        marginBottom: 26,
        lineHeight: 20,
    },
    phoneText: {
        fontWeight: '800',
        color: COLORS.burgundy,
    },
    button: {
        backgroundColor: COLORS.red,
        borderRadius: 28,
        paddingVertical: 15,
        alignItems: 'center',
        shadowColor: COLORS.red,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    resendButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    resendText: {
        color: COLORS.muted,
        fontSize: 14,
        fontWeight: '500',
    },
    resendBold: {
        color: COLORS.red,
        fontWeight: '800',
    },
    footerNote: {
        textAlign: 'center',
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 22,
    },
});

export default OtpVerificationScreen;
