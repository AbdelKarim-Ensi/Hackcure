import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Alert,
    SafeAreaView,
    ScrollView,
    Animated,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { DonorProfile, BloodEvent } from '../types/events';
import {
    getDonorProfile,
    getUpcomingEvents,
    registerToEvent,
    getActiveUrgentRequests,
    respondToUrgentRequest,
} from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type CategoryFilter = 'ALL' | 'URGENT' | 'NEARBY' | 'MOBILE';

export interface UnifiedHomeItem extends BloodEvent {
    isUrgentRequest?: boolean;
    requestId?: string;
    institutionName?: string;
}

// ------------------------------------------------------------------
// 💓 COMPOSANT ECG ANIMÉ FAÇON MONITEUR DE SANTÉ (BALAYAGE LUMINEUX)
// ------------------------------------------------------------------
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

export const HomeScreen = ({ navigation }: Props) => {
    const [profile, setProfile] = useState<DonorProfile | null>(null);
    const [allItems, setAllItems] = useState<UnifiedHomeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);

    const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');

    const [selectedItem, setSelectedItem] = useState<UnifiedHomeItem | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [registering, setRegistering] = useState<boolean>(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            const storedToken = await AsyncStorage.getItem('token');
            if (!storedToken) {
                Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
                navigation.replace('Auth');
                return;
            }

            setToken(storedToken);

            const donorData = await getDonorProfile(storedToken);
            setProfile(donorData);

            const userRadiusKm = donorData.maxRadiusKm || 20;

            const [eventsData, urgentRequests] = await Promise.all([
                getUpcomingEvents(storedToken, {
                    lat: donorData.position?.latitude,
                    lng: donorData.position?.longitude,
                    maxDistanceKm: userRadiusKm,
                }),
                getActiveUrgentRequests(storedToken),
            ]);

            const mappedUrgentRequests: UnifiedHomeItem[] = urgentRequests.map((req) => ({
                id: req.id,
                requestId: req.id,
                isUrgentRequest: true,
                organizerId: req.institutionId || 'hospital',
                title: `🚨 APPEL URGENT : ${req.institutionName}`,
                placeName: req.institutionName,
                address: `Besoin vital immédiat (Groupe ${req.bloodGroup})`,
                position: { latitude: 36.8065, longitude: 10.1815 },
                eventDate: "Aujourd'hui (Immédiat)",
                slots: [{ time: 'Immédiat', capacity: req.quantity }],
                capacity: req.quantity,
                registeredCount: 0,
                targetGroups: [req.bloodGroup],
                conditions: 'Présentation immédiate au centre de transfusion.',
                status: 'publie',
                distanceKm: req.currentRadiusKm || 2.5,
            }));

            // Déduplication par ID unique
            const seenIds = new Set<string>();
            const combinedList: UnifiedHomeItem[] = [];

            mappedUrgentRequests.forEach((req) => {
                if (!seenIds.has(req.id)) {
                    seenIds.add(req.id);
                    combinedList.push(req);
                }
            });

            eventsData.forEach((evt) => {
                if (!seenIds.has(evt.id)) {
                    seenIds.add(evt.id);
                    combinedList.push({ ...evt, isUrgentRequest: false });
                }
            });

            // 🎯 TRI AVEC GESTION SECURISEE DU GROUPE SANGUIN OPTIONNEL
            const userBloodGroup = donorData.bloodGroup ?? '';

            const sortedItems = combinedList.sort((a, b) => {
                if (a.isUrgentRequest && !b.isUrgentRequest) return -1;
                if (!a.isUrgentRequest && b.isUrgentRequest) return 1;

                const aMatches = userBloodGroup ? (a.targetGroups.includes(userBloodGroup) ? 1 : 0) : 0;
                const bMatches = userBloodGroup ? (b.targetGroups.includes(userBloodGroup) ? 1 : 0) : 0;

                if (bMatches !== aMatches) return bMatches - aMatches;
                return (a.distanceKm || 0) - (b.distanceKm || 0);
            });

            setAllItems(sortedItems);
        } catch (error: any) {
            console.error('Erreur de chargement:', error);
            if (error.response?.status === 401) {
                Alert.alert('Session expirée', 'Votre session a expiré, veuillez vous reconnecter.');
                navigation.replace('Auth');
            } else {
                Alert.alert('Erreur', 'Impossible de charger les événements.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigation]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // 🎯 FILTRAGE SECURISE CONTRE UN BLOODGROUP UNDEFINED
    const getFilteredEvents = () => {
        const userRadiusKm = profile?.maxRadiusKm || 20;
        const userBloodGroup = profile?.bloodGroup;

        return allItems.filter((item) => {
            if (activeCategory === 'URGENT') {
                const matchesBloodGroup = userBloodGroup ? item.targetGroups.includes(userBloodGroup) : false;
                return item.isUrgentRequest || matchesBloodGroup;
            }
            if (activeCategory === 'NEARBY') {
                return (item.distanceKm || 0) <= userRadiusKm;
            }
            if (activeCategory === 'MOBILE') {
                return item.title.toLowerCase().includes('mobile') || item.address.toLowerCase().includes('bus');
            }
            return true;
        });
    };

    const handleConfirmAction = async () => {
        if (!selectedItem || !token) return;

        try {
            setRegistering(true);

            if (selectedItem.isUrgentRequest && selectedItem.requestId) {
                await respondToUrgentRequest(token, selectedItem.requestId, 'je_viens');
                Alert.alert(
                    'Merci pour votre réactivité ! 🚑',
                    `Votre présence a été signalée à l'établissement ${selectedItem.placeName}.`
                );
            } else {
                if (!selectedSlot) {
                    Alert.alert('Attention', 'Veuillez sélectionner un créneau horaire.');
                    return;
                }
                await registerToEvent(token, selectedItem.id, selectedSlot, selectedItem);
                Alert.alert(
                    'Inscription réussie !',
                    `Votre passage est confirmé pour ${selectedSlot}.`
                );
            }

            setSelectedItem(null);
            setSelectedSlot('');
            loadData();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Une erreur est survenue lors de l'action.";
            Alert.alert('Échec', Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setRegistering(false);
        }
    };

    const renderEventCard = ({ item }: { item: UnifiedHomeItem }) => {
        const userBloodGroup = profile?.bloodGroup;
        const isTargeted = userBloodGroup ? item.targetGroups.includes(userBloodGroup) : false;

        return (
            <View
                style={[
                    styles.card,
                    item.isUrgentRequest ? styles.cardUrgentHospital : (isTargeted ? styles.cardHighlighted : null),
                ]}
            >
                {item.isUrgentRequest ? (
                    <View style={styles.hospitalUrgentBadge}>
                        <Text style={styles.hospitalUrgentText}>🚨 HÔPITAL EN BESOIN URGENT ({item.targetGroups.join(', ')})</Text>
                    </View>
                ) : isTargeted ? (
                    <View style={styles.priorityBadge}>
                        <Text style={styles.priorityBadgeText}>🚨 Urgent ({userBloodGroup})</Text>
                    </View>
                ) : null}

                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDetail}>📍 {item.placeName} ({item.distanceKm ? `${item.distanceKm} km` : item.address})</Text>
                <Text style={styles.eventDetail}>📅 Date : {item.eventDate}</Text>

                {!item.isUrgentRequest && (
                    <View style={styles.gaugeContainer}>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min(100, (item.registeredCount / item.capacity) * 100)}%` },
                                ]}
                            />
                        </View>
                        <Text style={styles.gaugeText}>
                            Places réservées : {item.registeredCount} / {item.capacity}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.registerButton, item.isUrgentRequest && styles.hospitalUrgentButton]}
                    onPress={() => {
                        setSelectedItem(item);
                        if (item.slots.length > 0) setSelectedSlot(item.slots[0].time);
                    }}
                >
                    <Text style={styles.registerButtonText}>
                        {item.isUrgentRequest ? 'Je viens immédiatement 🏃‍♂️🩸' : 'S\'inscrire à cette collecte 🩸'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#901818" />
            </View>
        );
    }

    const filteredData = getFilteredEvents();
    const userRadiusKm = profile?.maxRadiusKm || 20;

    return (
        <SafeAreaView style={styles.container}>
            {/* EN-TÊTE CHARLES NICOLLE */}
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

                {profile && (
                    <View style={headerStyles.profileRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={headerStyles.welcomeText}>Bonjour, {profile.fullName} 👋</Text>
                            <Text style={headerStyles.subText}>
                                Prochain don possible : {profile.nextDonationPossibleDate || 'Immédiat'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)}>
                            <View style={headerStyles.bloodBadge}>
                                <Text style={headerStyles.bloodBadgeText}>{profile.bloodGroup ?? 'O+'}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <AnimatedHeartbeat />
            </View>

            {/* FILTRES DE CATÉGORIES */}
            <View style={styles.categoriesSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                    <TouchableOpacity
                        style={[styles.categoryChip, activeCategory === 'ALL' && styles.categoryChipActive]}
                        onPress={() => setActiveCategory('ALL')}
                    >
                        <Text style={[styles.categoryChipText, activeCategory === 'ALL' && styles.categoryChipTextActive]}>
                            Toutes ({allItems.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.categoryChip, activeCategory === 'URGENT' && styles.categoryChipActive]}
                        onPress={() => setActiveCategory('URGENT')}
                    >
                        <Text style={[styles.categoryChipText, activeCategory === 'URGENT' && styles.categoryChipTextActive]}>
                            🚨 Besoin urgent
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.categoryChip, activeCategory === 'NEARBY' && styles.categoryChipActive]}
                        onPress={() => setActiveCategory('NEARBY')}
                    >
                        <Text style={[styles.categoryChipText, activeCategory === 'NEARBY' && styles.categoryChipTextActive]}>
                            📍 À proximité (&lt;{userRadiusKm} km)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.categoryChip, activeCategory === 'MOBILE' && styles.categoryChipActive]}
                        onPress={() => setActiveCategory('MOBILE')}
                    >
                        <Text style={[styles.categoryChipText, activeCategory === 'MOBILE' && styles.categoryChipTextActive]}>
                            🚌 Collectes mobiles
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* LISTE DES COLLECTES ET URGENCES */}
            <FlatList
                data={filteredData}
                keyExtractor={(item) => item.id}
                renderItem={renderEventCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#901818']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Aucune collecte ou alerte ne correspond à ce filtre.</Text>
                    </View>
                }
            />

            {/* MODAL D'ACTION */}
            <Modal visible={!!selectedItem} animationType="slide" transparent onRequestClose={() => setSelectedItem(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{selectedItem?.title}</Text>

                        {selectedItem?.isUrgentRequest ? (
                            <Text style={styles.modalSubTitle}>
                                Alerte prioritaire émise par {selectedItem?.placeName}. Confirmez-vous votre arrivée ?
                            </Text>
                        ) : (
                            <>
                                <Text style={styles.modalSubTitle}>Choisissez un créneau horaire :</Text>
                                <View style={styles.slotsContainer}>
                                    {selectedItem?.slots.map((slot) => (
                                        <TouchableOpacity
                                            key={slot.time}
                                            style={[
                                                styles.slotChip,
                                                selectedSlot === slot.time && styles.slotChipSelected,
                                            ]}
                                            onPress={() => setSelectedSlot(slot.time)}
                                        >
                                            <Text
                                                style={[
                                                    styles.slotChipText,
                                                    selectedSlot === slot.time && styles.slotChipTextSelected,
                                                ]}
                                            >
                                                {slot.time}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setSelectedItem(null)}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleConfirmAction}
                                disabled={registering}
                            >
                                {registering ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>
                                        {selectedItem?.isUrgentRequest ? 'Confirmer mon arrivée' : 'Confirmer'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* BARRE DE NAVIGATION INFÉRIEURE */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <Text style={[styles.navIcon, styles.navIconActive]}>🏠</Text>
                    <Text style={[styles.navLabel, styles.navLabelActive]}>Accueil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History' as any)}>
                    <Text style={styles.navIcon}>📋</Text>
                    <Text style={styles.navLabel}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications' as any)}>
                    <Text style={styles.navIcon}>🔔</Text>
                    <Text style={styles.navLabel}>Notifications</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile' as any)}>
                    <Text style={styles.navIcon}>👤</Text>
                    <Text style={styles.navLabel}>Profil</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// --- STYLES ECG ---
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

// --- STYLES BANNIÈRE CHARLES NICOLLE ---
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
        fontSize: 13,
        color: '#FECACA',
        marginTop: 2,
        letterSpacing: 0.2,
    },
    profileRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
    },
    welcomeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    subText: { color: '#FECACA', fontSize: 12, marginTop: 2 },
    bloodBadge: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    bloodBadgeText: { color: '#901818', fontWeight: '900', fontSize: 16 },
});

// --- STYLES HOME ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    categoriesSection: { paddingVertical: 14 },
    categoriesScroll: { paddingHorizontal: 16, gap: 8 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    categoryChipActive: { backgroundColor: '#901818' },
    categoryChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    categoryChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

    listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHighlighted: { borderWidth: 2, borderColor: '#901818', backgroundColor: '#FFF' },
    cardUrgentHospital: { borderWidth: 2, borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
    priorityBadge: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    priorityBadgeText: { color: '#901818', fontSize: 12, fontWeight: 'bold' },
    hospitalUrgentBadge: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    hospitalUrgentText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    eventTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
    eventDetail: { fontSize: 13, color: '#64748B', marginBottom: 4 },
    gaugeContainer: { marginTop: 10, marginBottom: 14 },
    progressBarBg: {
        height: 6,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#901818',
        borderRadius: 3,
    },
    gaugeText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    registerButton: {
        backgroundColor: '#901818',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#901818',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 3,
    },
    hospitalUrgentButton: {
        backgroundColor: '#DC2626',
    },
    registerButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 14 },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 22,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    modalSubTitle: { fontSize: 14, color: '#64748B', marginVertical: 14 },
    slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    slotChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        backgroundColor: '#F8FAFC',
    },
    slotChipSelected: { backgroundColor: '#901818', borderColor: '#901818' },
    slotChipText: { color: '#334155', fontWeight: '600' },
    slotChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    cancelButton: { padding: 14, flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#F1F5F9' },
    cancelButtonText: { color: '#64748B', fontWeight: 'bold' },
    confirmButton: {
        backgroundColor: '#901818',
        padding: 14,
        borderRadius: 12,
        flex: 2,
        alignItems: 'center',
    },
    confirmButtonText: { color: '#FFFFFF', fontWeight: 'bold' },

    bottomTabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingVertical: 10,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    navItem: { alignItems: 'center' },
    navIcon: { fontSize: 20, opacity: 0.6 },
    navIconActive: { opacity: 1 },
    navLabel: { fontSize: 11, color: '#64748B', marginTop: 3 },
    navLabelActive: { color: '#901818', fontWeight: 'bold' },
});