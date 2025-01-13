import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
	addReminder,
	updateReminder,
	deleteReminder,
	completeFollowUp,
	getReminder,
	getReminders,
} from './firestore';
import { auth } from '../config/firebase';
import { navigate } from '../navigation/RootNavigation';
import { getContactById } from './firestore';

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

			// Add notification tap listener
			const subscription = Notifications.addNotificationResponseReceivedListener(
				this.handleNotificationResponse
			);

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

	handleNotificationResponse = async (response) => {
		try {
			const data = response.notification.request.content.data;
			if (data.type === 'call_follow_up' && data.firestoreId && data.contactId) {
				const contact = await getContactById(data.contactId);
				if (contact) {
					navigate('ContactDetails', {
						contact: contact,
						initialTab: 'Notes',
						reminderId: data.firestoreId,
					});
				}
			}
		} catch (error) {
			console.error('[NotificationService] Error handling notification response:', error);
		}
	};

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

	async scheduleContactReminder(contact, date, userId) {
		try {
			// Create Firestore reminder first
			const reminderData = {
				contactId: contact.id,
				scheduledTime: date,
				created_at: new Date(),
				updated_at: new Date(),
				snoozed: false,
				follow_up: false,
				type: 'regular',
				status: 'pending',
				notes: contact.notes || '',
				userId: userId,
				contactName: `${contact.first_name} ${contact.last_name}`,
			};

			const firestoreId = await addReminder(reminderData);

			// Schedule local notification with default sound
			const notificationContent = {
				title: `Reminder: Contact ${contact.first_name}`,
				body: contact.notes ? `Note: ${contact.notes}` : 'Time to catch up!',
				data: {
					contactId: contact.id,
					firestoreId: firestoreId,
					type: 'contact_reminder',
				},
				badge: this.badgeCount + 1,
				sound: true,
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

	async scheduleCallFollowUp(contact, notificationTime) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Create reminder data with only necessary fields
			const reminderData = {
				contactId: contact.id,
				scheduledTime: notificationTime,
				type: 'follow_up',
				status: 'pending',
				contactName: `${contact.first_name} ${contact.last_name}`,
				call_data: contact.callData,
			};

			const firestoreId = await addReminder(reminderData);

			// Schedule local notification
			const content = {
				title: `Add Notes for Call with ${contact.first_name}`,
				body: 'Tap to add notes about your recent call',
				data: {
					type: 'call_follow_up',
					contactId: contact.id,
					firestoreId: firestoreId,
					callData: contact.callData,
				},
				sound: true,
			};

			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content,
				trigger: notificationTime instanceof Date ? { date: notificationTime } : null,
			});

			return firestoreId;
		} catch (error) {
			console.error('[NotificationService] Error scheduling call follow-up:', error);
			throw error;
		}
	}

	async getActiveReminders() {
		try {
			if (!auth.currentUser) {
				return [];
			}

			const reminders = await getReminders(auth.currentUser.uid, 'pending');

			return reminders.map((reminder) => ({
				firestoreId: reminder.id,
				scheduledTime: reminder.scheduledTime,
				contactName: reminder.contactName,
				data: {
					contactId: reminder.contact_id,
					callData: reminder.call_data,
					type: reminder.type,
				},
			}));
		} catch (error) {
			console.error('[NotificationService] Error getting active reminders:', error);
			return [];
		}
	}

	async handleFollowUpComplete(reminderId, notes = '') {
		try {
			if (!auth.currentUser) {
				throw new Error('No authenticated user');
			}

			const mapping = this.notificationMap.get(reminderId);
			if (mapping) {
				await Notifications.cancelScheduledNotificationAsync(mapping.localId);
			}

			await completeFollowUp(reminderId, notes);

			this.notificationMap.delete(reminderId);
			await this.saveNotificationMap();

			if (this.badgeCount > 0) {
				this.badgeCount--;
				await AsyncStorage.setItem('badgeCount', this.badgeCount.toString());
			}

			return true;
		} catch (error) {
			console.error('Error completing follow-up:', error);
			throw error;
		}
	}

	async rescheduleFollowUp(reminderId, newTime) {
		try {
			const reminder = await getReminder(reminderId);
			if (!reminder) throw new Error('Reminder not found');

			// Update the existing reminder instead of creating a new one
			await updateReminder(reminderId, {
				scheduledTime: newTime,
				date: newTime,
				status: 'pending',
			});

			// Cancel existing local notification if it exists
			const existingMapping = this.notificationMap.get(reminderId);
			if (existingMapping) {
				await Notifications.cancelScheduledNotificationAsync(existingMapping.localId);
			}

			// Schedule new local notification
			const content = {
				title: `Add Notes for Call with ${reminder.contactName}`,
				body: 'Tap to add notes about your recent call',
				data: {
					type: 'call_follow_up',
					contactId: reminder.contact_id,
					firestoreId: reminderId,
					callData: reminder.call_data,
				},
				sound: true,
			};

			const localNotificationId = await Notifications.scheduleNotificationAsync({
				content,
				trigger: { date: newTime },
			});

			// Update mapping
			this.notificationMap.set(reminderId, {
				localId: localNotificationId,
				scheduledTime: newTime,
			});
			await this.saveNotificationMap();

			return true;
		} catch (error) {
			console.error('Error rescheduling follow-up:', error);
			throw error;
		}
	}

	async clearAllReminders() {
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
