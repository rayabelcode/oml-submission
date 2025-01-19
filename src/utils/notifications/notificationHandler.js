import { Notifications } from 'expo-notifications';
import { snoozeHandler } from '../snoozeHandler';
import { auth } from '../../config/firebase';

export const handleNotificationResponse = async (response) => {
	const data = response.notification.request.content.data;

	if (!data.type) return;

	switch (data.type) {
		case 'scheduled':
			if (response.actionIdentifier === 'snooze') {
				await snoozeHandler.handleSnooze(data.contactId, 'later_today');
			}
			break;
		case 'follow_up':
			// Follow-up notifications handled by existing code
			break;
	}
};

export const setupNotificationHandlers = () => {
	return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};
