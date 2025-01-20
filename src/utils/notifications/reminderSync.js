import * as Notifications from 'expo-notifications';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DateTime } from 'luxon';
import { db, auth } from '../../config/firebase';
import { REMINDER_STATUS } from '../../../constants/notificationConstants';
import { getUserPreferences } from '../../utils/preferences';

class ReminderSync {
	constructor() {
		this.unsubscribe = null;
		this.localNotifications = new Map();
		this.initialized = false;
		this.authTimeout = 5000;
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

			// Subscribe to Firestore reminders
			const remindersRef = collection(db, 'reminders');
			const q = query(
				remindersRef,
				where('user_id', '==', auth.currentUser.uid),
				where('status', '==', REMINDER_STATUS.PENDING)
			);

			this.unsubscribe = onSnapshot(q, this.handleReminderUpdate.bind(this));
			this.initialized = true;
		} catch (error) {
			console.error('Error starting reminder sync:', error);
		}
	}

	stop() {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.localNotifications.clear();
		this.initialized = false;
	}

	async handleReminderUpdate(snapshot) {
		try {
			const changes = snapshot.docChanges();

			for (const change of changes) {
				const reminder = { id: change.doc.id, ...change.doc.data() };

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

	async scheduleLocalNotification(reminder) {
		try {
			await this.cancelLocalNotification(reminder.id);

			// Get user's timezone preference with error handling
			let userTimezone;
			try {
				const userPrefs = await getUserPreferences(reminder.user_id);
				userTimezone = userPrefs.timezone || DateTime.local().zoneName;
			} catch (error) {
				console.error('Error getting user timezone:', error);
				userTimezone = DateTime.local().zoneName;
			}

			// Convert scheduledTime to Date if it isn't already
			const scheduledTime =
				reminder.scheduledTime instanceof Date ? reminder.scheduledTime : new Date(reminder.scheduledTime);

			// Convert to user's timezone while preserving the local time
			const localDateTime = DateTime.fromJSDate(scheduledTime).setZone(userTimezone, { keepLocalTime: true });

			// Only schedule if the time is in the future
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
						date: localDateTime.toJSDate(),
					},
				});

				this.localNotifications.set(reminder.id, notificationId);
				return notificationId; // Return value for testing
			}
			return null;
		} catch (error) {
			console.error('Error scheduling local notification:', error);
			throw error; // Rethrow to help with testing
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
