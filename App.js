import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, LogBox, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Initialize Sentry
Sentry.init({
	dsn: Constants.expoConfig?.extra?.SENTRY_DSN || Constants.manifest?.extra?.SENTRY_DSN,
	enableNative: false,
	debug: false,
});

LogBox.ignoreLogs(['Setting a timer', 'AsyncStorage has been extracted from react-native core']);

// Register for Expo Push Notifications
async function registerForPushNotificationsAsync() {
	if (Platform.OS === 'web') {
		return null; // Skip web notifications
	}

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;

	// Request permission if not already granted
	if (existingStatus !== 'granted') {
		const { status } = await Notifications.requestPermissionsAsync();
		finalStatus = status;
	}

	if (finalStatus !== 'granted') {
		Alert.alert('Error', 'Push notifications permission not granted!');
		return null; // Return null if permission is denied
	}

	// Get Expo push token
	const token = (await Notifications.getExpoPushTokenAsync()).data;
	console.log('Expo Push Notification Token:', token);
	return token;
}

function App() {
	useEffect(() => {
		async function setupPushNotifications() {
			await registerForPushNotificationsAsync();

			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: true,
					shouldSetBadge: false,
				}),
			});

			Notifications.addNotificationReceivedListener((notification) => {
				console.log('Foreground notification received:', notification);
			});
		}

		setupPushNotifications();
	}, []);

	return (
		<AuthProvider>
			<NavigationContainer>
				<TabNavigator />
			</NavigationContainer>
		</AuthProvider>
	);
}

const SentryWrappedApp = Sentry.wrap(App);

export default function AppContainer() {
	return <SentryWrappedApp />;
}
