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
// Using direct navigation import to avoid circular dependencies
import { navigate } from '../navigation/RootNavigation';

class ScheduledCallService {
	constructor() {
		this.initialized = false;
		// Removed notification subscription - handled by notificationHandler.js now
	}

	async initialize() {
		if (this.initialized) return;
		this.initialized = true;
		return true;
	}

	// Updated to use navigation as the primary approach for consistency
	showSnoozeOptions = async (reminder) => {
		try {
			// Using navigationRef removed to avoid testing issues
			navigate('Dashboard', {
				openSnoozeForReminder: {
					firestoreId: reminder.id,
					contact_id: reminder.contactId || reminder.contact_id,
					type: reminder.type || REMINDER_TYPES.SCHEDULED,
					scheduledTime:
						reminder.scheduledTime instanceof Date
							? reminder.scheduledTime
							: new Date(reminder.scheduledTime),
				},
			});
		} catch (error) {
			// Fallback if navigation fails
			console.error('Navigation failed:', error);

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
							text: 'Yes, skip this contact',
							style: 'destructive',
							onPress: () => this.handleSkip(reminder.id),
						},
					]
				);
				return;
			}

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
					text: 'Contact Now',
					onPress: async () => {
						try {
							const contact = await getContactById(reminder.contactId || reminder.contact_id);
							if (contact) {
								// Direct navigation instead of using callHandler
								navigate('ContactDetails', {
									contact: contact,
									initialAction: 'call',
								});
							}
						} catch (error) {
							console.error('Error initiating call:', error);
							Alert.alert('Error', 'Could not initiate contact');
						}
					},
				},
				{
					text: 'Skip',
					style: 'destructive',
					onPress: () => this.handleSkip(reminder.id),
				},
				{
					text: 'Cancel',
					style: 'cancel',
				},
			]);
		}
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

			const contact = await getContactById(reminder.contactId || reminder.contact_id);
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
			console.log('📅 Scheduling reminder for:', date.toISOString());

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
					type: REMINDER_TYPES.SCHEDULED,
				},
				sound: true,
			};

			const localNotificationId = await notificationCoordinator.scheduleNotification(
				notificationContent,
				date
			);

			console.log('📎 Scheduled notification:', {
				id: localNotificationId,
				scheduledFor: date.toISOString(),
			});

			notificationCoordinator.notificationMap.set(firestoreId, {
				localId: localNotificationId,
				scheduledTime: date,
			});
			await notificationCoordinator.saveNotificationMap();
			await notificationCoordinator.incrementBadge();

			return { firestoreId, localNotificationId };
		} catch (error) {
			console.error('Error scheduling contact reminder:', error);
			throw error;
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
