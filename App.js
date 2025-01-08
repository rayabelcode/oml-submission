import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import SharedNavigator from './src/navigation/SharedNavigator';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, LogBox, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from './src/utils/notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import SafeAreaWrapper from './src/components/general/SafeAreaView';
import { navigationRef } from './src/navigation/RootNavigation';
import { PreloadProvider } from './src/context/PreloadContext';
import { fetchContacts, fetchUpcomingContacts } from './src/utils/firestore';
import { cacheManager } from './src/utils/cache';

SplashScreen.preventAutoHideAsync();

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
	return token;
}

function AppContent() {
	const { user } = useAuth();
	const [isDataPreloaded, setIsDataPreloaded] = useState(false);

	useEffect(() => {
		async function preloadData() {
			if (user && !isDataPreloaded) {
				try {
					// Fetch and cache in parallel
					await Promise.all([
						fetchContacts(user.uid).then((contacts) => cacheManager.saveContacts(user.uid, contacts)),
						fetchUpcomingContacts(user.uid).then((contacts) =>
							cacheManager.saveUpcomingContacts(user.uid, contacts)
						),
					]);

					setIsDataPreloaded(true);
				} catch (error) {
					console.error('Error preloading data:', error);
					setIsDataPreloaded(true); // Continue even if preload fails
				}
			}
		}

		preloadData();
	}, [user]);

	return (
		<NavigationContainer ref={navigationRef}>
			<SafeAreaWrapper>
				<SharedNavigator />
			</SafeAreaWrapper>
		</NavigationContainer>
	);
}

function App() {
	const [appIsReady, setAppIsReady] = useState(false);

	useEffect(() => {
		async function prepare() {
			try {
				await Promise.all([
					Font.loadAsync({
						'SpaceMono-Regular': require('./assets/fonts/SpaceMono-Regular.ttf'),
					}),
					notificationService.initialize(),
				]);

				Notifications.addNotificationReceivedListener((notification) => {});
			} catch (e) {
				console.warn(e);
			} finally {
				setAppIsReady(true);
			}
		}

		prepare();
	}, []);

	const onLayoutRootView = useCallback(async () => {
		if (appIsReady) {
			await SplashScreen.hideAsync();
		}
	}, [appIsReady]);

	if (!appIsReady) {
		return null;
	}

	return (
		<View style={{ flex: 1 }} onLayout={onLayoutRootView}>
			<ThemeProvider>
				<AuthProvider>
					<PreloadProvider>
						<AppContent />
					</PreloadProvider>
				</AuthProvider>
			</ThemeProvider>
		</View>
	);
}

const SentryWrappedApp = Sentry.wrap(App);

export default function AppContainer() {
	return <SentryWrappedApp />;
}
