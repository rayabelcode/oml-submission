import * as Notifications from 'expo-notifications';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { DateTime } from 'luxon';
import * as NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../../config/firebase';
import { REMINDER_STATUS } from '../../../constants/notificationConstants';
import { getUserPreferences } from '../../utils/preferences';

class ReminderSync {
	constructor() {
		this.unsubscribe = null;
		this.localNotifications = new Map();
		this.initialized = false;
		this.authTimeout = 5000;
		this.offlineQueue = new Map();
	}

	async start(options = {}) {
		if (this.initialized) return;

		try {
			// Wait for auth to be ready
			if (!auth.currentUser) {
				await new Promise((resolve) => {
					const unsubscribe = auth.onAuthStateChanged((user) => {
						if (user) {
							unsubscribe();
							resolve();
						}
					});
					// Use immediate timeout in test environment
					const timeout = options.testing ? 0 : this.authTimeout;
					setTimeout(() => {
						unsubscribe();
						resolve();
					}, timeout);
				});
			}

			if (!auth.currentUser) {
				console.error('No authenticated user');
				return;
			}

			// Get all current local notifications
			const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
			scheduledNotifications.forEach((notification) => {
				if (notification.content.data?.reminderId) {
					this.localNotifications.set(notification.content.data.reminderId, notification.identifier);
				}
			});

			// Load offline queue
			await this.loadOfflineQueue();

			// Subscribe to Firestore reminders
			const remindersRef = collection(db, 'reminders');
			const q = query(
				remindersRef,
				where('user_id', '==', auth.currentUser.uid),
				where('status', '==', REMINDER_STATUS.PENDING)
			);

			this.unsubscribe = onSnapshot(q, this.handleReminderUpdate.bind(this));
			this.initialized = true;

			// Check for offline items to sync
			const networkState = await NetInfo.fetch();
			if (networkState.isConnected) {
				await this.syncOfflineQueue();
			}
		} catch (error) {
			console.error('Error starting reminder sync:', error);
		}
	}

	async loadOfflineQueue() {
		try {
			const storedQueue = await AsyncStorage.getItem('reminderSync_offlineQueue');
			if (storedQueue) {
				this.offlineQueue = new Map(JSON.parse(storedQueue));
			}
		} catch (error) {
			console.error('Error loading offline queue:', error);
			this.offlineQueue = new Map();
		}
	}

	async persistOfflineQueue() {
		try {
			await AsyncStorage.setItem(
				'reminderSync_offlineQueue',
				JSON.stringify(Array.from(this.offlineQueue.entries()))
			);
		} catch (error) {
			console.error('Error persisting offline queue:', error);
		}
	}

	stop() {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.localNotifications.clear();
		this.offlineQueue.clear();
		this.initialized = false;
	}

	async handleReminderUpdate(snapshot) {
		try {
			const networkState = await NetInfo.fetch();
			const changes = snapshot.docChanges();

			for (const change of changes) {
				const reminder = { id: change.doc.id, ...change.doc.data() };

				if (!networkState.isConnected) {
					if (change.type === 'added' || change.type === 'modified') {
						await this.handleOfflineReminder(reminder);
					}
					continue;
				}

				if (change.type === 'added' || change.type === 'modified') {
					await this.scheduleLocalNotification(reminder);
				} else if (change.type === 'removed') {
					await this.cancelLocalNotification(reminder.id);
				}
			}
		} catch (error) {
			console.error('Error handling reminder update:', error);
		}
	}

	async handleOfflineReminder(reminder) {
		try {
			const notificationId = await this.scheduleLocalNotification(reminder);
			this.offlineQueue.set(reminder.id, {
				reminder,
				notificationId,
				timestamp: new Date().toISOString(),
			});
			await this.persistOfflineQueue();
		} catch (error) {
			console.error('Error handling offline reminder:', error);
		}
	}

	async syncOfflineQueue() {
		if (this.offlineQueue.size === 0) return;

		try {
			for (const [reminderId, { reminder }] of this.offlineQueue) {
				await this.scheduleLocalNotification(reminder);
				this.offlineQueue.delete(reminderId);
			}
			await this.persistOfflineQueue();
		} catch (error) {
			console.error('Error syncing offline queue:', error);
		}
	}

	async scheduleLocalNotification(reminder) {
		try {
			// Get notification settings
			const cloudNotificationsEnabled = await AsyncStorage.getItem('cloudNotificationsEnabled');

			// For SCHEDULED or CUSTOM_DATE types, check if notifications are disabled
			if (
				cloudNotificationsEnabled === 'false' &&
				(reminder.type === 'SCHEDULED' || reminder.type === 'CUSTOM_DATE')
			) {
				// Cancel existing local notification (doesn't affect the Firebase, only local)
				await this.cancelLocalNotification(reminder.id);
				return null;
			}

			// Cancel any existing notification before scheduling new one
			await this.cancelLocalNotification(reminder.id);

			let userTimezone;
			try {
				const userPrefs = await getUserPreferences(reminder.user_id);
				userTimezone = userPrefs.timezone || DateTime.local().zoneName;
			} catch (error) {
				console.error('Error getting user timezone:', error);
				userTimezone = DateTime.local().zoneName;
			}

			const scheduledTime = reminder?.scheduledTime
				? reminder.scheduledTime instanceof Timestamp
					? reminder.scheduledTime.toDate()
					: reminder.scheduledTime instanceof Date
					? reminder.scheduledTime
					: new Date(reminder.scheduledTime)
				: null;

			if (!scheduledTime) {
				console.error('Invalid scheduledTime for reminder:', reminder);
				return null;
			}

			const localDateTime = DateTime.fromJSDate(scheduledTime).setZone(userTimezone, { keepLocalTime: true });

			if (localDateTime.toJSDate() > new Date()) {
				const notificationId = await Notifications.scheduleNotificationAsync({
					content: {
						title: reminder.title || `Reminder for ${reminder.contactName}`,
						body: reminder.body || 'Time to reach out!',
						data: {
							reminderId: reminder.id,
							contactId: reminder.contact_id,
							type: reminder.type,
							scheduledTimezone: userTimezone,
							originalTime: scheduledTime.toISOString(),
						},
					},
					trigger: {
						type: 'date',
						date: localDateTime.toJSDate(),
					},
				});

				this.localNotifications.set(reminder.id, notificationId);
				return notificationId;
			}
			return null;
		} catch (error) {
			console.error('Error scheduling local notification:', error);
			throw error;
		}
	}

	async cancelLocalNotification(reminderId) {
		try {
			const notificationId = this.localNotifications.get(reminderId);
			if (notificationId) {
				await Notifications.cancelScheduledNotificationAsync(notificationId);
				this.localNotifications.delete(reminderId);
			}
		} catch (error) {
			console.error('Error canceling local notification:', error);
		}
	}

	async handleTimezoneChange(newTimezone) {
		try {
			// Validate timezone
			const testDate = DateTime.now().setZone(newTimezone);
			if (!testDate.isValid) {
				throw new Error('Invalid timezone');
			}

			// Reschedule all existing notifications
			const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

			for (const notification of scheduledNotifications) {
				const { reminderId, originalTime, scheduledTimezone } = notification.content.data || {};

				if (reminderId && originalTime) {
					await this.cancelLocalNotification(reminderId);

					// Convert original time to new timezone
					const newDateTime = DateTime.fromISO(originalTime).setZone(newTimezone, { keepLocalTime: true });

					const notificationId = await Notifications.scheduleNotificationAsync({
						content: {
							...notification.content,
							data: {
								...notification.content.data,
								scheduledTimezone: newTimezone,
							},
						},
						trigger: {
							date: newDateTime.toJSDate(),
						},
					});

					this.localNotifications.set(reminderId, notificationId);
				}
			}
		} catch (error) {
			console.error('Error handling timezone change:', error);
		}
	}
}

export const reminderSync = new ReminderSync();
export default reminderSync;
