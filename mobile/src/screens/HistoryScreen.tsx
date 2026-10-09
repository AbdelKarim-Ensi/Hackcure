import React, { useState, useCallback, useRef, useEffect } from 'react';
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
    Animated,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getUserRegistrations, RegistrationHistoryItem } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type FilterTab = 'ALL' | 'UPCOMING' | 'COMPLETED';

// ------------------------------------------------------------------
// 💓 COMPOSANT ECG ANIMÉ FAÇON MONITEUR DE SANTÉ (BALAYAGE LUMINEUX)
// ------------------------------------------------------------------
const ECG_PERIOD = 200;   // Largeur d'un battement
const ECG_HEIGHT = 44;    // Hauteur de la zone
const SWEEP_WIDTH = 150;  // Largeur du faisceau lumineux qui défile

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

            // Transmission obligatoire du token à la requête
            const historyData = await getUserRegistrations(storedToken as any);

            // Garantir que c'est un tableau valide (évite les données parasites)
            if (Array.isArray(historyData)) {
                setRegistrations(historyData);
            } else {
                setRegistrations([]);
            }
        } catch (error: any) {
            console.error('Erreur chargement historique:', error);
            setRegistrations([]);
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
                    <View style={[styles.statusBadge, { backgroundColor: '#E0F2FE', borderColor: '#38BDF8', borderWidth: 1 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#0284C7' }]}>🔵 Inscrit (À venir)</Text>
                    </View>
                );
            case 'present':
            case 'don_effectue':
                return (
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7', borderColor: '#4ADE80', borderWidth: 1 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#16A34A' }]}>🟢 Don Effectué</Text>
                    </View>
                );
            case 'annule':
                return (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                        <Text style={[styles.statusBadgeText, { color: '#901818' }]}>🔴 Annulé</Text>
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
                <ActivityIndicator size="large" color="#901818" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* EN-TÊTE CHARLES NICOLLE AVEC BATTEMENT ECG ET STATISTIQUES */}
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

                <View style={headerStyles.statsRow}>
                    <View style={headerStyles.statBox}>
                        <Text style={headerStyles.statValue}>{totalDonations}</Text>
                        <Text style={headerStyles.statLabel}>Dons réalisés 🩸</Text>
                    </View>
                    <View style={headerStyles.statDivider} />
                    <View style={headerStyles.statBox}>
                        <Text style={headerStyles.statValue}>{upcomingDonations}</Text>
                        <Text style={headerStyles.statLabel}>En attente ⏳</Text>
                    </View>
                </View>

                <AnimatedHeartbeat />
            </View>

            {/* ONGLET DE FILTRAGE */}
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

            {/* LISTE DE L'HISTORIQUE */}
            <FlatList
                data={filteredRegistrations}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#901818']} />
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

            {/* MODAL PASS QR CODE */}
            <Modal visible={Boolean(selectedQRItem)} animationType="slide" transparent onRequestClose={() => setSelectedQRItem(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Pass de Pointage</Text>
                        <Text style={styles.modalSubTitle}>
                            Présentez ce QR Code à l'établissement lors de votre arrivée pour valider votre don.
                        </Text>

                        <View style={styles.qrDisplayBox}>
                            {qrLoading ? (
                                <ActivityIndicator size="small" color="#901818" style={styles.qrLoader} />
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

            {/* BARRE DE NAVIGATION INFÉRIEURE */}
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

// --- STYLES HEARTBEAT ECG ---
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
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 14,
        paddingVertical: 10,
        marginTop: 12,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
    statLabel: { color: '#FECACA', fontSize: 12, marginTop: 2, fontWeight: '500' },
    statDivider: { width: 1, height: '70%', backgroundColor: 'rgba(255, 255, 255, 0.3)' },
});

// --- STYLES DE L'ÉCRAN HISTORIQUE ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
    },
    tabActive: { backgroundColor: '#901818' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    tabTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

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
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
    slotText: { fontSize: 13, fontWeight: '700', color: '#334155' },

    eventTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    eventDetail: { fontSize: 13, color: '#64748B', marginTop: 2 },
    eventSubDetail: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 1 },

    qrButton: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 14,
    },
    qrButtonText: { color: '#1E293B', fontWeight: 'bold', fontSize: 13 },

    emptyContainer: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyIcon: { fontSize: 42, marginBottom: 10 },
    emptyText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
    emptySubText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 18 },

    // Modal Pass QR Code
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
    modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
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
    qrTokenText: { fontSize: 11, color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center', marginTop: 10 },
    modalDetailText: { fontSize: 13, fontWeight: '600', color: '#334155', marginVertical: 2 },
    closeModalButton: { backgroundColor: '#901818', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 20, marginTop: 18 },
    closeModalText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

    // Navigation Inférieure
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