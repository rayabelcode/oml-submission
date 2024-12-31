import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { addReminder, updateReminder, deleteReminder } from './firestore';

const REMINDER_SOUNDS = {
	family: 'family.wav',
	friend: 'friend.wav',
	work: 'work.wav',
	personal: 'personal.wav',
};

const NOTIFICATION_MAP_KEY = 'notification_map';

class NotificationService {
	constructor() {
		this.badgeCount = 0;
		this.initialized = false;
		this.notificationMap = new Map(); // maps Firestore IDs to local notification IDs
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

			if (Platform.OS === 'ios') {
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

	async scheduleContactReminder(contact, date, userId) {
		try {
			// Create Firestore reminder first
			const reminderData = {
				contact_id: contact.id,
				date: date,
				created_at: new Date(),
				updated_at: new Date(),
				snoozed: false,
				follow_up: false,
				type: 'regular',
				status: 'pending',
				notes: contact.notes || '',
				user_id: userId,
			};

			const firestoreId = await addReminder(reminderData);

			// Schedule local notification
			const notificationContent = {
				title: `Reminder: Contact ${contact.first_name}`,
				body: contact.notes ? `Note: ${contact.notes}` : 'Time to catch up!',
				data: {
					contactId: contact.id,
					firestoreId: firestoreId,
					type: 'contact_reminder',
				},
				badge: this.badgeCount + 1,
				sound: contact.scheduling?.relationship_type
					? REMINDER_SOUNDS[contact.scheduling.relationship_type]
					: REMINDER_SOUNDS.personal,
			};

			const trigger = date instanceof Date ? { date } : null;

			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content: notificationContent,
				trigger,
			});

			// Store mapping
			this.notificationMap.set(firestoreId, {
				localId: localNotificationId,
				scheduledTime: date,
			});
			await this.saveNotificationMap();

			// Update badge count
			this.badgeCount++;
			await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());

			return { firestoreId, localNotificationId };
		} catch (error) {
			console.error('Error scheduling contact reminder:', error);
			return null;
		}
	}

	async scheduleFollowUpReminder(contact, callEndTime, userId) {
		try {
			const followUpTime = new Date(callEndTime.getTime() + 3 * 60 * 1000);

			const result = await this.scheduleContactReminder(
				{
					...contact,
					notes: 'Add notes about your recent call',
				},
				followUpTime,
				userId
			);

			if (result) {
				await updateReminder(result.firestoreId, {
					type: 'follow_up',
				});
			}

			return result;
		} catch (error) {
			console.error('Error scheduling follow-up reminder:', error);
			return null;
		}
	}

	async cancelReminder(firestoreId) {
		try {
			const mapping = this.notificationMap.get(firestoreId);
			if (mapping) {
				// Cancel local notification
				await Notifications.cancelScheduledNotificationAsync(mapping.localId);

				// Update Firestore
				await updateReminder(firestoreId, { status: 'cancelled' });

				// Update local state
				this.notificationMap.delete(firestoreId);
				await this.saveNotificationMap();

				// Update badge count
				if (this.badgeCount > 0) {
					this.badgeCount--;
					await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error('Error canceling reminder:', error);
			return false;
		}
	}

	async getActiveReminders() {
		try {
			const localNotifications = await Notifications.getAllScheduledNotificationsAsync();
			return Array.from(this.notificationMap.entries()).map(([firestoreId, mapping]) => ({
				firestoreId,
				...mapping,
				localNotification: localNotifications.find((n) => n.identifier === mapping.localId),
			}));
		} catch (error) {
			console.error('Error getting active reminders:', error);
			return [];
		}
	}

	async clearAllReminders(userId) {
		try {
			// Cancel all local notifications
			await Notifications.cancelAllScheduledNotificationsAsync();

			// Update all Firestore reminders
			for (const [firestoreId] of this.notificationMap) {
				await updateReminder(firestoreId, { status: 'cancelled' });
			}

			// Clear local state
			this.notificationMap.clear();
			await this.saveNotificationMap();

			this.badgeCount = 0;
			await AsyncStorage.setItem('badgeCount', '0');

			return true;
		} catch (error) {
			console.error('Error clearing all reminders:', error);
			return false;
		}
	}
}

export const notificationService = new NotificationService();
