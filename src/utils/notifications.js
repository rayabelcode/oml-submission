import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class NotificationService {
	constructor() {
		this.badgeCount = 0;
		this.initialized = false;
	}

	async initialize() {
		if (this.initialized) return;

		try {
			// Configure notification behavior
			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: true,
					shouldSetBadge: true,
				}),
			});

			// Restore badge count from storage
			const storedBadgeCount = await AsyncStorage.getItem('badgeCount');
			this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize notification service:', error);
			return false;
		}
	}

	async requestPermissions() {
		try {
			const { status: existingStatus } = await Notifications.getPermissionsAsync();
			let finalStatus = existingStatus;

			if (existingStatus !== 'granted') {
				const { status } = await Notifications.requestPermissionsAsync();
				finalStatus = status;
			}

			return finalStatus === 'granted';
		} catch (error) {
			console.error('Error requesting notification permissions:', error);
			return false;
		}
	}

	// Test method
	async scheduleTestNotification() {
		try {
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Test Notification',
					body: 'If you see this, notifications are working!',
					badge: this.badgeCount + 1,
				},
				trigger: {
					seconds: 5, // Will trigger in 5 seconds
				},
			});
			this.badgeCount++;
			await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
			return true;
		} catch (error) {
			console.error('Error scheduling test notification:', error);
			return false;
		}
	}
}

export const notificationService = new NotificationService();
