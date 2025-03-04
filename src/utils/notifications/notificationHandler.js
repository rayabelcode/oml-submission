import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { snoozeHandler, initializeSnoozeHandler } from '../scheduler/snoozeHandler';
import { callNotesService } from '../callNotes';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';
import { navigate } from '../../navigation/RootNavigation';
import { getContactById, getReminder } from '../firestore';
import { callHandler } from '../callHandler';
import { auth } from '../../config/firebase';
import { DateTime } from 'luxon';

export const handleNotificationResponse = async (response) => {
	console.log('Notification response received:', {
		actionId: response.actionIdentifier,
		category: response.notification.request.content.categoryIdentifier,
		data: response.notification.request.content.data,
	});

	const data = response.notification.request.content.data || {};

	switch (data.type) {
		case REMINDER_TYPES.SCHEDULED:
		case REMINDER_TYPES.CUSTOM_DATE:
			if (response.actionIdentifier === 'call_now') {
				console.log(`Initiating call to contact: ${data.contactId}`);
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						// Show contact options dialog - exactly like dashboard
						Alert.alert('Contact Options', `How would you like to contact ${contact.first_name}?`, [
							{
								text: 'Phone',
								onPress: () => callHandler.initiateCall(contact, 'phone'),
							},
							{
								text: 'FaceTime',
								onPress: () => callHandler.initiateCall(contact, 'facetime'),
							},
							{
								text: 'Text',
								onPress: () => callHandler.initiateCall(contact, 'text'),
							},
							{
								text: 'Cancel',
								style: 'cancel',
							},
						]);
					}
				} catch (error) {
					console.error('Error initiating call:', error);
				}
			} else if (response.actionIdentifier === 'snooze') {
				// Handle snooze using the exact same process as DashboardScreen's handleSnooze
				console.log(`Processing snooze for reminder: ${data.reminderId}`);
				try {
					// Get the current user ID
					const userId = auth.currentUser?.uid;

					if (!userId) {
						console.error('No user ID available for snooze handling');
						Alert.alert('Error', 'Please make sure you are logged in to snooze reminders.');
						return;
					}

					// Initialize the snooze handler
					await initializeSnoozeHandler(userId);

					// Get all available snooze options for this reminder - using the existing function
					const options = await snoozeHandler.getAvailableSnoozeOptions(data.reminderId);
					if (!options || options.length === 0) {
						Alert.alert('Error', 'No available snooze options');
						return;
					}

					// Create option handlers - like in DashboardScreen
					const optionsWithHandlers = options.map((option) => ({
						...option,
						onPress: async () => {
							try {
								console.log(`Selected snooze option: ${option.id}`);
								await snoozeHandler.handleSnooze(
									data.contactId,
									option.id,
									DateTime.now(),
									data.type || 'SCHEDULED',
									data.reminderId
								);
							} catch (error) {
								console.error('Error in snooze process:', error);
								Alert.alert('Error', 'Unable to snooze reminder. Please try again.');
							}
						},
					}));

					// Create buttons for Alert dialog
					const buttons = optionsWithHandlers.map((option) => ({
						text: option.text,
						style: option.id === 'skip' ? 'destructive' : 'default',
						onPress: option.onPress,
					}));

					buttons.push({
						text: 'Cancel',
						style: 'cancel',
					});

					Alert.alert('Snooze Options', 'When would you like to be reminded?', buttons);
				} catch (error) {
					console.error('Error handling snooze options:', error);
					Alert.alert('Error', 'Could not process snooze request. Please try again later.');
				}
			} else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
				// If the notification is tapped (default action), navigate to the contact's Notes tab
				console.log(`Opening ContactDetails for contact: ${data.contactId}`);
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: data.reminderId,
						});
					}
				} catch (error) {
					console.error('Error navigating to contact:', error);
				}
			}
			break;

		case REMINDER_TYPES.FOLLOW_UP:
			if (response.actionIdentifier === 'add_notes') {
				const notes = response.userText?.trim();
				const followUpId = data.followUpId || data.firestoreId;
				if (notes && followUpId) {
					await callNotesService.handleFollowUpComplete(followUpId, notes);
				}
			} else if (response.actionIdentifier === 'dismiss') {
				const followUpId = data.followUpId || data.firestoreId;
				if (followUpId) {
					await callNotesService.handleFollowUpComplete(followUpId);
				}
			} else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
				// If FOLLOW_UP notification is tapped, navigate to contact's Notes tab
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						navigate('ContactDetails', {
							contact: contact,
							initialTab: 'Notes',
							reminderId: data.followUpId || data.firestoreId,
						});
					}
				} catch (error) {
					console.error('Error navigating to contact:', error);
				}
			}
			break;
	}
};

export const setupNotificationHandlers = () => {
	console.log('Setting up global notification response handler');
	return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};

// Auto-initialize the handler
setupNotificationHandlers();
