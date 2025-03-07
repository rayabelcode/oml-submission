import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { snoozeHandler, initializeSnoozeHandler } from '../scheduler/snoozeHandler';
import { callNotesService } from '../callNotes';
import { scheduledCallService } from '../scheduledCalls';
import { REMINDER_TYPES, OPTION_TYPES } from '../../../constants/notificationConstants';
import { navigate } from '../../navigation/RootNavigation';
import { getContactById } from '../firestore';
import { callHandler } from '../callHandler';
import { auth } from '../../config/firebase';

export const handleNotificationResponse = async (response) => {
	const data = response.notification.request.content.data || {};
	const reminderId = data.reminderId || data.id || data.firestoreId;

	switch (data.type) {
		case REMINDER_TYPES.SCHEDULED:
		case REMINDER_TYPES.CUSTOM_DATE:
			if (response.actionIdentifier === 'call_now') {
				try {
					const contact = await getContactById(data.contactId);
					if (contact) {
						Alert.alert('Contact Options', `How would you like to contact ${contact.first_name}?`, [
							{
								text: 'Phone',
								onPress: () => callHandler.initiateCall(contact, 'phone'),
							},
							{
								text: 'FaceTime',
								onPress: () => callHandler.initiateCall(contact, 'facetime-video'),
							},
							{
								text: 'Text',
								onPress: () => callHandler.initiateCall(contact, 'sms'),
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
			} else if (
				response.actionIdentifier === 'snooze' ||
				response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
			) {
				try {
					// Use scheduledCallService to show snooze options
					const reminder = {
						id: reminderId,
						contactId: data.contactId,
						type: data.type,
						scheduledTime: new Date(),
					};
					await scheduledCallService.showSnoozeOptions(reminder);
				} catch (error) {
					console.error('Error showing snooze options:', error);
					Alert.alert('Error', 'Could not load snooze options. Please try again from the app.');
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
	return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};

setupNotificationHandlers();
