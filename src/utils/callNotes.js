import * as Notifications from 'expo-notifications';
import { notificationService } from './notifications';
import { addReminder, updateReminder, completeFollowUp, getReminder } from './firestore';
import { auth } from '../config/firebase';
import { navigate } from '../navigation/RootNavigation';
import { getContactById } from './firestore';

class CallNotesService {
	constructor() {
		this.initialized = false;
		// Notification tap listener
		this.subscription = null;
	}

	async initialize() {
		if (this.initialized) return;

		try {
			// Notification tap listener for follow-ups
			this.subscription = Notifications.addNotificationResponseReceivedListener(
				this.handleNotificationResponse
			);

			this.initialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize call notes service:', error);
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
			console.error('[CallNotesService] Error handling notification response:', error);
		}
	};

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

			// Schedule local notification using the core service
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

			const trigger = notificationTime instanceof Date ? { date: notificationTime } : null;
			const localNotificationId = await notificationService.scheduleNotification(content, trigger);

			// Store mapping in core service
			await notificationService.notificationMap.set(firestoreId, {
				localId: localNotificationId,
				scheduledTime: notificationTime,
			});
			await notificationService.saveNotificationMap();

			return firestoreId;
		} catch (error) {
			console.error('[CallNotesService] Error scheduling call follow-up:', error);
			throw error;
		}
	}

	async handleFollowUpComplete(reminderId, notes = '') {
		try {
			if (!auth.currentUser) {
				throw new Error('No authenticated user');
			}

			const mapping = notificationService.notificationMap.get(reminderId);
			if (mapping) {
				await notificationService.cancelNotification(mapping.localId);
			}

			await completeFollowUp(reminderId, notes);

			notificationService.notificationMap.delete(reminderId);
			await notificationService.saveNotificationMap();
			await notificationService.decrementBadge();

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

			// Update the existing reminder
			await updateReminder(reminderId, {
				scheduledTime: newTime,
				date: newTime,
				status: 'pending',
			});

			// Cancel existing notification if it exists
			const existingMapping = notificationService.notificationMap.get(reminderId);
			if (existingMapping) {
				await notificationService.cancelNotification(existingMapping.localId);
			}

			// Schedule new notification
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

			const localNotificationId = await notificationService.scheduleNotification(content, { date: newTime });

			// Update mapping
			notificationService.notificationMap.set(reminderId, {
				localId: localNotificationId,
				scheduledTime: newTime,
			});
			await notificationService.saveNotificationMap();

			return true;
		} catch (error) {
			console.error('Error rescheduling follow-up:', error);
			throw error;
		}
	}
}

export const callNotesService = new CallNotesService();
