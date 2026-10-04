import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
} from '@react-native-firebase/messaging';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

// Demande de permission pour Android 13+ (POST_NOTIFICATIONS)
async function requestAndroid13Permission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

export async function initFcmNotifications() {
  try {
    // 1. Demande de permission système Android 13+
    await requestAndroid13Permission();

    // 2. Initialiser l'instance Firebase Messaging
    const messagingInstance = getMessaging();

    // 3. Demander la permission Firebase
    const authStatus = await requestPermission(messagingInstance);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      // 4. Récupérer le token FCM
      const fcmToken = await getToken(messagingInstance);
      console.log('=== FCM TOKEN MOBILE ===:', fcmToken);
      return fcmToken;
    } else {
      console.log('Permission de notification refusée');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du token FCM:', error);
  }
}

// Écouteur de notifications au premier plan (Foreground)
export function setupForegroundNotificationListener() {
  const messagingInstance = getMessaging();

  return onMessage(messagingInstance, async remoteMessage => {
    Alert.alert(
      remoteMessage.notification?.title || 'Nouvelle notification',
      remoteMessage.notification?.body || '',
    );
  });
}