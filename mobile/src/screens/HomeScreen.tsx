import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { DonorProfile, BloodEvent } from '../types/events';
import { getDonorProfile, getUpcomingEvents, registerToEvent } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Types de catégories de filtres
type CategoryFilter = 'ALL' | 'URGENT' | 'NEARBY' | 'MOBILE';

export const HomeScreen = ({ navigation }: Props) => {
    const [profile, setProfile] = useState<DonorProfile | null>(null);
    const [events, setEvents] = useState<BloodEvent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);

    // État du filtre de catégorie sélectionné
    const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');

    // Modal de sélection de créneau
    const [selectedEvent, setSelectedEvent] = useState<BloodEvent | null>(null);
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

            const eventsData = await getUpcomingEvents(storedToken, {
                lat: donorData.position?.latitude,
                lng: donorData.position?.longitude,
                maxDistanceKm: 50,
            });

            const sortedEvents = eventsData.sort((a, b) => {
                const aMatches = a.targetGroups.includes(donorData.bloodGroup) ? 1 : 0;
                const bMatches = b.targetGroups.includes(donorData.bloodGroup) ? 1 : 0;
                if (bMatches !== aMatches) return bMatches - aMatches;
                return (a.distanceKm || 0) - (b.distanceKm || 0);
            });

            setEvents(sortedEvents);
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

    // Filtrage des événements en fonction de la catégorie sélectionnée
    const getFilteredEvents = () => {
        return events.filter((event) => {
            if (activeCategory === 'URGENT') {
                return profile && event.targetGroups.includes(profile.bloodGroup);
            }
            if (activeCategory === 'NEARBY') {
                return (event.distanceKm || 0) <= 15;
            }
            if (activeCategory === 'MOBILE') {
                return event.title.toLowerCase().includes('mobile') || event.address.toLowerCase().includes('bus');
            }
            return true; // 'ALL'
        });
    };

    const handleConfirmRegistration = async () => {
        if (!selectedEvent || !selectedSlot || !token) {
            Alert.alert('Attention', 'Veuillez sélectionner un créneau horaire.');
            return;
        }

        try {
            setRegistering(true);
            await registerToEvent(token, selectedEvent.id, selectedSlot);
            Alert.alert(
                'Inscription réussie !',
                `Votre passage est confirmé pour ${selectedSlot}.`
            );
            setSelectedEvent(null);
            setSelectedSlot('');
            loadData();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Une erreur est survenue lors de l'inscription.";
            Alert.alert('Échec de l\'inscription', Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setRegistering(false);
        }
    };

    const renderEventCard = ({ item }: { item: BloodEvent }) => {
        const isTargeted = profile && item.targetGroups.includes(profile.bloodGroup);

        return (
            <View style={[styles.card, isTargeted && styles.cardHighlighted]}>
                {isTargeted && (
                    <View style={styles.priorityBadge}>
                        <Text style={styles.priorityBadgeText}>Urgent ({profile.bloodGroup})</Text>
                    </View>
                )}

                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDetail}>📍 {item.placeName} ({item.distanceKm ? `${item.distanceKm} km` : item.address})</Text>
                <Text style={styles.eventDetail}>📅 Date : {item.eventDate}</Text>

                <View style={styles.gaugeContainer}>
                    <Text style={styles.gaugeText}>
                        Places réservées : {item.registeredCount} / {item.capacity}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => {
                        setSelectedEvent(item);
                        if (item.slots.length > 0) setSelectedSlot(item.slots[0].time);
                    }}
                >
                    <Text style={styles.registerButtonText}>S'inscrire à cette collecte</Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }

    const filteredData = getFilteredEvents();

    return (
        <SafeAreaView style={styles.container}>
            {/* En-tête profil */}
            {profile && (
                <View style={styles.headerCard}>
                    <View>
                        <Text style={styles.welcomeText}>Bonjour, {profile.fullName}</Text>
                        <Text style={styles.subText}>Prochain don : {profile.nextDonationPossibleDate || 'Immédiat'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)}>
                        <View style={styles.bloodBadge}>
                            <Text style={styles.bloodBadgeText}>{profile.bloodGroup}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* Filtres par catégories (Barre horizontale scrollable) */}
            <View style={styles.categoriesSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                    <TouchableOpacity
                        style={[styles.categoryChip, activeCategory === 'ALL' && styles.categoryChipActive]}
                        onPress={() => setActiveCategory('ALL')}
                    >
                        <Text style={[styles.categoryChipText, activeCategory === 'ALL' && styles.categoryChipTextActive]}>
                            Toutes ({events.length})
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
                            📍 À proximité (&lt;15 km)
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

            {/* Liste des événements filtrés */}
            <FlatList
                data={filteredData}
                keyExtractor={(item) => item.id}
                renderItem={renderEventCard}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D32F2F']} />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>Aucune collecte ne correspond à ce filtre.</Text>
                }
            />

            {/* Modal d'inscription */}
            <Modal visible={!!selectedEvent} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
                        <Text style={styles.modalSubTitle}>Choisissez un créneau horaire :</Text>

                        <View style={styles.slotsContainer}>
                            {selectedEvent?.slots.map((slot) => (
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

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setSelectedEvent(null)}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleConfirmRegistration}
                                disabled={registering}
                            >
                                {registering ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Confirmer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Barre de Navigation Inférieure (Bottom Tab Bar) */}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerCard: {
        backgroundColor: '#D32F2F',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    welcomeText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    subText: { color: '#FFCDD2', fontSize: 13, marginTop: 2 },
    bloodBadge: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bloodBadgeText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 16 },

    // Section des filtres
    categoriesSection: { paddingVertical: 12 },
    categoriesScroll: { paddingHorizontal: 16, gap: 8 },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    categoryChipActive: { backgroundColor: '#D32F2F' },
    categoryChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    categoryChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

    listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    cardHighlighted: { borderWidth: 1.5, borderColor: '#D32F2F' },
    priorityBadge: {
        backgroundColor: '#FFEBEE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    priorityBadgeText: { color: '#C62828', fontSize: 12, fontWeight: 'bold' },
    eventTitle: { fontSize: 16, fontWeight: 'bold', color: '#212121', marginBottom: 6 },
    eventDetail: { fontSize: 13, color: '#666', marginBottom: 4 },
    gaugeContainer: { marginTop: 8, marginBottom: 12 },
    gaugeText: { fontSize: 12, color: '#888' },
    registerButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    registerButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    modalSubTitle: { fontSize: 14, color: '#666', marginVertical: 12 },
    slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    slotChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#CCC',
    },
    slotChipSelected: { backgroundColor: '#D32F2F', borderColor: '#D32F2F' },
    slotChipText: { color: '#333' },
    slotChipTextSelected: { color: '#FFF', fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
    cancelButton: { padding: 12, flex: 1, alignItems: 'center' },
    cancelButtonText: { color: '#666', fontWeight: 'bold' },
    confirmButton: {
        backgroundColor: '#D32F2F',
        padding: 12,
        borderRadius: 8,
        flex: 2,
        alignItems: 'center',
    },
    confirmButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Barre de navigation inférieure
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