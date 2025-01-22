import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import './src/utils/notifications/notificationHandler';

import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import SharedNavigator from './src/navigation/SharedNavigator';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, LogBox, Platform, View, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
import SafeAreaWrapper from './src/components/general/SafeAreaView';
import { navigationRef } from './src/navigation/RootNavigation';
import { PreloadProvider } from './src/context/PreloadContext';
import { fetchContacts, fetchUpcomingContacts, getUserProfile } from './src/utils/firestore';
import { cacheManager } from './src/utils/cache';
import { setupAvoidSoftInputGlobalSettings } from './src/utils/componentSettings';
import { notificationCoordinator } from './src/utils/notificationCoordinator';
import { callNotesService } from './src/utils/callNotes';
import { scheduledCallService } from './src/utils/scheduledCalls';
import { schedulingHistory } from './src/utils/schedulingHistory';

// Disable ScrollView scrollbar globally
const originalScrollViewRender = ScrollView.render;
ScrollView.render = function render(props) {
	return originalScrollViewRender.call(this, {
		...props,
		showsVerticalScrollIndicator: false, // Disable vertical scrollbar
	});
};

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
		if (Platform.OS === 'ios') {
			Notifications.setBadgeCountAsync(0);
		}
	}, [user]);

	useEffect(() => {
		async function preloadData() {
			if (user) {
				try {
					// Try cached data first
					const [cachedContacts, cachedUpcoming, cachedProfile] = await Promise.all([
						cacheManager.getCachedContacts(user.uid),
						cacheManager.getCachedUpcomingContacts(user.uid),
						cacheManager.getCachedProfile(user.uid),
					]);

					// Fetch fresh data
					await Promise.all([
						fetchContacts(user.uid).then((contacts) => cacheManager.saveContacts(user.uid, contacts)),
						fetchUpcomingContacts(user.uid).then((contacts) =>
							cacheManager.saveUpcomingContacts(user.uid, contacts)
						),
						getUserProfile(user.uid).then((profile) => cacheManager.saveProfile(user.uid, profile)),
					]);
				} catch (error) {
					console.error('Error preloading data:', error);
				} finally {
					setIsDataPreloaded(true);
				}
			} else {
				setIsDataPreloaded(true);
			}
		}

		preloadData();
	}, [user]);

	// Don't render the app until preload is complete
	if (!isDataPreloaded) {
		return null;
	}

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
				// Register services
				notificationCoordinator.registerService('callNotes', callNotesService);
				notificationCoordinator.registerService('scheduledCalls', scheduledCallService);
				notificationCoordinator.registerService('schedulingHistory', schedulingHistory);

				await Promise.all([
					Font.loadAsync({
						'SpaceMono-Regular': require('./assets/fonts/SpaceMono-Regular.ttf'),
					}),
					notificationCoordinator.initialize(),
					// Clear badges when app opens
					Platform.OS === 'ios' ? Notifications.setBadgeCountAsync(0) : null,
				]);

				Notifications.addNotificationReceivedListener((notification) => {
					// Handle notifications received while app is in the foreground
					if (Platform.OS === 'ios') {
						notificationCoordinator.incrementBadge();
					}
				});
			} catch (e) {
				console.warn(e);
			} finally {
				setAppIsReady(true);
			}
		}

		prepare();
	}, []);

	// Apply global AvoidSoftInput (react-native-avoid-softinput) settings
	useEffect(() => {
		setupAvoidSoftInputGlobalSettings();
	}, []);

	const onLayoutRootView = useCallback(async () => {
		if (appIsReady) {
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
