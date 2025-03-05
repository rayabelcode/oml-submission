jest.mock('firebase/firestore', () => ({
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

jest.mock('luxon', () => ({
	DateTime: {
		now: jest.fn(() => ({ toISO: () => '2023-01-01T12:00:00.000Z' })),
	},
}));

jest.mock('react-native', () => ({
	Alert: {
		alert: jest.fn(),
	},
}));

jest.mock('../../navigation/RootNavigation', () => ({
	navigate: jest.fn(),
}));

import {
	handleNotificationResponse,
	setupNotificationHandlers,
} from '../../utils/notifications/notificationHandler';
import { Alert } from 'react-native';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';

jest.mock('../../utils/scheduler/snoozeHandler', () => ({
	snoozeHandler: {
		handleSnooze: jest.fn().mockResolvedValue(true),
		getAvailableSnoozeOptions: jest.fn().mockResolvedValue([
			{
				id: 'later_today',
				text: 'Later Today',
			},
			{
				id: 'tomorrow',
				text: 'Tomorrow',
			},
		]),
	},
	initializeSnoozeHandler: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/callNotes', () => ({
	callNotesService: {
		handleFollowUpComplete: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock('../../utils/firestore', () => ({
	getContactById: jest.fn().mockResolvedValue({
		id: 'test-contact',
		first_name: 'John',
		last_name: 'Doe',
	}),
}));

jest.mock('../../utils/callHandler', () => ({
	callHandler: {
		initiateCall: jest.fn(),
	},
}));

jest.mock('expo-notifications', () => ({
	DEFAULT_ACTION_IDENTIFIER: 'default',
	addNotificationResponseReceivedListener: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { snoozeHandler, initializeSnoozeHandler } from '../../utils/scheduler/snoozeHandler';
import { callNotesService } from '../../utils/callNotes';
import { getContactById } from '../../utils/firestore';
import { callHandler } from '../../utils/callHandler';
import { navigate } from '../../navigation/RootNavigation';

describe('Notification Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('handleNotificationResponse', () => {
		// SCHEDULED notification tests
		it('should handle snooze for scheduled reminders', async () => {
			Alert.alert = jest.fn((title, message, buttons) => {
				const laterTodayBtn = buttons.find((btn) => btn.text.includes('Later Today'));
				if (laterTodayBtn) laterTodayBtn.onPress();
			});

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(initializeSnoozeHandler).toHaveBeenCalledWith('test-user');
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');
			expect(Alert.alert).toHaveBeenCalledWith(
				'Snooze Options',
				'When would you like to be reminded?',
				expect.any(Array)
			);
		});

		// CUSTOM_DATE notification tests
		it('should handle snooze for custom date reminders', async () => {
			Alert.alert = jest.fn((title, message, buttons) => {
				const laterTodayBtn = buttons.find((btn) => btn.text.includes('Later Today'));
				if (laterTodayBtn) laterTodayBtn.onPress();
			});

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.CUSTOM_DATE,
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(initializeSnoozeHandler).toHaveBeenCalledWith('test-user');
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');
			expect(Alert.alert).toHaveBeenCalled();
		});

		// Call Now action tests
		it('should handle call_now action', async () => {
			const response = {
				actionIdentifier: 'call_now',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(getContactById).toHaveBeenCalledWith('test-contact');
			expect(Alert.alert).toHaveBeenCalledWith(
				'Contact Options',
				'How would you like to contact John?',
				expect.any(Array)
			);
		});

		// Default action (tapping) tests
		it('should navigate to contact on tap for scheduled reminders', async () => {
			const response = {
				actionIdentifier: 'default',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(getContactById).toHaveBeenCalledWith('test-contact');
			expect(navigate).toHaveBeenCalledWith('ContactDetails', {
				contact: expect.objectContaining({ id: 'test-contact' }),
				initialTab: 'Notes',
				reminderId: 'test-reminder-id',
			});
		});

		it('should navigate to contact on tap for custom date reminders', async () => {
			const response = {
				actionIdentifier: 'default',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.CUSTOM_DATE,
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(getContactById).toHaveBeenCalledWith('test-contact');
			expect(navigate).toHaveBeenCalledWith('ContactDetails', {
				contact: expect.objectContaining({ id: 'test-contact' }),
				initialTab: 'Notes',
				reminderId: 'test-reminder-id',
			});
		});

		// FOLLOW_UP notification tests
		it('should handle add_notes for follow-ups', async () => {
			const response = {
				actionIdentifier: 'add_notes',
				userText: 'Test notes',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.FOLLOW_UP,
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(callNotesService.handleFollowUpComplete).toHaveBeenCalledWith('test-followup-id', 'Test notes');
		});

		it('should handle follow-up with empty notes', async () => {
			const response = {
				actionIdentifier: 'add_notes',
				userText: '',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.FOLLOW_UP,
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(callNotesService.handleFollowUpComplete).not.toHaveBeenCalled();
		});

		it('should handle dismiss for follow-ups', async () => {
			const response = {
				actionIdentifier: 'dismiss',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.FOLLOW_UP,
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(callNotesService.handleFollowUpComplete).toHaveBeenCalledWith('test-followup-id');
		});

		it('should handle tapping a follow-up notification', async () => {
			const response = {
				actionIdentifier: 'default',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.FOLLOW_UP,
								contactId: 'test-contact',
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(getContactById).toHaveBeenCalledWith('test-contact');
			expect(navigate).toHaveBeenCalledWith('ContactDetails', {
				contact: expect.objectContaining({ id: 'test-contact' }),
				initialTab: 'Notes',
				reminderId: 'test-followup-id',
			});
		});

		// Edge cases and error handling tests
		it('should handle missing user ID when trying to snooze', async () => {
			// Temporarily remove the user
			const originalAuth = require('../../config/firebase').auth;
			require('../../config/firebase').auth = { currentUser: null };

			Alert.alert = jest.fn();

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(Alert.alert).toHaveBeenCalledWith(
				'Error',
				'Please make sure you are logged in to snooze reminders.'
			);

			// Restore the user
			require('../../config/firebase').auth = originalAuth;
		});

		it('should handle missing reminder ID', async () => {
			Alert.alert = jest.fn();

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
								// No reminderId
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Should still initialize and show options
			expect(initializeSnoozeHandler).toHaveBeenCalled();
			expect(Alert.alert).toHaveBeenCalled();
		});

		it('should handle failed getAvailableSnoozeOptions', async () => {
			// Mock getAvailableSnoozeOptions to throw
			snoozeHandler.getAvailableSnoozeOptions.mockRejectedValueOnce(new Error('Test error'));

			Alert.alert = jest.fn();

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Should fall back to default options
			expect(Alert.alert).toHaveBeenCalled();
		});

		it('should handle getContactById failure', async () => {
			// Mock getContactById to throw
			getContactById.mockRejectedValueOnce(new Error('Contact not found'));

			const response = {
				actionIdentifier: 'default',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			// Should not throw
			await expect(handleNotificationResponse(response)).resolves.not.toThrow();

			// Navigate should not be called
			expect(navigate).not.toHaveBeenCalled();
		});

		it('should handle empty notification data', async () => {
			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {}, // Empty data
						},
					},
				},
			};

			await expect(handleNotificationResponse(response)).resolves.not.toThrow();
			expect(snoozeHandler.handleSnooze).not.toHaveBeenCalled();
			expect(getContactById).not.toHaveBeenCalled();
			expect(callNotesService.handleFollowUpComplete).not.toHaveBeenCalled();
		});

		it('should handle unknown notification type', async () => {
			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: 'UNKNOWN_TYPE',
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			await expect(handleNotificationResponse(response)).resolves.not.toThrow();
			expect(snoozeHandler.handleSnooze).not.toHaveBeenCalled();
		});

		it('should handle unknown action identifier', async () => {
			const response = {
				actionIdentifier: 'unknown_action',
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			await expect(handleNotificationResponse(response)).resolves.not.toThrow();
			expect(snoozeHandler.handleSnooze).not.toHaveBeenCalled();
			expect(getContactById).not.toHaveBeenCalled();
		});
	});

	describe('setupNotificationHandlers', () => {
		it('should register notification listener', () => {
			setupNotificationHandlers();
			expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(
				handleNotificationResponse
			);
		});
	});
});
