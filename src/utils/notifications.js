import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { callNotesService } from './callNotes';
import { scheduledCallService } from './scheduledCalls';
import { schedulingHistory } from './scheduler/schedulingHistory';
import { NOTIFICATION_MAP_KEY, REMINDER_TYPES } from '../../constants/notificationConstants';
import { notificationCoordinator } from './notificationCoordinator';
import { EventEmitter } from 'events';
const eventEmitter = new EventEmitter();

class NotificationService {
	constructor() {
		this.badgeCount = 0;
		this.initialized = false;
		this.notificationMap = new Map();
	}

	async initialize() {
		if (this.initialized) return;

		try {
			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: true,
					shouldSetBadge: true,
				}),
			});

			// Request permissions during initialization
			await this.requestPermissions();

			// Restore badge count
			const storedBadgeCount = await AsyncStorage.getItem('badgeCount');
			this.badgeCount = storedBadgeCount ? parseInt(storedBadgeCount, 10) : 0;

			// Restore notification map
			const storedMap = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
			if (storedMap) {
				this.notificationMap = new Map(JSON.parse(storedMap));
			}

			// Initialize sub-services
			await Promise.all([
				callNotesService.initialize(),
				scheduledCallService.initialize(),
				schedulingHistory.initialize(),
			]);

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

			if (finalStatus !== 'granted') {
				throw new Error('Permission not granted for notifications');
			}

			if (Platform.OS === 'android') {
				await Notifications.setNotificationChannelAsync('default', {
					name: 'default',
					importance: Notifications.AndroidImportance.MAX,
					vibrationPattern: [0, 250, 250, 250],
					lightColor: '#FF231F7C',
				});
			}

			return true;
		} catch (error) {
			console.error('Error requesting notification permissions:', error);
			return false;
		}
	}

	async saveNotificationMap() {
		try {
			await AsyncStorage.setItem(
				NOTIFICATION_MAP_KEY,
				JSON.stringify(Array.from(this.notificationMap.entries()))
			);
		} catch (error) {
			console.error('Error saving notification map:', error);
		}
	}

	async scheduleNotification(content, scheduledTime) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Make sure we have a Date object
			const triggerTime = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);

			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content,
				trigger: triggerTime, // Use Date object directly
			});

			return localNotificationId;
		} catch (error) {
			console.error('Error scheduling notification:', error);
			throw error;
		}
	}

	async scheduleCallFollowUp(contact, time) {
		const followUpId = `FOLLOW_UP_${contact.id}_${Date.now()}`;

		const notificationContent = {
			title: 'Call Follow Up',
			body: `How did your call with ${contact.first_name} go?`,
			data: {
				type: REMINDER_TYPES.FOLLOW_UP,
				contactId: contact.id,
				followUpId: followUpId,
				contactName: `${contact.first_name} ${contact.last_name}`,
				callData: contact.callData,
				startTime: contact.callData.startTime,
			},
			categoryIdentifier: 'FOLLOW_UP',
		};

		let localNotificationId;

		try {
			// Schedule or present the notification
			localNotificationId = await Notifications.scheduleNotificationAsync({
				content: notificationContent,
				trigger: time <= new Date() ? null : { date: time },
			});

			// Store in AsyncStorage
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			let notificationsList = stored ? JSON.parse(stored) : [];

			notificationsList.push({
				id: followUpId,
				localNotificationId,
				scheduledTime: new Date().toISOString(),
				contactName: `${contact.first_name} ${contact.last_name}`,
				data: notificationContent.data,
			});

			await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));

			eventEmitter.emit('followUpCreated');

			// Update badge count properly
			const currentBadge = await Notifications.getBadgeCountAsync();
			await Notifications.setBadgeCountAsync(currentBadge + 1);

			return localNotificationId;
		} catch (error) {
			console.error('Error scheduling call follow-up:', error);
			throw error;
		}
	}

	async cancelNotification(localNotificationId) {
		try {
			await Notifications.cancelScheduledNotificationAsync(localNotificationId);
			return true;
		} catch (error) {
			console.error('Error canceling notification:', error);
			return false;
		}
	}

	async clearAllNotifications() {
		return await notificationCoordinator.clearAllNotifications();
	}

	async incrementBadge() {
		this.badgeCount++;
		await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
		return this.badgeCount;
	}

	async decrementBadge() {
		if (this.badgeCount > 0) {
			this.badgeCount--;
			await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
		}
		return this.badgeCount;
	}

	async getActiveReminders() {
		try {
			if (!this.initialized) {
				await this.initialize();
			}
			const reminders = await scheduledCallService.getActiveReminders();
			return reminders;
		} catch (error) {
			console.error('Error getting active reminders:', error);
			return [];
		}
	}

	async handleFollowUpComplete(reminderId, notes = '') {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			// Cancel any existing notification
			const mapping = this.notificationMap.get(reminderId);
			if (mapping) {
				await this.cancelNotification(mapping.localId);
			}

			// Update the notification map
			this.notificationMap.delete(reminderId);
			await this.saveNotificationMap();

			// Decrease badge count
			await this.decrementBadge();

			// Update the reminder in Firestore
			const reminder = await callNotesService.handleFollowUpComplete(reminderId, notes);

			return reminder;
		} catch (error) {
			console.error('Error completing follow-up:', error);
			throw error;
		}
	}
}

export const notificationService = new NotificationService();

export { eventEmitter };
