import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { DonorProfile } from '../types/events';
import { getDonorProfile, updateDonorProfile } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

// 🇹🇳 Liste des 24 Gouvernorats de Tunisie
const TUNISIAN_GOVERNORATES = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
    'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
    'Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
    'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const ProfileScreen = ({ navigation }: Props) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);
    const [profile, setProfile] = useState<DonorProfile | null>(null);

    const [available, setAvailable] = useState<boolean>(true);
    const [zone, setZone] = useState<string>('Tunis');
    const [maxRadiusKm, setMaxRadiusKm] = useState<string>('20');
    const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);

    // Modal Régions/Gouvernorats
    const [showZoneModal, setShowZoneModal] = useState<boolean>(false);

    // État du Calendrier
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

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleSave = async () => {
        if (!token) return;

        try {
            setSaving(true);
            const updated = await updateDonorProfile(token, {
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

    // --- LOGIQUE DU CALENDRIER DE DON ---
    const parseDateString = (dateStr?: string): Date | null => {
        if (!dateStr) return null;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            return parsed;
        }
        return null;
    };

    const lastDonationDateObj = parseDateString(profile?.lastDonationDate);
    const nextEligibleDateObj = parseDateString(profile?.nextDonationPossibleDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isEligibleNow = !nextEligibleDateObj || nextEligibleDateObj <= today;

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

        // Jours vides
        for (let i = 0; i < startingDay; i++) {
            days.push({ day: null, date: null, isEligible: false, isLastDonation: false, isToday: false });
        }

        // Jours du mois
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            currentDate.setHours(0, 0, 0, 0);

            const currentTime = currentDate.getTime();

            // 🎯 Est-ce le jour du dernier don ?
            const isLastDonation = Boolean(lastDonationDateObj && currentTime === lastDonationDateObj.getTime());

            // 🎯 Le jour est vert si : c'est la date du dernier don OU si la date >= date du prochain don éligible
            const isEligible = isLastDonation || (nextEligibleDateObj ? currentTime >= nextEligibleDateObj.getTime() : true);

            days.push({
                day: i,
                date: currentDate,
                isEligible,
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
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header Profil */}
                <View style={styles.headerCard}>
                    <View style={styles.avatarBadge}>
                        <Text style={styles.avatarText}>{profile?.bloodGroup ? profile.bloodGroup : 'O+'}</Text>
                    </View>
                    <Text style={styles.fullName}>{profile?.fullName ? profile.fullName : 'Donneur'}</Text>
                    <Text style={styles.phoneText}>📞 {profile?.phone ? profile.phone : 'Non renseigné'}</Text>

                    <View style={styles.inlineBadges}>
                        <View style={styles.subBadge}>
                            <Text style={styles.subBadgeText}>Sexe: {profile?.sex ? profile.sex : 'homme'}</Text>
                        </View>
                        {profile?.bloodGroupConfirmed ? (
                            <View style={[styles.subBadge, { backgroundColor: '#E8F5E9' }]}>
                                <Text style={[styles.subBadgeText, { color: '#2E7D32' }]}>✓ Sang Confirmé</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* 📅 CALENDRIER INTERACTIF & ÉLIGIBILITÉ */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📅 Calendrier d'Éligibilité au Don</Text>

                    {/* Banner de Statut */}
                    <View style={[styles.statusBanner, isEligibleNow ? styles.statusBannerEligible : styles.statusBannerWaiting]}>
                        <Text style={[styles.statusBannerTitle, isEligibleNow ? styles.textEligible : styles.textWaiting]}>
                            {isEligibleNow
                                ? "🎉 Vous êtes éligible pour donner du sang aujourd'hui !"
                                : `⏳ Prochain don possible à partir du ${nextEligibleDateObj ? nextEligibleDateObj.toLocaleDateString('fr-FR') : 'inconnue'}`}
                        </Text>
                    </View>

                    {/* Navigation du Mois */}
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

                    {/* En-tête jours de la semaine */}
                    <View style={styles.weekDaysRow}>
                        {DAYS_OF_WEEK.map((d) => (
                            <Text key={d} style={styles.weekDayText}>{d}</Text>
                        ))}
                    </View>

                    {/* Grille des jours */}
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

                    {/* Légende des couleurs */}
                    <View style={styles.legendContainer}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#C8E6C9', borderColor: '#2E7D32' }]} />
                            <Text style={styles.legendText}>🟢 Dernier don (🩸) & Éligible</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: '#FFEBEE', borderColor: '#C62828' }]} />
                            <Text style={styles.legendText}>🔴 Repos obligatoire</Text>
                        </View>
                    </View>
                </View>

                {/* ⚙️ PRÉFÉRENCES & LISTE DÉROULANTE RÉGIONS */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>⚙️ Mes Préférences</Text>

                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Disponible pour les dons</Text>
                            <Text style={styles.settingSub}>Recevoir des demandes de dons</Text>
                        </View>
                        <Switch
                            value={available}
                            onValueChange={setAvailable}
                            trackColor={{ false: '#CBD5E1', true: '#FFCDD2' }}
                            thumbColor={available ? '#D32F2F' : '#94A3B8'}
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
                            trackColor={{ false: '#CBD5E1', true: '#FFCDD2' }}
                            thumbColor={alertsEnabled ? '#D32F2F' : '#94A3B8'}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 16, paddingBottom: 30 },

    headerCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 2,
    },
    avatarBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#D32F2F',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
    fullName: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
    phoneText: { fontSize: 14, color: '#64748B', marginTop: 2 },
    inlineBadges: { flexDirection: 'row', gap: 8, marginTop: 10 },
    subBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    subBadgeText: { fontSize: 12, color: '#475569', fontWeight: '600' },

    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 14 },

    statusBanner: { padding: 12, borderRadius: 10, marginBottom: 14, alignItems: 'center' },
    statusBannerEligible: { backgroundColor: '#E8F5E9' },
    statusBannerWaiting: { backgroundColor: '#FFF3E0' },
    statusBannerTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    textEligible: { color: '#2E7D32' },
    textWaiting: { color: '#E65100' },

    // --- STYLES DU CALENDRIER ---
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    calendarTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
    monthNavBtn: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 8 },
    monthNavText: { fontSize: 14, color: '#D32F2F', fontWeight: 'bold' },

    weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
    weekDayText: { width: 36, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748B' },

    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
    dayBoxEmpty: { width: '14.28%', height: 42 },
    dayBox: {
        width: '14.28%',
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        marginVertical: 2,
        borderWidth: 1,
    },
    dayBoxEligible: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
    dayBoxIneligible: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
    dayBoxLastDonation: { backgroundColor: '#C8E6C9', borderColor: '#2E7D32', borderWidth: 2 },
    dayBoxToday: { borderWidth: 2.5, borderColor: '#1E293B' },

    dayText: { fontSize: 12, fontWeight: 'bold' },
    dayTextEligible: { color: '#2E7D32' },
    dayTextIneligible: { color: '#C62828' },
    dayTextLastDonation: { color: '#1B5E20', fontWeight: '900' },
    dayTextToday: { textDecorationLine: 'underline' },
    lastDonationIcon: { fontSize: 9, marginTop: -2 },

    legendContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendColor: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, marginRight: 6 },
    legendText: { fontSize: 12, color: '#475569', fontWeight: '600' },

    // --- STYLES PREFERENCES & DROPDOWN ---
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
    settingLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
    settingSub: { fontSize: 12, color: '#64748B' },

    inputGroup: { marginVertical: 8 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A' },

    dropdownSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    dropdownSelectorText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    dropdownArrow: { fontSize: 12, color: '#64748B' },

    saveButton: { backgroundColor: '#D32F2F', paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginTop: 16 },
    saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

    logoutButton: { backgroundColor: '#FEE2E2', paddingVertical: 12, borderRadius: 25, alignItems: 'center', marginTop: 10 },
    logoutButtonText: { color: '#991B1B', fontWeight: 'bold', fontSize: 14 },

    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    modalCloseText: { fontSize: 18, fontWeight: 'bold', color: '#64748B', padding: 4 },

    regionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    regionItemSelected: { backgroundColor: '#FFEBEE', borderRadius: 8 },
    regionText: { fontSize: 15, color: '#334155', fontWeight: '500' },
    regionTextSelected: { color: '#D32F2F', fontWeight: 'bold' },
    checkMark: { color: '#D32F2F', fontWeight: 'bold', fontSize: 16 },

    // --- BARRE DE NAVIGATION INFÉRIEURE ---
    bottomTabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingVertical: 8,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    navItem: { alignItems: 'center' },
    navIcon: { fontSize: 20, opacity: 0.6 },
    navIconActive: { opacity: 1 },
    navLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
    navLabelActive: { color: '#D32F2F', fontWeight: 'bold' },
});