import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';

import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import TabNavigator from './src/navigation/TabNavigator';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Alert, LogBox, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import SafeAreaWrapper from './src/components/general/SafeAreaView';

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
	console.log('Expo Push Notification Token:', token);
	return token;
}

function App() {
	const [appIsReady, setAppIsReady] = useState(false);

	useEffect(() => {
		async function prepare() {
			try {
				await Font.loadAsync({
					'SpaceMono-Regular': require('./assets/fonts/SpaceMono-Regular.ttf'),
				});

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
					<NavigationContainer>
						<SafeAreaWrapper>
							<TabNavigator />
						</SafeAreaWrapper>
					</NavigationContainer>
				</AuthProvider>
			</ThemeProvider>
		</View>
	);
}

const SentryWrappedApp = Sentry.wrap(App);

export default function AppContainer() {
	return <SentryWrappedApp />;
}
