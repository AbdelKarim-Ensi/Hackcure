import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Switch,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Modal,
    FlatList,
    Animated,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { DonorProfile } from '../types/events';
import { getDonorProfile, updateDonorProfile } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const TUNISIAN_GOVERNORATES = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
    'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
    'Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
    'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// 💓 COMPOSANT ECG ANIMÉ
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

    React.useEffect(() => {
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
            <EcgStrip color="rgba(255, 255, 255, 0.28)" thickness={1.5} repeats={repeats} />
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

export const ProfileScreen = ({ navigation }: Props) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);
    const [profile, setProfile] = useState<DonorProfile | null>(null);

    // ✏️ ÉTATS MODIFIABLES DU PROFIL
    const [fullName, setFullName] = useState<string>('');
    const [sex, setSex] = useState<'homme' | 'femme'>('homme');
    const [bloodGroup, setBloodGroup] = useState<string>('O+');
    const [available, setAvailable] = useState<boolean>(true);
    const [zone, setZone] = useState<string>('Tunis');
    const [maxRadiusKm, setMaxRadiusKm] = useState<string>('20');
    const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);

    const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
    const [calendarDate, setCalendarDate] = useState<Date>(new Date());

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            const storedToken = await AsyncStorage.getItem('token');
            if (!storedToken) {
                Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
                navigation.replace('Auth');
                return;
            }
            setToken(storedToken);

            const data = await getDonorProfile(storedToken);
            setProfile(data);

            setFullName(data.fullName || '');
            setSex((data.sex as 'homme' | 'femme') || 'homme');
            setBloodGroup(data.bloodGroup || 'O+');
            setAvailable(data.available ?? true);
            setZone(data.zone || 'Tunis');
            setMaxRadiusKm(data.maxRadiusKm ? String(data.maxRadiusKm) : '20');
            setAlertsEnabled(data.notifPrefs?.alertsEnabled ?? true);
        } catch (error: any) {
            console.error('Erreur profil:', error);
            Alert.alert('Erreur', 'Impossible de charger le profil.');
        } finally {
            setLoading(false);
        }
    }, [navigation]);

    // 🔒 Rechargement synchrone de l'état à chaque affichage
    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [loadProfile])
    );

    const handleSave = async () => {
        if (!token) return;

        if (!fullName.trim()) {
            Alert.alert('Champ requis', 'Veuillez renseigner votre nom et prénom.');
            return;
        }

        try {
            setSaving(true);
            const updated = await updateDonorProfile(token, {
                fullName: fullName.trim(),
                sex,
                bloodGroup,
                available,
                zone: zone.trim(),
                maxRadiusKm: parseInt(maxRadiusKm, 10) || 20,
                notifPrefs: {
                    alertsEnabled,
                    quietHours: profile?.notifPrefs?.quietHours || { start: '22:00', end: '07:00' },
                },
            });

            setProfile(updated);
            Alert.alert('Succès', 'Votre profil a été mis à jour avec succès.');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erreur lors de la sauvegarde.';
            Alert.alert('Erreur', Array.isArray(msg) ? msg.join('\n') : msg);
        } finally {
            setSaving(false);
        }
    };

    const parseDateString = (dateStr?: string | null): Date | null => {
        if (!dateStr) return null;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            return parsed;
        }
        return null;
    };

    const lastDonationDateObj = parseDateString(profile?.lastDonationDate);
    const reevalDateObj = parseDateString(profile?.reevalDate || profile?.nextDonationPossibleDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🔒 Statut par défaut : 'en_attente'
    const eligibilityStatus: 'eligible' | 'temporaire' | 'definitif' | 'en_attente' =
        profile?.eligibilityStatus || 'en_attente';

    let bannerStyle = styles.statusBannerWaiting;
    let textStyle = styles.textWaiting;
    let bannerMessage = "";

    if (eligibilityStatus === 'definitif') {
        bannerStyle = styles.statusBannerDefinitif;
        textStyle = styles.textDefinitif;
        bannerMessage = "❌ Inéligible définitivement au don de sang (الاستمارة مرفوضة نهائياً)";
    } else if (eligibilityStatus === 'en_attente') {
        bannerStyle = styles.statusBannerWaiting;
        textStyle = styles.textWaiting;
        bannerMessage = "⚠️ Questionnaire non rempli. Veuillez remplir la fiche d'éligibilité.";
    } else if (eligibilityStatus === 'temporaire') {
        if (reevalDateObj) {
            const isFinished = reevalDateObj <= today;
            if (isFinished) {
                bannerStyle = styles.statusBannerEligible;
                textStyle = styles.textEligible;
                bannerMessage = "🎉 Votre période d'inactivité est terminée ! Vous êtes éligible aujourd'hui.";
            } else {
                const formattedDate = reevalDateObj.toLocaleDateString('fr-FR');
                bannerStyle = styles.statusBannerWaiting;
                textStyle = styles.textWaiting;
                bannerMessage = `⏳ Inéligible temporairement. Prochain don possible le ${formattedDate}`;
            }
        } else {
            bannerStyle = styles.statusBannerWaiting;
            textStyle = styles.textWaiting;
            bannerMessage = "⏳ Inéligible temporairement. En attente de réévaluation médicale.";
        }
    } else if (eligibilityStatus === 'eligible') {
        if (reevalDateObj && reevalDateObj > today) {
            const formattedDate = reevalDateObj.toLocaleDateString('fr-FR');
            bannerStyle = styles.statusBannerWaiting;
            textStyle = styles.textWaiting;
            bannerMessage = `⏳ Prochain don possible le ${formattedDate}`;
        } else {
            bannerStyle = styles.statusBannerEligible;
            textStyle = styles.textEligible;
            bannerMessage = "🎉 Vous êtes éligible pour donner du sang aujourd'hui !";
        }
    }

    const changeMonth = (increment: number) => {
        const newDate = new Date(calendarDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCalendarDate(newDate);
    };

    const generateCalendarDays = () => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        let startingDay = firstDayOfMonth.getDay() - 1;
        if (startingDay === -1) startingDay = 6;

        const daysInMonth = lastDayOfMonth.getDate();
        const days = [];

        for (let i = 0; i < startingDay; i++) {
            days.push({ day: null, date: null, isEligible: false, isLastDonation: false, isToday: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            currentDate.setHours(0, 0, 0, 0);
            const currentTime = currentDate.getTime();

            const isLastDonation = Boolean(lastDonationDateObj && currentTime === lastDonationDateObj.getTime());

            // 🔒 CALCUL STRICT DES CASES DU CALENDRIER
            let isDayEligible = false;

            if (eligibilityStatus === 'definitif' || eligibilityStatus === 'en_attente') {
                isDayEligible = false; // ROUGE pour tout le mois
            } else if (eligibilityStatus === 'temporaire') {
                if (reevalDateObj) {
                    isDayEligible = currentTime >= reevalDateObj.getTime();
                } else {
                    isDayEligible = false; // ROUGE tant qu'aucune date n'est dépassée
                }
            } else if (eligibilityStatus === 'eligible') {
                if (reevalDateObj && currentTime < reevalDateObj.getTime()) {
                    isDayEligible = false;
                } else {
                    isDayEligible = true; // VERT
                }
            }

            days.push({
                day: i,
                date: currentDate,
                isEligible: isDayEligible,
                isLastDonation,
                isToday: currentTime === today.getTime(),
            });
        }

        return days;
    };

    const calendarDays = generateCalendarDays();

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#901818" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 🩸 BANNIÈRE PROFIL CHARLES NICOLLE */}
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

                    <View style={headerStyles.profileHeroCard}>
                        <View style={headerStyles.avatarBadge}>
                            <Text style={headerStyles.avatarText}>{bloodGroup || 'O+'}</Text>
                        </View>
                        <Text style={headerStyles.fullName}>{fullName || 'Donneur'}</Text>
                        <Text style={headerStyles.phoneText}>📞 {profile?.phone ? profile.phone : 'Non renseigné'}</Text>

                        {/* 🩸 BADGES COMPRENANT L'ÉLIGIBILITÉ DU DONNEUR */}
                        <View style={headerStyles.inlineBadges}>
                            <View style={headerStyles.subBadge}>
                                <Text style={headerStyles.subBadgeText}>Sexe: {sex}</Text>
                            </View>

                            {/* BADGE ÉLIGIBILITÉ DANS LA CARTE HERO */}
                            <View style={[
                                headerStyles.subBadge,
                                eligibilityStatus === 'eligible' && { backgroundColor: '#DCFCE7' },
                                eligibilityStatus === 'temporaire' && { backgroundColor: '#FEF3C7' },
                                eligibilityStatus === 'definitif' && { backgroundColor: '#FEE2E2' },
                                eligibilityStatus === 'en_attente' && { backgroundColor: '#E2E8F0' },
                            ]}>
                                <Text style={[
                                    headerStyles.subBadgeText,
                                    eligibilityStatus === 'eligible' && { color: '#15803D' },
                                    eligibilityStatus === 'temporaire' && { color: '#B45309' },
                                    eligibilityStatus === 'definitif' && { color: '#B91C1C' },
                                    eligibilityStatus === 'en_attente' && { color: '#475569' },
                                ]}>
                                    {eligibilityStatus === 'eligible' && '✅ Éligible'}
                                    {eligibilityStatus === 'temporaire' && '⏳ Temporaire'}
                                    {eligibilityStatus === 'definitif' && '❌ Définitif'}
                                    {eligibilityStatus === 'en_attente' && '⚠️ Non rempli'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <AnimatedHeartbeat />
                </View>

                {/* 📋 QUESTIONNAIRE D'ÉLIGIBILITÉ (M3) */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📋 Questionnaire d'Éligibilité (استمارة الأهلية)</Text>
                    <Text style={styles.questionnaireSubText}>
                        Mettez à jour vos informations médicales pour recalculer votre éligibilité.
                    </Text>

                    {eligibilityStatus === 'definitif' ? (
                        <View style={styles.lockedNotice}>
                            <Text style={styles.lockedNoticeText}>
                                🔒 Votre profil est inéligible de façon définitive. La re-soumission est bloquée conformément aux directives médicales.
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.questionnaireButton}
                            onPress={() => {
                                navigation.navigate('Eligibility' as any, {
                                    accessToken: token,
                                    user: profile,
                                });
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.questionnaireButtonText}>
                                {eligibilityStatus === 'en_attente'
                                    ? '📝 Remplir le questionnaire'
                                    : '🔄 Refaire le questionnaire d\'éligibilité'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 📅 CALENDRIER INTERACTIF & ÉLIGIBILITÉ */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📅 Calendrier d'Éligibilité au Don</Text>

                    <View style={[styles.statusBanner, bannerStyle]}>
                        <Text style={[styles.statusBannerTitle, textStyle]}>
                            {bannerMessage}
                        </Text>
                    </View>

                    <View style={styles.calendarHeader}>
                        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
                            <Text style={styles.monthNavText}>◄</Text>
                        </TouchableOpacity>
                        <Text style={styles.calendarTitle}>
                            {MONTH_NAMES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                        </Text>
                        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
                            <Text style={styles.monthNavText}>►</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.weekDaysRow}>
                        {DAYS_OF_WEEK.map((d) => (
                            <Text key={d} style={styles.weekDayText}>{d}</Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {calendarDays.map((item, index) => {
                            if (!item.day) {
                                return <View key={`empty-${index}`} style={styles.dayBoxEmpty} />;
                            }

                            return (
                                <View
                                    key={`day-${item.day}`}
                                    style={[
                                        styles.dayBox,
                                        item.isEligible ? styles.dayBoxEligible : styles.dayBoxIneligible,
                                        item.isLastDonation ? styles.dayBoxLastDonation : null,
                                        item.isToday ? styles.dayBoxToday : null,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.dayText,
                                            item.isEligible ? styles.dayTextEligible : styles.dayTextIneligible,
                                            item.isLastDonation ? styles.dayTextLastDonation : null,
                                            item.isToday ? styles.dayTextToday : null,
                                        ]}
                                    >
                                        {item.day}
                                    </Text>
                                    {item.isLastDonation ? (
                                        <Text style={styles.lastDonationIcon}>🩸</Text>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.legendContainer}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }]} />
                            <Text style={styles.legendText}>🟢 Dernier don (🩸) & Éligible</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#FEF2F2', borderColor: '#901818' }]} />
                            <Text style={styles.legendText}>🔴 Repos obligatoire / Inéligible</Text>
                        </View>
                    </View>
                </View>

                {/* ⚙️ INFORMATIONS PERSONNELLES & PRÉFÉRENCES (MODIFIABLES) */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>⚙️ Mes Informations & Préférences</Text>

                    {/* 🩸 CHAMP STATUT D'ÉLIGIBILITÉ EXPLICITE DANS LES INFORMATIONS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Statut d'Éligibilité Actuel</Text>
                        <View style={[
                            styles.eligibilityFieldBox,
                            eligibilityStatus === 'eligible' && styles.eligibilityBoxEligible,
                            eligibilityStatus === 'temporaire' && styles.eligibilityBoxTemporaire,
                            eligibilityStatus === 'definitif' && styles.eligibilityBoxDefinitif,
                            eligibilityStatus === 'en_attente' && styles.eligibilityBoxWaiting,
                        ]}>
                            <Text style={styles.eligibilityFieldTitle}>
                                {eligibilityStatus === 'eligible' && '✅ Éligible au don de sang'}
                                {eligibilityStatus === 'temporaire' && '⏳ Inéligible temporairement'}
                                {eligibilityStatus === 'definitif' && '❌ Inéligible définitivement'}
                                {eligibilityStatus === 'en_attente' && '⚠️ Questionnaire en attente'}
                            </Text>
                            <Text style={styles.eligibilityFieldSub}>
                                {eligibilityStatus === 'eligible' && 'Vous pouvez vous inscrire aux collectes et recevoir les alertes d’urgence.'}
                                {eligibilityStatus === 'temporaire' && (reevalDateObj ? `Prochaine réévaluation médicale possible le : ${reevalDateObj.toLocaleDateString('fr-FR')}` : 'Actuellement non éligible temporairement.')}
                                {eligibilityStatus === 'definitif' && 'Conformément aux règles du CNTS, le don vous est définitivement contre-indiqué.'}
                                {eligibilityStatus === 'en_attente' && 'Veuillez remplir le questionnaire d’éligibilité ci-dessus.'}
                            </Text>
                        </View>
                    </View>

                    {/* 👤 CHAMP NOM ET PRÉNOM */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Nom & Prénom</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Entrez votre nom complet"
                            placeholderTextColor="#94A3B8"
                        />
                    </View>

                    {/* 🩸 SÉLECTION DU GROUPE SANGUIN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Groupe Sanguin</Text>
                        <View style={styles.bloodGridContainer}>
                            {BLOOD_GROUPS.map((group) => {
                                const isSelected = bloodGroup === group;
                                return (
                                    <TouchableOpacity
                                        key={group}
                                        style={[styles.bloodChip, isSelected && styles.bloodChipSelected]}
                                        onPress={() => setBloodGroup(group)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.bloodChipText, isSelected && styles.bloodChipTextSelected]}>
                                            {group}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 🚻 SÉLECTION DU SEXE */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sexe</Text>
                        <View style={styles.sexSelectorContainer}>
                            <TouchableOpacity
                                style={[styles.sexChip, sex === 'homme' && styles.sexChipSelected]}
                                onPress={() => setSex('homme')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.sexChipText, sex === 'homme' && styles.sexChipTextSelected]}>
                                    👨 Homme
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.sexChip, sex === 'femme' && styles.sexChipSelected]}
                                onPress={() => setSex('femme')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.sexChipText, sex === 'femme' && styles.sexChipTextSelected]}>
                                    👩 Femme
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Disponible pour les dons</Text>
                            <Text style={styles.settingSub}>Recevoir des demandes de dons</Text>
                        </View>
                        <Switch
                            value={available}
                            onValueChange={setAvailable}
                            trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                            thumbColor={available ? '#901818' : '#94A3B8'}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Gouvernorat / Région (Tunisie)</Text>
                        <TouchableOpacity
                            style={styles.dropdownSelector}
                            onPress={() => setShowZoneModal(true)}
                        >
                            <Text style={styles.dropdownSelectorText}>
                                📍 {zone ? zone : 'Sélectionnez votre gouvernorat'}
                            </Text>
                            <Text style={styles.dropdownArrow}>▼</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Rayon de recherche maximal (km)</Text>
                        <TextInput
                            style={styles.input}
                            value={maxRadiusKm}
                            onChangeText={setMaxRadiusKm}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Alertes de notifications</Text>
                            <Text style={styles.settingSub}>Notification pour besoins urgents</Text>
                        </View>
                        <Switch
                            value={alertsEnabled}
                            onValueChange={setAlertsEnabled}
                            trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                            thumbColor={alertsEnabled ? '#901818' : '#94A3B8'}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, saving ? { opacity: 0.7 } : null]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Bouton Déconnexion */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={async () => {
                        await AsyncStorage.removeItem('token');
                        navigation.replace('Auth');
                    }}
                >
                    <Text style={styles.logoutButtonText}>Se déconnecter</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* 🇹🇳 MODAL LISTE DÉROULANTE DES 24 GOUVERNORATS */}
            <Modal visible={showZoneModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionnez votre Gouvernorat</Text>
                            <TouchableOpacity onPress={() => setShowZoneModal(false)}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={TUNISIAN_GOVERNORATES}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => {
                                const isSelected = zone === item;
                                return (
                                    <TouchableOpacity
                                        style={[styles.regionItem, isSelected ? styles.regionItemSelected : null]}
                                        onPress={() => {
                                            setZone(item);
                                            setShowZoneModal(false);
                                        }}
                                    >
                                        <Text style={[styles.regionText, isSelected ? styles.regionTextSelected : null]}>
                                            {item}
                                        </Text>
                                        {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* 🏠 BARRE DE NAVIGATION INFÉRIEURE */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.navIcon}>🏠</Text>
                    <Text style={styles.navLabel}>Accueil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
                    <Text style={styles.navIcon}>📋</Text>
                    <Text style={styles.navLabel}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={styles.navIcon}>🔔</Text>
                    <Text style={styles.navLabel}>Notifications</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <Text style={[styles.navIcon, styles.navIconActive]}>👤</Text>
                    <Text style={[styles.navLabel, styles.navLabelActive]}>Profil</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const heartbeatStyles = StyleSheet.create({
    container: {
        height: ECG_HEIGHT,
        marginTop: 10,
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

const headerStyles = StyleSheet.create({
    headerBanner: {
        backgroundColor: '#901818',
        paddingTop: Platform.OS === 'ios' ? 16 : 14,
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
        marginBottom: 16,
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
        fontSize: 30,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    arabicTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FCA5A5',
        marginLeft: 8,
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
        fontSize: 12,
        color: '#FECACA',
        marginTop: 2,
        letterSpacing: 0.2,
    },
    profileHeroCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        marginTop: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    avatarBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarText: { color: '#901818', fontSize: 24, fontWeight: '900' },
    fullName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
    phoneText: { fontSize: 13, color: '#FECACA', marginTop: 2 },
    inlineBadges: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
    subBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    subBadgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 30 },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 10 },

    questionnaireSubText: { fontSize: 12, color: '#64748B', marginBottom: 12 },
    questionnaireButton: {
        backgroundColor: '#901818',
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    questionnaireButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    lockedNotice: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    lockedNoticeText: {
        color: '#991B1B',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 18,
    },

    statusBanner: { padding: 12, borderRadius: 12, marginBottom: 14, alignItems: 'center' },
    statusBannerEligible: { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#4ADE80' },
    statusBannerWaiting: { backgroundColor: '#FFEDD5', borderWidth: 1, borderColor: '#FDBA74' },
    statusBannerDefinitif: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#EF4444' },
    statusBannerTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    textEligible: { color: '#16A34A' },
    textWaiting: { color: '#C2410C' },
    textDefinitif: { color: '#991B1B' },

    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    calendarTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
    monthNavBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10 },
    monthNavText: { fontSize: 14, color: '#901818', fontWeight: 'bold' },
    weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
    weekDayText: { width: 36, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748B' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
    dayBoxEmpty: { width: '14.28%', height: 42 },
    dayBox: {
        width: '14.28%',
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        marginVertical: 2,
        borderWidth: 1,
    },
    dayBoxEligible: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
    dayBoxIneligible: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    dayBoxLastDonation: { backgroundColor: '#BBF7D0', borderColor: '#16A34A' },
    dayBoxToday: { borderWidth: 2, borderColor: '#901818' },
    dayText: { fontSize: 13, fontWeight: 'bold' },
    dayTextEligible: { color: '#15803D' },
    dayTextIneligible: { color: '#991B1B' },
    dayTextLastDonation: { color: '#14532D' },
    dayTextToday: { color: '#901818' },
    lastDonationIcon: { fontSize: 10 },

    legendContainer: { marginTop: 12, gap: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendColor: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
    legendText: { fontSize: 12, color: '#475569', fontWeight: '600' },

    inputGroup: { marginBottom: 14 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0F172A',
    },

    // STYLES DU CHAMP EXPLICITE ÉLIGIBILITÉ
    eligibilityFieldBox: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    eligibilityBoxEligible: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
    eligibilityBoxTemporaire: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
    eligibilityBoxDefinitif: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
    eligibilityBoxWaiting: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
    eligibilityFieldTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#1E293B' },
    eligibilityFieldSub: { fontSize: 12, color: '#475569', lineHeight: 16 },

    bloodGridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    bloodChip: {
        width: '22%',
        paddingVertical: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        alignItems: 'center',
    },
    bloodChipSelected: { backgroundColor: '#901818', borderColor: '#901818' },
    bloodChipText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
    bloodChipTextSelected: { color: '#FFFFFF' },

    sexSelectorContainer: { flexDirection: 'row', gap: 10 },
    sexChip: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        alignItems: 'center',
    },
    sexChipSelected: { backgroundColor: '#901818', borderColor: '#901818' },
    sexChipText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
    sexChipTextSelected: { color: '#FFFFFF' },

    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    settingLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    settingSub: { fontSize: 12, color: '#64748B' },

    dropdownSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownSelectorText: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
    dropdownArrow: { fontSize: 12, color: '#64748B' },

    saveButton: {
        backgroundColor: '#901818',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

    logoutButton: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 20,
    },
    logoutButtonText: { color: '#901818', fontSize: 15, fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    modalCloseText: { fontSize: 18, color: '#64748B', fontWeight: 'bold' },
    regionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    regionItemSelected: { backgroundColor: '#FEF2F2' },
    regionText: { fontSize: 15, color: '#334155' },
    regionTextSelected: { color: '#901818', fontWeight: 'bold' },
    checkMark: { color: '#901818', fontWeight: 'bold' },

    bottomTabBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingVertical: 10,
    },
    navItem: { alignItems: 'center' },
    navIcon: { fontSize: 20, color: '#64748B' },
    navIconActive: { color: '#901818' },
    navLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
    navLabelActive: { color: '#901818', fontWeight: 'bold' },
});