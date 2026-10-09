import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
    SafeAreaView,
    Image,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getUserRegistrations, RegistrationHistoryItem } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type FilterTab = 'ALL' | 'UPCOMING' | 'COMPLETED';

export const HistoryScreen = ({ navigation }: Props) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [registrations, setRegistrations] = useState<RegistrationHistoryItem[]>([]);
    const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

    // Modal Pass QR Code
    const [selectedQRItem, setSelectedQRItem] = useState<RegistrationHistoryItem | null>(null);
    const [qrLoading, setQrLoading] = useState<boolean>(true);

    const loadHistory = useCallback(async () => {
        try {
            setLoading(true);
            const storedToken = await AsyncStorage.getItem('token');
            if (!storedToken) {
                Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
                navigation.replace('Auth');
                return;
            }

            const historyData = await getUserRegistrations();
            setRegistrations(historyData);
        } catch (error: any) {
            console.error('Erreur chargement historique:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [loadHistory])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadHistory();
    };

    const filteredRegistrations = registrations.filter((item) => {
        if (activeTab === 'UPCOMING') {
            return item.status === 'inscrit';
        }
        if (activeTab === 'COMPLETED') {
            return item.status === 'don_effectue' || item.status === 'present';
        }
        return true;
    });

    const totalDonations = registrations.filter(r => r.status === 'don_effectue' || r.status === 'present').length;
    const upcomingDonations = registrations.filter(r => r.status === 'inscrit').length;

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'inscrit':
                return (
                    <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#0288D1' }]}>🔵 Inscrit (À venir)</Text>
                    </View>
                );
            case 'present':
            case 'don_effectue':
                return (
                    <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#2E7D32' }]}>🟢 Don Effectué</Text>
                    </View>
                );
            case 'annule':
                return (
                    <View style={[styles.statusBadge, { backgroundColor: '#FFEBEE' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#C62828' }]}>🔴 Annulé</Text>
                    </View>
                );
            default:
                return null;
        }
    };

    const renderHistoryCard = ({ item }: { item: RegistrationHistoryItem }) => {
        const isUpcoming = item.status === 'inscrit';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    {renderStatusBadge(item.status)}
                    <Text style={styles.slotText}>⏰ {item.slot}</Text>
                </View>

                <Text style={styles.eventTitle}>{item.event?.title || 'Collecte de sang'}</Text>
                <Text style={styles.eventDetail}>📍 {item.event?.placeName || 'Lieu non spécifié'}</Text>
                {Boolean(item.event?.address) ? (
                    <Text style={styles.eventSubDetail}>{item.event?.address}</Text>
                ) : null}
                <Text style={styles.eventDetail}>📅 Date : {item.event?.eventDate || 'Date non précisée'}</Text>

                {isUpcoming ? (
                    <TouchableOpacity
                        style={styles.qrButton}
                        onPress={() => {
                            setQrLoading(true);
                            setSelectedQRItem(item);
                        }}
                    >
                        <Text style={styles.qrButtonText}>📱 Afficher mon Pass QR</Text>
                    </TouchableOpacity>
                ) : null}
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

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Statistiques */}
            <View style={styles.headerCard}>
                <Text style={styles.headerTitle}>Mon Historique & Dons</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{totalDonations}</Text>
                        <Text style={styles.statLabel}>Dons réalisés 🩸</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{upcomingDonations}</Text>
                        <Text style={styles.statLabel}>En attente ⏳</Text>
                    </View>
                </View>
            </View>

            {/* Onglets Filtres */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'ALL' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('ALL')}
                >
                    <Text style={[styles.tabText, activeTab === 'ALL' ? styles.tabTextActive : null]}>
                        Tous ({registrations.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'UPCOMING' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('UPCOMING')}
                >
                    <Text style={[styles.tabText, activeTab === 'UPCOMING' ? styles.tabTextActive : null]}>
                        À venir ({upcomingDonations})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'COMPLETED' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('COMPLETED')}
                >
                    <Text style={[styles.tabText, activeTab === 'COMPLETED' ? styles.tabTextActive : null]}>
                        Effectués ({totalDonations})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Liste de l'historique */}
            <FlatList
                data={filteredRegistrations}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryCard}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D32F2F']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyText}>Aucune participation trouvée.</Text>
                        <Text style={styles.emptySubText}>
                            Inscrivez-vous à une collecte sur la page d'accueil pour remplir votre historique !
                        </Text>
                    </View>
                }
            />

            {/* 🎯 MODAL PASS QR CODE SÉCURISÉ */}
            <Modal visible={Boolean(selectedQRItem)} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Pass de Pointage</Text>
                        <Text style={styles.modalSubTitle}>
                            Présentez ce QR Code à l'établissement lors de votre arrivée pour valider votre don.
                        </Text>

                        {/* Génération automatique du QR Code via le qrToken */}
                        <View style={styles.qrDisplayBox}>
                            {qrLoading ? (
                                <ActivityIndicator size="small" color="#D32F2F" style={styles.qrLoader} />
                            ) : null}
                            {selectedQRItem?.qrToken ? (
                                <Image
                                    style={styles.qrImage}
                                    source={{
                                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                                            selectedQRItem.qrToken
                                        )}&color=1E293B&margin=0`,
                                    }}
                                    onLoadEnd={() => setQrLoading(false)}
                                />
                            ) : null}
                            <Text style={styles.qrTokenText}>
                                Jeton : {selectedQRItem?.qrToken}
                            </Text>
                        </View>

                        <Text style={styles.modalDetailText}>
                            📍 {selectedQRItem?.event?.title}
                        </Text>
                        <Text style={styles.modalDetailText}>
                            📅 Passage prévu : {selectedQRItem?.event?.eventDate} à {selectedQRItem?.slot}
                        </Text>

                        <TouchableOpacity
                            style={styles.closeModalButton}
                            onPress={() => setSelectedQRItem(null)}
                        >
                            <Text style={styles.closeModalText}>Fermer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Barre de Navigation Inférieure */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.navIcon}>🏠</Text>
                    <Text style={styles.navLabel}>Accueil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <Text style={[styles.navIcon, styles.navIconActive]}>📋</Text>
                    <Text style={[styles.navLabel, styles.navLabelActive]}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={styles.navIcon}>🔔</Text>
                    <Text style={styles.navLabel}>Notifications</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
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
        paddingVertical: 18,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        paddingVertical: 10,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
    statLabel: { color: '#FFCDD2', fontSize: 12, marginTop: 2 },
    statDivider: { width: 1, height: '70%', backgroundColor: 'rgba(255, 255, 255, 0.3)' },

    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
    },
    tabActive: { backgroundColor: '#D32F2F' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    tabTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

    listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
    slotText: { fontSize: 13, fontWeight: 'bold', color: '#475569' },

    eventTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
    eventDetail: { fontSize: 13, color: '#64748B', marginTop: 2 },
    eventSubDetail: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },

    qrButton: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    qrButtonText: { color: '#1E293B', fontWeight: 'bold', fontSize: 13 },

    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
    emptyIcon: { fontSize: 40, marginBottom: 10 },
    emptyText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
    emptySubText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
    modalSubTitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 },
    qrDisplayBox: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
        elevation: 1,
    },
    qrLoader: { marginBottom: 10 },
    qrImage: { width: 200, height: 200, borderRadius: 8 },
    qrTokenText: { fontSize: 10, color: '#64748B', fontFamily: 'monospace', textAlign: 'center', marginTop: 10 },
    modalDetailText: { fontSize: 13, fontWeight: '600', color: '#334155', marginVertical: 2 },
    closeModalButton: { backgroundColor: '#D32F2F', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20, marginTop: 16 },
    closeModalText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    // Bottom Navigation Bar
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