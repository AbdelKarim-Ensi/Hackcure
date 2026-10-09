import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type FilterTab = 'ALL' | 'UNREAD' | 'URGENT';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    date: string;
    type: 'URGENT' | 'REMINDER' | 'CONFIRMATION' | 'INFO';
    read: boolean;
    eventId?: string;
}

// 🔔 Liste initiale / Mocks des notifications simulées
const INITIAL_NOTIFICATIONS: AppNotification[] = [
    {
        id: 'notif-1',
        title: '🚨 Appel Urgent : Groupe O+ Requis',
        message: 'Le Centre National de Transfusion Sanguine signale un besoin urgent en O+ à l Hôpital Charles Nicolle (Tunis).',
        date: 'Aujourd hui, 10:30',
        type: 'URGENT',
        read: false,
    },
    {
        id: 'notif-2',
        title: '🎉 Vous êtes éligible au don !',
        message: 'Votre période de repos obligatoire est terminée. Vous pouvez à nouveau effectuer un don de sang.',
        date: 'Hier, 14:15',
        type: 'REMINDER',
        read: false,
    },
    {
        id: 'notif-3',
        title: '✅ Inscription confirmée',
        message: 'Votre passage est confirmé pour la collecte à la Faculté des Sciences de Tunis à 09:00.',
        date: '08 Oct 2026, 16:45',
        type: 'CONFIRMATION',
        read: true,
    },
    {
        id: 'notif-4',
        title: '🚌 Collecte mobile programmée',
        message: 'Un bus de collecte mobile sera présent près de la station Habib Bourguiba ce vendredi.',
        date: '05 Oct 2026, 09:00',
        type: 'INFO',
        read: true,
    },
];

export const NotificationsScreen = ({ navigation }: Props) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

    // Charger l'état de lecture des notifications sauvegardé
    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const storedToken = await AsyncStorage.getItem('token');
            if (!storedToken) {
                Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
                navigation.replace('Auth');
                return;
            }

            const readIdsStr = await AsyncStorage.getItem('user_read_notifications');
            const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];

            const updatedList = INITIAL_NOTIFICATIONS.map((notif) => ({
                ...notif,
                read: readIds.includes(notif.id) || notif.read,
            }));

            setNotifications(updatedList);
        } catch (error: any) {
            console.error('Erreur chargement notifications:', error);
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

    // Marquer une notification comme lue
    const markAsRead = async (id: string) => {
        const updatedList = notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
        );
        setNotifications(updatedList);

        try {
            const readIdsStr = await AsyncStorage.getItem('user_read_notifications');
            const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];
            if (!readIds.includes(id)) {
                readIds.push(id);
                await AsyncStorage.setItem('user_read_notifications', JSON.stringify(readIds));
            }
        } catch (e) {
            console.error('Erreur sauvegarde état notification:', e);
        }
    };

    // Tout marquer comme lu
    const markAllAsRead = async () => {
        const updatedList = notifications.map((n) => ({ ...n, read: true }));
        setNotifications(updatedList);

        try {
            const allIds = notifications.map((n) => n.id);
            await AsyncStorage.setItem('user_read_notifications', JSON.stringify(allIds));
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
                    <View style={[styles.typeBadge, { backgroundColor: '#FFEBEE' }]}>
                        <Text style={[styles.typeBadgeText, { color: '#C62828' }]}>🚨 URGENT</Text>
                    </View>
                );
            case 'REMINDER':
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.typeBadgeText, { color: '#2E7D32' }]}>⏰ RAPPEL</Text>
                    </View>
                );
            case 'CONFIRMATION':
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.typeBadgeText, { color: '#0288D1' }]}>✅ CONFIRMATION</Text>
                    </View>
                );
            default:
                return (
                    <View style={[styles.typeBadge, { backgroundColor: '#F1F5F9' }]}>
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
                        <Text style={styles.actionButtonText}>Voir les collectes d urgence →</Text>
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>
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
                <View style={styles.headerTitleRow}>
                    <Text style={styles.headerTitle}>Mes Notifications</Text>
                    {unreadCount > 0 ? (
                        <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
                            <Text style={styles.markAllText}>Tout marquer comme lu</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{unreadCount}</Text>
                        <Text style={styles.statLabel}>Non lue(s) 🔔</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{urgentCount}</Text>
                        <Text style={styles.statLabel}>Alerte(s) 🚨</Text>
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

            {/* Liste des Notifications */}
            <FlatList
                data={filteredNotifications}
                keyExtractor={(item) => item.id}
                renderItem={renderNotificationCard}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#D32F2F']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🔔</Text>
                        <Text style={styles.emptyText}>Aucune notification.</Text>
                        <Text style={styles.emptySubText}>Vous n avez aucun message dans cette catégorie.</Text>
                    </View>
                }
            />

            {/* Barre de Navigation Inférieure */}
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
    headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    markAllButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    markAllText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

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
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardUnread: { backgroundColor: '#FFF8F8', borderColor: '#FFCDD2' },
    cardUrgent: { borderWidth: 1.5, borderColor: '#D32F2F' },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 11, fontWeight: 'bold' },
    dateText: { fontSize: 11, color: '#94A3B8' },

    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D32F2F', marginRight: 6 },
    notifTitle: { fontSize: 15, color: '#1E293B', flex: 1 },
    textBold: { fontWeight: 'bold' },

    notifMessage: { fontSize: 13, color: '#64748B', lineHeight: 18, marginTop: 2 },

    actionButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    actionButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
    emptyIcon: { fontSize: 40, marginBottom: 10 },
    emptyText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
    emptySubText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6 },

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