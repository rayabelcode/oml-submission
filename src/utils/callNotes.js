import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationCoordinator } from './notificationCoordinator';
import { REMINDER_TYPES } from '../../constants/notificationConstants';
import { navigate } from '../navigation/RootNavigation';
import { getContactById } from './firestore';

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
			if (data.type === REMINDER_TYPES.FOLLOW_UP) {
				if (response.actionIdentifier === 'add_notes') {
					const notes = response.userText?.trim();
					if (notes) {
						await this.handleFollowUpComplete(data.followUpId, notes);
					}
				} else if (response.actionIdentifier === 'dismiss') {
					await this.handleFollowUpComplete(data.followUpId);
				} else {
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: data.followUpId,
						});
					}
				}
			}
		} catch (error) {
			console.error('[CallNotesService] Error handling notification response:', error);
		}
	};

	async scheduleCallFollowUp(contact, time) {
		try {
			const followUpId = `FOLLOW_UP_${contact.id}_${Date.now()}`;
			const notificationContent = {
				title: 'Call Follow Up',
				body: `How did your call with ${contact.first_name} go?`,
				data: {
					type: REMINDER_TYPES.FOLLOW_UP,
					contactId: contact.id,
					contactName: `${contact.first_name} ${contact.last_name}`,
					followUpId: followUpId,
					callData: contact.callData,
					startTime: contact.callData.startTime,
				},
				categoryIdentifier: 'FOLLOW_UP',
			};

			// Store in AsyncStorage first
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			let notificationsList = stored ? JSON.parse(stored) : [];

			let localNotificationId;
			if (time <= new Date()) {
				localNotificationId = await Notifications.presentNotificationAsync(notificationContent);
			} else {
				localNotificationId = await Notifications.scheduleNotificationAsync({
					content: notificationContent,
					trigger: {
						type: 'date',
						timestamp: time.getTime(),
					},
				});
			}

			// Add to AsyncStorage
			notificationsList.push({
				id: followUpId,
				localNotificationId,
				scheduledTime: time.toISOString(),
				contactName: `${contact.first_name} ${contact.last_name}`,
				data: notificationContent.data,
			});
			await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));

			return localNotificationId;
		} catch (error) {
			console.error('Error scheduling call follow-up:', error);
			throw error;
		}
	}

	async handleFollowUpComplete(followUpId, notes = '') {
		try {
			// Cancel local notification if it exists
			const mapping = notificationCoordinator.notificationMap.get(followUpId);
			if (mapping) {
				try {
					await notificationCoordinator.cancelNotification(mapping.localId);
				} catch (error) {
					console.log('No scheduled notification found for:', followUpId);
				}
			}

			// Remove from notification map
			notificationCoordinator.notificationMap.delete(followUpId);
			await notificationCoordinator.saveNotificationMap();

			// Remove from AsyncStorage
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			if (stored) {
				let notificationsList = JSON.parse(stored);
				notificationsList = notificationsList.filter((item) => item.id !== followUpId);
				await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));
			}

			// Try to dismiss any presented notifications
			try {
				const presentedNotifications = await Notifications.getPresentedNotificationsAsync();
				const matchingNotification = presentedNotifications.find(
					(n) => n.request.identifier === followUpId || n.request.content.data?.followUpId === followUpId
				);
				if (matchingNotification) {
					await Notifications.dismissNotificationAsync(matchingNotification.request.identifier);
				}
			} catch (error) {
				console.log('Error dismissing presented notification:', error);
			}

			// Update badge count
			await notificationCoordinator.decrementBadge();

			return true;
		} catch (error) {
			console.error('Error completing follow-up:', error);
			throw error;
		}
	}

	async rescheduleFollowUp(followUpId, newTime) {
		try {
			// Get existing follow-up from AsyncStorage
			let stored = await AsyncStorage.getItem('follow_up_notifications');
			let notificationsList = stored ? JSON.parse(stored) : [];
			const existingFollowUp = notificationsList.find((item) => item.id === followUpId);

			if (!existingFollowUp) {
				throw new Error('Follow-up not found');
			}

			// Cancel existing notification
			const mapping = notificationCoordinator.notificationMap.get(followUpId);
			if (mapping) {
				await notificationCoordinator.cancelNotification(mapping.localId);
			}

			// Schedule new notification
			const content = {
				title: `Call Follow Up`,
				body: `How did your call with ${existingFollowUp.data.contactName} go?`,
				data: existingFollowUp.data,
			};

			const localNotificationId = await notificationCoordinator.scheduleNotification(content, newTime, {
				type: REMINDER_TYPES.FOLLOW_UP,
			});

			// Update AsyncStorage
			notificationsList = notificationsList.map((item) => {
				if (item.id === followUpId) {
					return {
						...item,
						localNotificationId,
						scheduledTime: newTime.toISOString(),
					};
				}
				return item;
			});
			await AsyncStorage.setItem('follow_up_notifications', JSON.stringify(notificationsList));

			// Update notification map
			notificationCoordinator.notificationMap.set(followUpId, {
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
