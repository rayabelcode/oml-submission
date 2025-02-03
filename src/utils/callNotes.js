import * as Notifications from 'expo-notifications';
import { addReminder, updateReminder, completeFollowUp, getReminder, getContactById } from './firestore';
import { auth } from '../config/firebase';
import { navigate } from '../navigation/RootNavigation';
import { notificationCoordinator } from './notificationCoordinator';
import { REMINDER_STATUS, REMINDER_TYPES, IOS_CONFIGS } from '../../constants/notificationConstants';

class CallNotesService {
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
			console.error('Failed to initialize call notes service:', error);
			return false;
		}
	}

	handleNotificationResponse = async (response) => {
		try {
			const data = response.notification.request.content.data;
			if (data.type === REMINDER_TYPES.FOLLOW_UP && data.firestoreId) {
				if (response.actionIdentifier === 'add_notes') {
					const notes = response.userText?.trim();
					if (notes) {
						await this.handleFollowUpComplete(data.firestoreId, notes);
					}
				} else if (response.actionIdentifier === 'dismiss') {
					await this.handleFollowUpComplete(data.firestoreId);
				} else {
					// Default behavior - navigate to contact details
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: data.firestoreId,
						});
					}
				}
			}
		} catch (error) {
			console.error('[CallNotesService] Error handling notification response:', error);
		}
	};


	async scheduleFollowUp(contact, notificationTime = new Date()) {
		try {
			const reminderData = {
				contactId: contact.id,
				scheduledTime: notificationTime,
				type: REMINDER_TYPES.FOLLOW_UP,
				status: REMINDER_STATUS.PENDING,
				contactName: `${contact.first_name} ${contact.last_name}`,
				call_data: contact.callData,
				needs_attention: true,
			};
	
			const firestoreId = `FOLLOW_UP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
	
			// Build local notification content and include the scheduledTime as an ISO string.
			const content = {
				title: `Add Notes for Call with ${contact.first_name}`,
				body: 'Tap to add notes about your recent call',
				data: {
					type: REMINDER_TYPES.FOLLOW_UP,
					contactId: contact.id,
					firestoreId: firestoreId,
					callData: contact.callData,
					scheduledTime: notificationTime.toISOString(), // pass the time here
				},
				sound: true,
			};
	
			// Schedule the local notification using your notificationCoordinator.
			const localNotificationId = await notificationCoordinator.scheduleNotification(
				content,
				notificationTime,
				{ type: REMINDER_TYPES.FOLLOW_UP }
			);
	
			// Save the mapping locally so you can manage this reminder later.
			notificationCoordinator.notificationMap.set(firestoreId, {
				localId: localNotificationId,
				scheduledTime: notificationTime, // store the original Date
			});
			await notificationCoordinator.saveNotificationMap();
	
			return firestoreId;
		} catch (error) {
			console.error('[CallNotesService] Error scheduling follow-up:', error);
			throw error;
		}
	}

	async handleFollowUpComplete(reminderId, notes = '') {
		try {
		// For local follow-ups - do not call Firestore completeFollowUp
		// Cancel the local notification if we have a stored mapping
		const mapping = notificationCoordinator.notificationMap.get(reminderId);
		if (mapping) {
		await notificationCoordinator.cancelNotification(mapping.localId);
		}
		// Remove the mapping and decrement the badge.
		notificationCoordinator.notificationMap.delete(reminderId);
		await notificationCoordinator.saveNotificationMap();
		await notificationCoordinator.decrementBadge();
		} catch (error) {
			console.error('Error completing follow-up:', error);
			throw error;
		}
	}

	async rescheduleFollowUp(reminderId, newTime) {
		try {
			const reminder = await getReminder(reminderId);
			if (!reminder) throw new Error('Reminder not found');

			await updateReminder(reminderId, {
				scheduledTime: newTime,
				date: newTime,
				status: 'pending',
			});

			const existingMapping = notificationCoordinator.notificationMap.get(reminderId);
			if (existingMapping) {
				await notificationCoordinator.cancelNotification(existingMapping.localId);
			}

			const content = {
				title: `Add Notes for Call with ${reminder.contactName}`,
				body: 'Tap to add notes about your recent call',
				data: {
					type: REMINDER_TYPES.FOLLOW_UP,
					contactId: reminder.contact_id,
					firestoreId: reminderId,
					callData: reminder.call_data,
				},
				sound: true,
			};

			const localNotificationId = await notificationCoordinator.scheduleNotification(
				content,
				newTime, // Pass Date object directly
				{
					type: REMINDER_TYPES.FOLLOW_UP,
				}
			);

			notificationCoordinator.notificationMap.set(reminderId, {
				localId: localNotificationId,
				scheduledTime: newTime,
			});
			await notificationCoordinator.saveNotificationMap();

			return true;
		} catch (error) {
			console.error('Error rescheduling follow-up:', error);
			throw error;
		}
	}
}

export const callNotesService = new CallNotesService();
