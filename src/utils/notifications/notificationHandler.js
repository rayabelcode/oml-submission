import { Notifications } from 'expo-notifications';
import { snoozeHandler } from '../snoozeHandler';
import { callNotesService } from '../callNotes';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';

export const handleNotificationResponse = async (response) => {
	const data = response.notification.request.content.data;
	if (!data.type) return;

	switch (data.type) {
		case REMINDER_TYPES.SCHEDULED:
			if (response.actionIdentifier === 'snooze') {
				await snoozeHandler.handleSnooze(data.contactId, 'later_today');
			}
			break;

		case REMINDER_TYPES.FOLLOW_UP:
			if (response.actionIdentifier === 'add_notes') {
				const notes = response.userText?.trim();
				if (notes && data.firestoreId) {
					await callNotesService.handleFollowUpComplete(data.firestoreId, notes);
				}
			} else if (response.actionIdentifier === 'dismiss') {
				if (data.firestoreId) {
					await callNotesService.handleFollowUpComplete(data.firestoreId);
				}
			}
			break;
	}
};

export const setupNotificationHandlers = () => {
	return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};
