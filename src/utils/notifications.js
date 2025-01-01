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
		console.log('[NotificationService] Scheduling call follow-up for:', {
			contactId: contact.id,
			time: notificationTime,
		});

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

			console.log('[NotificationService] Notification scheduled with ID:', localNotificationId);
			return firestoreId;
		} catch (error) {
			console.error('[NotificationService] Error scheduling call follow-up:', error);
			throw error;
		}
	}

	async getActiveReminders() {
		try {
			if (!auth.currentUser) {
				console.log('[NotificationService] No authenticated user');
				return [];
			}

			console.log('[NotificationService] Getting active reminders for user:', auth.currentUser.uid);
			const reminders = await getReminders(auth.currentUser.uid, 'pending');
			console.log('[NotificationService] Retrieved reminders:', reminders);

			// Map the reminders to the expected format
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

	async scheduleFollowUpReminder(contact, callEndTime, userId) {
		try {
			// Schedule follow-up reminder 1 minute after call ends
			const followUpTime = new Date(callEndTime.getTime() + 1 * 60 * 1000);

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
			// Get all pending reminders from Firestore
			const reminders = await getReminders(auth.currentUser.uid, 'pending');

			return reminders.map((reminder) => ({
				firestoreId: reminder.id,
				scheduledTime: reminder.scheduledTime,
				contactName: reminder.contactName,
				data: {
					contactId: reminder.contactId,
					callData: reminder.call_data,
				},
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

			// Cancel existing notification
			await this.cancelReminder(reminderId);

			// Schedule new follow-up
			const result = await this.scheduleFollowUpReminder(reminder.contact, newTime, reminder.userId);

			return result;
		} catch (error) {
			console.error('Error rescheduling follow-up:', error);
			return null;
		}
	}
}

export const notificationService = new NotificationService();
