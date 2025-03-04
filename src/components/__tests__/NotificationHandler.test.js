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

// Mock DateTime from luxon
jest.mock('luxon', () => ({
	DateTime: {
		now: jest.fn(() => ({ toISO: () => '2023-01-01T12:00:00.000Z' })),
	},
}));

// Mock Alert
jest.mock('react-native', () => ({
	Alert: {
		alert: jest.fn(),
	},
}));

// Mock navigate
jest.mock('../../navigation/RootNavigation', () => ({
	navigate: jest.fn(),
}));

import {
	handleNotificationResponse,
	setupNotificationHandlers,
} from '../../utils/notifications/notificationHandler';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

jest.mock('../../utils/scheduler/snoozeHandler', () => ({
	snoozeHandler: {
		handleSnooze: jest.fn().mockResolvedValue(true),
		getAvailableSnoozeOptions: jest.fn().mockResolvedValue([
			{
				id: 'later_today',
				text: 'Later Today (+3 hours)',
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
		it('should handle snooze action for scheduled notifications', async () => {
			// Mock Alert.alert to simulate a button press
			Alert.alert = jest.fn((title, message, buttons) => {
				// Find and press the "Later Today" button
				const laterTodayButton = buttons.find((btn) => btn.text.includes('Later Today'));
				if (laterTodayButton && laterTodayButton.onPress) {
					laterTodayButton.onPress();
				}
			});

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: 'SCHEDULED',
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify initializeSnoozeHandler was called
			expect(initializeSnoozeHandler).toHaveBeenCalledWith('test-user');

			// Verify getAvailableSnoozeOptions was called
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');

			// Verify Alert.alert was called with the right arguments
			expect(Alert.alert).toHaveBeenCalledWith(
				'Snooze Options',
				'When would you like to be reminded?',
				expect.any(Array)
			);

			// Verify handleSnooze was called with the right arguments
			expect(snoozeHandler.handleSnooze).toHaveBeenCalledWith(
				'test-contact', // contactId
				'later_today', // option
				expect.anything(), // DateTime.now()
				'SCHEDULED', // type
				'test-reminder-id' // reminderId
			);
		});

		it('should handle snooze action for custom date notifications', async () => {
			// Mock Alert.alert to simulate a button press
			Alert.alert = jest.fn((title, message, buttons) => {
				// Find and press the "Later Today" button
				const laterTodayButton = buttons.find(btn => btn.text.includes('Later Today'));
				if (laterTodayButton && laterTodayButton.onPress) {
					laterTodayButton.onPress();
				}
			});

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: 'CUSTOM_DATE',
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify initializeSnoozeHandler was called
			expect(initializeSnoozeHandler).toHaveBeenCalledWith('test-user');
			
			// Verify getAvailableSnoozeOptions was called
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');
			
			// Verify Alert.alert was called with the right arguments
			expect(Alert.alert).toHaveBeenCalledWith(
				'Snooze Options',
				'When would you like to be reminded?',
				expect.any(Array)
			);

			// Verify handleSnooze was called with the right arguments
			expect(snoozeHandler.handleSnooze).toHaveBeenCalledWith(
				'test-contact', // contactId
				'later_today', // option
				expect.anything(), // DateTime.now()
				'CUSTOM_DATE', // type
				'test-reminder-id' // reminderId
			);
		});
		
		it('should handle call_now action for scheduled and custom notifications', async () => {
			const response = {
				actionIdentifier: 'call_now',
				notification: {
					request: {
						content: {
							data: {
								type: 'SCHEDULED',
								contactId: 'test-contact',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify getContactById was called
			expect(getContactById).toHaveBeenCalledWith('test-contact');
			
			// Verify Alert.alert was called with contact options
			expect(Alert.alert).toHaveBeenCalledWith(
				'Contact Options',
				'How would you like to contact John?',
				expect.any(Array)
			);
		});

		it('should handle default action for scheduled and custom notifications', async () => {
			const response = {
				actionIdentifier: 'default',
				notification: {
					request: {
						content: {
							data: {
								type: 'SCHEDULED',
								contactId: 'test-contact',
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify getContactById was called
			expect(getContactById).toHaveBeenCalledWith('test-contact');
			
			// Verify navigation
			expect(navigate).toHaveBeenCalledWith('ContactDetails', {
				contact: expect.objectContaining({ 
					id: 'test-contact', 
					first_name: 'John' 
				}),
				initialTab: 'Notes',
				reminderId: 'test-reminder-id',
			});
		});

		it('should handle add_notes action for follow-up notifications', async () => {
			const response = {
				actionIdentifier: 'add_notes',
				userText: 'Test notes',
				notification: {
					request: {
						content: {
							data: {
								type: 'FOLLOW_UP',
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify callNotesService.handleFollowUpComplete was called
			expect(callNotesService.handleFollowUpComplete).toHaveBeenCalledWith(
				'test-followup-id',
				'Test notes'
			);
		});

		it('should handle dismiss action for follow-up notifications', async () => {
			const response = {
				actionIdentifier: 'dismiss',
				notification: {
					request: {
						content: {
							data: {
								type: 'FOLLOW_UP',
								followUpId: 'test-followup-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			// Verify callNotesService.handleFollowUpComplete was called without notes
			expect(callNotesService.handleFollowUpComplete).toHaveBeenCalledWith(
				'test-followup-id'
			);
		});
	});

	describe('setupNotificationHandlers', () => {
		it('should set up notification response listener', () => {
			setupNotificationHandlers();

			expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(
				handleNotificationResponse
			);
		});
	});
});
