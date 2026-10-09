import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
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
import { getUserNotifications, ApiNotification } from '../services/eventService';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type FilterTab = 'ALL' | 'UNREAD' | 'URGENT';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    date: string;
    type: 'URGENT' | 'REMINDER' | 'CONFIRMATION' | 'INFO';
    read: boolean;
    rawItem?: ApiNotification;
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

export const NotificationsScreen = ({ navigation }: Props) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

    // Mappage du type de l'API Swagger vers le type d'affichage local
    const mapNotificationType = (typeStr: string): 'URGENT' | 'REMINDER' | 'CONFIRMATION' | 'INFO' => {
        const lower = typeStr?.toLowerCase() || '';
        if (lower.includes('urg') || lower.includes('alert')) return 'URGENT';
        if (lower.includes('rapp') || lower.includes('remind')) return 'REMINDER';
        if (lower.includes('confirm') || lower.includes('inscrit')) return 'CONFIRMATION';
        return 'INFO';
    };

    // Formater la date API ISO en date lisible
    const formatDate = (isoString?: string): string => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
            return isoString;
        }
    };

    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const storedToken = await AsyncStorage.getItem('token');
            const profileStr = await AsyncStorage.getItem('user_profile');
            const profile = profileStr ? JSON.parse(profileStr) : null;

            if (!storedToken) {
                Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
                navigation.replace('Auth');
                return;
            }

            // Clé de stockage isolée par utilisateur pour l'état "lu"
            const readStorageKey = profile?.phone
                ? `user_read_notifs_${profile.phone}`
                : 'user_read_notifications';

            const readIdsStr = await AsyncStorage.getItem(readStorageKey);
            const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];

            // Appel API réel GET /notifications/me
            const apiData: ApiNotification[] = await getUserNotifications(storedToken);

            const mappedNotifications: AppNotification[] = apiData.map((item) => {
                const type = mapNotificationType(item.type);
                const payload = item.payload || {};

                let title = payload.title || '';
                let message = payload.message || '';

                if (!title) {
                    if (type === 'URGENT') {
                        title = `🚨 Appel Urgent : Groupe ${payload.bloodGroup || ''} requis`;
                    } else if (type === 'REMINDER') {
                        title = '⏰ Rappel de don de sang';
                    } else if (type === 'CONFIRMATION') {
                        title = '✅ Inscription confirmée';
                    } else {
                        title = 'ℹ️ Information Sanitaire';
                    }
                }

                if (!message) {
                    const hospital = payload.hospitalName ? `à ${payload.hospitalName}` : 'au centre de transfusion';
                    const distance = payload.distanceKm ? ` (${payload.distanceKm} km)` : '';
                    if (type === 'URGENT') {
                        message = `Un besoin urgent en sang (${payload.bloodGroup || 'Tous groupes'}) a été signalé ${hospital}${distance}.`;
                    } else {
                        message = `Notification relative à votre activité sur la plateforme Damm.`;
                    }
                }

                return {
                    id: item.id,
                    title,
                    message,
                    date: formatDate(item.createdAt),
                    type,
                    read: readIds.includes(item.id),
                    rawItem: item,
                };
            });

            setNotifications(mappedNotifications);
        } catch (error: any) {
            console.error('Erreur chargement notifications:', error);
            setNotifications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [loadNotifications])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadNotifications();
    };

    const markAsRead = async (id: string) => {
        const updatedList = notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        );
        setNotifications(updatedList);

        try {
            const profileStr = await AsyncStorage.getItem('user_profile');
            const profile = profileStr ? JSON.parse(profileStr) : null;
            const readStorageKey = profile?.phone
                ? `user_read_notifs_${profile.phone}`
                : 'user_read_notifications';

            const readIdsStr = await AsyncStorage.getItem(readStorageKey);
            const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];
            if (!readIds.includes(id)) {
                readIds.push(id);
                await AsyncStorage.setItem(readStorageKey, JSON.stringify(readIds));
            }
        } catch (e) {
            console.error('Erreur sauvegarde état notification:', e);
        }
    };

    const markAllAsRead = async () => {
        const updatedList = notifications.map((n) => ({ ...n, read: true }));
        setNotifications(updatedList);

        try {
            const profileStr = await AsyncStorage.getItem('user_profile');
            const profile = profileStr ? JSON.parse(profileStr) : null;
            const readStorageKey = profile?.phone
                ? `user_read_notifs_${profile.phone}`
                : 'user_read_notifications';

            const allIds = notifications.map((n) => n.id);
            await AsyncStorage.setItem(readStorageKey, JSON.stringify(allIds));
        } catch (e) {
            console.error('Erreur tout marquer comme lu:', e);
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;
    const urgentCount = notifications.filter((n) => n.type === 'URGENT').length;

    const filteredNotifications = notifications.filter((item) => {
        if (activeTab === 'UNREAD') return !item.read;
        if (activeTab === 'URGENT') return item.type === 'URGENT';
        return true;
    });

    const renderTypeBadge = (type: string) => {
        switch (type) {
            case 'URGENT':
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                        <Text style={[styles.typeBadgeText, { color: '#901818' }]}>🚨 URGENT</Text>
                    </View>
                );
            case 'REMINDER':
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#DCFCE7', borderColor: '#4ADE80', borderWidth: 1 }]}>
                        <Text style={[styles.typeBadgeText, { color: '#16A34A' }]}>⏰ RAPPEL</Text>
                    </View>
                );
            case 'CONFIRMATION':
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#E0F2FE', borderColor: '#38BDF8', borderWidth: 1 }]}>
                        <Text style={[styles.typeBadgeText, { color: '#0284C7' }]}>✅ CONFIRMATION</Text>
                    </View>
                );
            default:
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 }]}>
                        <Text style={[styles.typeBadgeText, { color: '#475569' }]}>ℹ️ INFO</Text>
                    </View>
                );
        }
    };

    const renderNotificationCard = ({ item }: { item: AppNotification }) => {
        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    !item.read ? styles.cardUnread : null,
                    item.type === 'URGENT' ? styles.cardUrgent : null,
                ]}
                onPress={() => markAsRead(item.id)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    {renderTypeBadge(item.type)}
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>

                <View style={styles.titleRow}>
                    {!item.read ? <View style={styles.unreadDot} /> : null}
                    <Text style={[styles.notifTitle, !item.read ? styles.textBold : null]}>
                        {item.title}
                    </Text>
                </View>

                <Text style={styles.notifMessage}>{item.message}</Text>

                {item.type === 'URGENT' ? (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                            markAsRead(item.id);
                            navigation.navigate('Home');
                        }}
                    >
                        <Text style={styles.actionButtonText}>Voir les collectes d'urgence →</Text>
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>
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

                <View style={headerStyles.subHeaderRow}>
                    <Text style={headerStyles.brandSubtitle}>
                        Chaque goutte compte.
                    </Text>
                    {unreadCount > 0 ? (
                        <TouchableOpacity style={headerStyles.markAllButton} onPress={markAllAsRead}>
                            <Text style={headerStyles.markAllText}>Tout marquer comme lu</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={headerStyles.statsRow}>
                    <View style={headerStyles.statBox}>
                        <Text style={headerStyles.statValue}>{unreadCount}</Text>
                        <Text style={headerStyles.statLabel}>Non lue(s) 🔔</Text>
                    </View>
                    <View style={headerStyles.statDivider} />
                    <View style={headerStyles.statBox}>
                        <Text style={headerStyles.statValue}>{urgentCount}</Text>
                        <Text style={headerStyles.statLabel}>Alerte(s) 🚨</Text>
                    </View>
                </View>

                <AnimatedHeartbeat />
            </View>

            {/* ONGLETS FILTRES */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'ALL' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('ALL')}
                >
                    <Text style={[styles.tabText, activeTab === 'ALL' ? styles.tabTextActive : null]}>
                        Toutes ({notifications.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'UNREAD' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('UNREAD')}
                >
                    <Text style={[styles.tabText, activeTab === 'UNREAD' ? styles.tabTextActive : null]}>
                        Non lues ({unreadCount})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'URGENT' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('URGENT')}
                >
                    <Text style={[styles.tabText, activeTab === 'URGENT' ? styles.tabTextActive : null]}>
                        🚨 Urgentes ({urgentCount})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* LISTE DES NOTIFICATIONS */}
            <FlatList
                data={filteredNotifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotificationCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#901818']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🔔</Text>
                        <Text style={styles.emptyText}>Aucune notification.</Text>
                        <Text style={styles.emptySubText}>Vous n'avez aucun message dans cette catégorie.</Text>
                    </View>
                }
            />

            {/* BARRE DE NAVIGATION INFÉRIEURE */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.navIcon}>🏠</Text>
                    <Text style={styles.navLabel}>Accueil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
                    <Text style={styles.navIcon}>📋</Text>
                    <Text style={styles.navLabel}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} onPress={() => { }}>
                    <Text style={[styles.navIcon, styles.navIconActive]}>🔔</Text>
                    <Text style={[styles.navLabel, styles.navLabelActive]}>Notifications</Text>
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
    subHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    brandSubtitle: {
        fontSize: 12,
        color: '#FECACA',
        letterSpacing: 0.2,
        flex: 1,
    },
    markAllButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    markAllText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

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

// --- STYLES ÉCRAN NOTIFICATIONS ---
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
    cardUnread: { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' },
    cardUrgent: { borderWidth: 2, borderColor: '#901818' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    typeBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 11, fontWeight: 'bold' },
    dateText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#901818', marginRight: 8 },
    notifTitle: { fontSize: 15, color: '#1E293B', flex: 1 },
    textBold: { fontWeight: '800' },

    notifMessage: { fontSize: 13, color: '#64748B', lineHeight: 19, marginTop: 2 },

    actionButton: {
        backgroundColor: '#901818',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#901818',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    actionButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

    emptyContainer: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyIcon: { fontSize: 42, marginBottom: 10 },
    emptyText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
    emptySubText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6 },

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