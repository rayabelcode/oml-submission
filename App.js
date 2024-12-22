import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import TabNavigator from './src/navigation/TabNavigator';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, LogBox, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Sentry.init({
	dsn: Constants.expoConfig?.extra?.SENTRY_DSN || Constants.manifest?.extra?.SENTRY_DSN,
	enableNative: false,
	debug: false,
});

LogBox.ignoreLogs(['Setting a timer', 'AsyncStorage has been extracted from react-native core']);

async function registerForPushNotificationsAsync() {
	if (Platform.OS === 'web') {
		return null;
	}

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;

	if (existingStatus !== 'granted') {
		const { status } = await Notifications.requestPermissionsAsync();
		finalStatus = status;
	}

	if (finalStatus !== 'granted') {
		Alert.alert('Error', 'Push notifications permission not granted!');
		return null;
	}

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
		<ThemeProvider>
			<AuthProvider>
				<NavigationContainer>
					<TabNavigator />
				</NavigationContainer>
			</AuthProvider>
		</ThemeProvider>
	);
}

const SentryWrappedApp = Sentry.wrap(App);

export default function AppContainer() {
	return <SentryWrappedApp />;
}
