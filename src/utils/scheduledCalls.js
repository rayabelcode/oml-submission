import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { addReminder, updateReminder, getReminder, getReminders, getContactById } from './firestore';
import { auth } from '../config/firebase';
import { notificationCoordinator } from './notificationCoordinator';
import {
	NOTIFICATION_TYPES,
	REMINDER_STATUS,
	REMINDER_TYPES,
	SNOOZE_OPTIONS,
	MAX_SNOOZE_ATTEMPTS,
	NOTIFICATION_MESSAGES,
} from '../../constants/notificationConstants';

class ScheduledCallService {
	constructor() {
		this.initialized = false;
		this.subscription = null;
	}

	async initialize() {
		if (this.initialized) return;

		try {
			this.subscription = Notifications.addNotificationResponseReceivedListener(
				this.handleNotificationResponse
			);

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize scheduled calls service:', error);
			return false;
		}
	}

	handleNotificationResponse = async (response) => {
		try {
			const data = response.notification.request.content.data;
			if (data.type === NOTIFICATION_TYPES.CONTACT_REMINDER && data.firestoreId && data.contactId) {
				const reminder = await getReminder(data.firestoreId);
				const contact = await getContactById(data.contactId);

				if (!reminder || !contact) {
					console.error('Failed to load reminder or contact details');
					return;
				}

				Alert.alert(`Contact ${contact.first_name}`, NOTIFICATION_MESSAGES.CONTACT_ACTION.title, [
					{
						text: 'Call',
						onPress: () => {
							// Navigate to contact details
							if (global.navigationRef) {
								global.navigationRef.navigate('ContactDetails', { contact });
							}
						},
					},
					{
						text: 'Snooze',
						onPress: () => this.showSnoozeOptions(reminder),
					},
					{
						text: 'Cancel',
						style: 'cancel',
					},
				]);
			}
		} catch (error) {
			console.error('[ScheduledCallService] Error handling notification response:', error);
		}
	};

	showSnoozeOptions = async (reminder) => {
		const snoozeCount = reminder.snooze_history?.length || 0;

		if (snoozeCount >= MAX_SNOOZE_ATTEMPTS) {
			Alert.alert(
				NOTIFICATION_MESSAGES.MAX_SNOOZE_REACHED.title,
				NOTIFICATION_MESSAGES.MAX_SNOOZE_REACHED.message,
				[
					{
						text: 'No, keep reminder',
						style: 'cancel',
					},
					{
						text: 'Yes, skip this call',
						style: 'destructive',
						onPress: () => this.handleSkip(reminder.id),
					},
				]
			);
			return;
		}

		// Show snooze options directly
		Alert.alert('Snooze Options', 'Choose when to be reminded:', [
			{
				text: 'In 1 hour',
				onPress: () => this.handleSnooze(reminder.id, { hours: 1, id: '1h' }),
			},
			{
				text: 'In 3 hours',
				onPress: () => this.handleSnooze(reminder.id, { hours: 3, id: '3h' }),
			},
			{
				text: 'Tomorrow',
				onPress: () => this.handleSnooze(reminder.id, { days: 1, id: '1d' }),
			},

			{
				text: 'Cancel',
				style: 'cancel',
			},
		]);
	};

	async handleSnooze(reminderId, option) {
		try {
			const reminder = await getReminder(reminderId);
			if (!reminder) throw new Error('Reminder not found');

			let newTime = new Date();
			if (option.hours) {
				newTime.setHours(newTime.getHours() + option.hours);
			} else if (option.days) {
				newTime.setDate(newTime.getDate() + option.days);
			}

			const snoozeHistory = reminder.snooze_history || [];
			snoozeHistory.push({
				from_date: reminder.scheduledTime,
				to_date: newTime,
				reason: option.id,
				count: snoozeHistory.length + 1,
			});

			await updateReminder(reminderId, {
				scheduledTime: newTime,
				status: REMINDER_STATUS.SNOOZED,
				snooze_history: snoozeHistory,
				updated_at: new Date(),
			});

			const contact = await getContactById(reminder.contactId);
			await this.scheduleContactReminder(contact, newTime, reminder.userId);

			const schedulingHistoryService = notificationCoordinator.getService('schedulingHistory');
			await schedulingHistoryService.trackSnooze(reminderId, reminder.scheduledTime, newTime, option.id);

			return { success: true };
		} catch (error) {
			console.error('Error handling snooze:', error);
			throw error;
		}
	}

	async handleSkip(reminderId) {
		try {
			await updateReminder(reminderId, {
				status: REMINDER_STATUS.SKIPPED,
				updated_at: new Date(),
			});

			const existingMapping = notificationCoordinator.notificationMap.get(reminderId);
			if (existingMapping) {
				await notificationCoordinator.cancelNotification(existingMapping.localId);
			}

			const schedulingHistoryService = notificationCoordinator.getService('schedulingHistory');
			await schedulingHistoryService.trackSkip(reminderId, new Date());

			return true;
		} catch (error) {
			console.error('Error handling skip:', error);
			throw error;
		}
	}

	async scheduleContactReminder(contact, date, userId) {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const reminderData = {
				contactId: contact.id,
				scheduledTime: date,
				created_at: new Date(),
				updated_at: new Date(),
				snoozed: false,
				needs_attention: false,
				type: REMINDER_TYPES.REGULAR,
				status: REMINDER_STATUS.PENDING,
				notes: contact.notes || '',
				userId: userId,
				contactName: `${contact.first_name} ${contact.last_name}`,
				snooze_history: [],
			};

			const firestoreId = await addReminder(reminderData);

			const notificationContent = {
				title: `Reminder: Contact ${contact.first_name}`,
				body: contact.notes ? `Note: ${contact.notes}` : 'Time to catch up!',
				data: {
					contactId: contact.id,
					firestoreId: firestoreId,
					type: NOTIFICATION_TYPES.CONTACT_REMINDER,
				},
				sound: true,
			};

			const trigger = date instanceof Date ? { date } : null;
			const localNotificationId = await notificationCoordinator.scheduleNotification(
				notificationContent,
				trigger
			);

			notificationCoordinator.notificationMap.set(firestoreId, {
				localId: localNotificationId,
				scheduledTime: date,
			});
			await notificationCoordinator.saveNotificationMap();
			await notificationCoordinator.incrementBadge();

			return { firestoreId, localNotificationId };
		} catch (error) {
			console.error('Error scheduling contact reminder:', error);
			return null;
		}
	}

	async getActiveReminders() {
		try {
			if (!auth.currentUser) {
				return [];
			}

			const reminders = await getReminders(auth.currentUser.uid, REMINDER_STATUS.PENDING);

			return reminders.map((reminder) => ({
				firestoreId: reminder.id,
				scheduledTime: reminder.scheduledTime,
				contactName: reminder.contactName,
				type: reminder.type || REMINDER_TYPES.SCHEDULED,
				data: {
					contactId: reminder.contact_id,
					type: reminder.type,
				},
			}));
		} catch (error) {
			console.error('[ScheduledCallService] Error getting active reminders:', error);
			return [];
		}
	}
}

export const scheduledCallService = new ScheduledCallService();
