import * as Notifications from 'expo-notifications';
import { addReminder, updateReminder, completeFollowUp, getReminder, getContactById } from './firestore';
import { auth } from '../config/firebase';
import { navigate } from '../navigation/RootNavigation';
import { notificationCoordinator } from './notificationCoordinator';
import { REMINDER_STATUS, REMINDER_TYPES, IOS_CONFIGS } from '../../constants/notificationConstants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
			// Create a unique id for this follow-up reminder
			const followUpId = `FOLLOW_UP_${contact.id}_${Date.now()}`;
			const callTime = new Date();

			// Build the notification content
			const content = {
				title: `Add Notes for Call with ${contact.first_name}`,
				body: 'Tap to add notes about your recent call',
				data: {
					type: REMINDER_TYPES.FOLLOW_UP,
					contactId: contact.id,
					followUpId: followUpId,
					callData: {
						...contact.callData,
						callTime: callTime.toISOString(),
					},
					contactName: `${contact.first_name} ${contact.last_name}`,
					scheduledTime: notificationTime.toISOString(),
				},
				sound: true,
			};

			// Schedule the local notification
			const localNotificationId = await notificationCoordinator.scheduleNotification(
				content,
				notificationTime,
				{ type: REMINDER_TYPES.FOLLOW_UP }
			);

			// Store in notification coordinator
			notificationCoordinator.notificationMap.set(followUpId, {
				localId: localNotificationId,
				scheduledTime: notificationTime,
				callTime: callTime.toISOString(),
				contactName: `${contact.first_name} ${contact.last_name}`,
			});
			await notificationCoordinator.saveNotificationMap();

			// Persist this follow-up reminder in AsyncStorage
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			let notificationsList = stored ? JSON.parse(stored) : [];
			notificationsList.push({
				id: followUpId,
				localNotificationId,
				scheduledTime: notificationTime.toISOString(),
				contactName: `${contact.first_name} ${contact.last_name}`,
				data: content.data,
			});
			await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));

			// Update badge count
			await notificationCoordinator.incrementBadge();

			return followUpId;
		} catch (error) {
			console.error('[CallNotesService] Error scheduling follow-up:', error);
			throw error;
		}
	}

	async handleFollowUpComplete(followUpId, notes = '') {
		try {
			// Cancel local notification
			const mapping = notificationCoordinator.notificationMap.get(followUpId);
			if (mapping) {
				await notificationCoordinator.cancelNotification(mapping.localId);
				notificationCoordinator.notificationMap.delete(followUpId);
				await notificationCoordinator.saveNotificationMap();
			}

			// Remove from AsyncStorage
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			if (stored) {
				let notificationsList = JSON.parse(stored);
				notificationsList = notificationsList.filter((item) => item.id !== followUpId);
				await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));
			}

			// Update badge count
			await notificationCoordinator.decrementBadge();

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
