import * as Notifications from 'expo-notifications';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { REMINDER_STATUS } from '../../../constants/notificationConstants';

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
			// Cancel existing notification if it exists
			await this.cancelLocalNotification(reminder.id);

			// Convert scheduledTime to Date if it isn't already
			const scheduledTime =
				reminder.scheduledTime instanceof Date ? reminder.scheduledTime : new Date(reminder.scheduledTime);

			// Only schedule if the time is in the future
			if (scheduledTime > new Date()) {
				const notificationId = await Notifications.scheduleNotificationAsync({
					content: {
						title: reminder.title || `Reminder for ${reminder.contactName}`,
						body: reminder.body || 'Time to reach out!',
						data: {
							reminderId: reminder.id,
							contactId: reminder.contact_id,
							type: reminder.type,
						},
					},
					trigger: {
						date: scheduledTime,
					},
				});

				this.localNotifications.set(reminder.id, notificationId);
			}
		} catch (error) {
			console.error('Error scheduling local notification:', error);
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
}

export const reminderSync = new ReminderSync();
export default reminderSync;
