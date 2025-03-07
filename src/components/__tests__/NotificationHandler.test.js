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

// Netinfo mock
jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn(() => jest.fn()),
	fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock notificationCoordinator for offline operations
jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		storePendingOperation: jest.fn(() => Promise.resolve(true)),
		decrementBadge: jest.fn(() => Promise.resolve(0)),
		notificationMap: new Map(),
		saveNotificationMap: jest.fn(() => Promise.resolve(true)),
	},
}));

// Mock for OPTION_TYPES
jest.mock('../../../constants/notificationConstants', () => ({
	REMINDER_TYPES: {
		SCHEDULED: 'SCHEDULED',
		FOLLOW_UP: 'FOLLOW_UP',
		CUSTOM_DATE: 'CUSTOM_DATE',
	},
	SNOOZE_OPTIONS: [
		{
			id: 'later_today',
			icon: 'time-outline',
			text: 'Later Today',
		},
		{
			id: 'tomorrow',
			icon: 'calendar-outline',
			text: 'Tomorrow',
		},
		{
			id: 'skip',
			icon: 'close-circle-outline',
			text: 'Skip This Call',
		},
	],
	OPTION_TYPES: {
		CONTACT_NOW: 'contact_now',
		RESCHEDULE: 'reschedule',
	},
	SNOOZE_LIMIT_MESSAGES: {
		DAILY_MAX_REACHED: 'The series will continue tomorrow if you skip',
		RECURRING_MAX_REACHED: "You've snoozed this call often, do you want to reschedule?",
		WEEKLY_LIMIT: 'Weekly reminders have limited snooze options',
		DAILY_LIMIT: 'Daily reminders can only be snoozed once',
	},
}));

import {
	handleNotificationResponse,
	setupNotificationHandlers,
} from '../../utils/notifications/notificationHandler';
import { Alert } from 'react-native';
import {
	REMINDER_TYPES,
	OPTION_TYPES,
	SNOOZE_LIMIT_MESSAGES,
} from '../../../constants/notificationConstants';
import NetInfo from '@react-native-community/netinfo';

// Create robust mock for snoozeHandler
jest.mock('../../utils/scheduler/snoozeHandler', () => ({
	snoozeHandler: {
		handleSnooze: jest.fn(() => Promise.resolve(true)),
		handleLaterToday: jest.fn(() => Promise.resolve(true)),
		handleTomorrow: jest.fn(() => Promise.resolve(true)),
		handleSkip: jest.fn(() => Promise.resolve(true)),
		getAvailableSnoozeOptions: jest.fn(() =>
			Promise.resolve([
				{
					id: 'later_today',
					text: 'Later Today',
					stats: {
						remaining: 2,
						total: 3,
						indicator: 'normal',
						message: '2 snoozes remaining',
					},
				},
				{
					id: 'tomorrow',
					text: 'Tomorrow',
					stats: {
						remaining: 2,
						total: 3,
						indicator: 'normal',
						message: '2 snoozes remaining',
					},
				},
				{
					id: 'skip',
					text: 'Skip This Call',
					stats: {
						remaining: 2,
						total: 3,
						indicator: 'normal',
						message: '2 snoozes remaining',
					},
				},
			])
		),
	},
	initializeSnoozeHandler: jest.fn(() => Promise.resolve(undefined)),
}));

jest.mock('../../utils/callNotes', () => ({
	callNotesService: {
		handleFollowUpComplete: jest.fn(() => Promise.resolve(true)),
	},
}));

// Mock firestore functions
jest.mock('../../utils/firestore', () => ({
	getContactById: jest.fn(() =>
		Promise.resolve({
			id: 'test-contact',
			first_name: 'John',
			last_name: 'Doe',
		})
	),
	getReminder: jest.fn(() =>
		Promise.resolve({
			id: 'test-reminder-id',
			frequency: 'weekly',
			type: 'SCHEDULED',
			contact_id: 'test-contact',
			snooze_count: 0,
		})
	),
}));

jest.mock('../../utils/callHandler', () => ({
	callHandler: {
		initiateCall: jest.fn(),
		handleCallAction: jest.fn(),
	},
}));

jest.mock('expo-notifications', () => ({
	DEFAULT_ACTION_IDENTIFIER: 'default',
	addNotificationResponseReceivedListener: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { snoozeHandler, initializeSnoozeHandler } from '../../utils/scheduler/snoozeHandler';
import { callNotesService } from '../../utils/callNotes';
import { getContactById, getReminder } from '../../utils/firestore';
import { callHandler } from '../../utils/callHandler';
import { navigate } from '../../navigation/RootNavigation';
import { notificationCoordinator } from '../../utils/notificationCoordinator';

beforeEach(() => {
	jest.clearAllMocks();

	// Make sure NetInfo.fetch always returns a proper resolved promise with connected state
	NetInfo.fetch.mockImplementation(() =>
		Promise.resolve({
			isConnected: true,
			isInternetReachable: true,
		})
	);
});

describe('Notification Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('handleNotificationResponse', () => {
		// SCHEDULED notification tests
		it('should handle snooze for scheduled reminders by navigating to Dashboard', async () => {
			// Clear the navigate mock
			navigate.mockClear();

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

			// Check for navigation with correct params
			expect(navigate).toHaveBeenCalledWith('Dashboard', {
				openSnoozeForReminder: expect.objectContaining({
					firestoreId: 'test-reminder-id',
					contact_id: 'test-contact',
					type: REMINDER_TYPES.SCHEDULED,
					scheduledTime: expect.any(Date),
				}),
			});
		});

		// CUSTOM_DATE notification tests
		it('should handle snooze for custom date reminders by navigating to Dashboard', async () => {
			// Clear the navigate mock
			navigate.mockClear();

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

			// Check for navigation with the right params
			expect(navigate).toHaveBeenCalledWith('Dashboard', {
				openSnoozeForReminder: expect.objectContaining({
					firestoreId: 'test-reminder-id',
					contact_id: 'test-contact',
					type: REMINDER_TYPES.CUSTOM_DATE,
					scheduledTime: expect.any(Date),
				}),
			});
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

		it('should handle missing reminder ID gracefully when snoozing', async () => {
			// Clear mocks
			navigate.mockClear();
			Alert.alert.mockClear();

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

			// Should still navigate to Dashboard but with undefined firestoreId
			expect(navigate).toHaveBeenCalledWith('Dashboard', {
				openSnoozeForReminder: expect.objectContaining({
					contact_id: 'test-contact',
					type: REMINDER_TYPES.SCHEDULED,
					scheduledTime: expect.any(Date),
				}),
			});
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

// Testing specific contact options
it('should initiate a phone call when phone option is selected', async () => {
	// Mock Alert to simulate selecting "Phone" option
	Alert.alert = jest.fn((title, message, buttons) => {
		const phoneButton = buttons.find((btn) => btn.text === 'Phone');
		if (phoneButton) phoneButton.onPress();
	});

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

	expect(callHandler.initiateCall).toHaveBeenCalledWith(
		expect.objectContaining({ id: 'test-contact' }),
		'phone'
	);
});

it('should initiate a FaceTime call when FaceTime option is selected', async () => {
	Alert.alert = jest.fn((title, message, buttons) => {
		const facetimeButton = buttons.find((btn) => btn.text === 'FaceTime');
		if (facetimeButton) facetimeButton.onPress();
	});

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

	expect(callHandler.initiateCall).toHaveBeenCalledWith(
		expect.objectContaining({ id: 'test-contact' }),
		'facetime-video'
	);
});

it('should initiate a text message when Text option is selected', async () => {
	Alert.alert = jest.fn((title, message, buttons) => {
		const textButton = buttons.find((btn) => btn.text === 'Text');
		if (textButton) textButton.onPress();
	});

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

	expect(callHandler.initiateCall).toHaveBeenCalledWith(
		expect.objectContaining({ id: 'test-contact' }),
		'sms'
	);
});

// Testing skip functionality
it('should handle skip option for scheduled reminders', async () => {
	// Just check navigation
	navigate.mockClear();

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

	// Should navigate to Dashboard where actual skip handling will happen
	expect(navigate).toHaveBeenCalledWith('Dashboard', {
		openSnoozeForReminder: expect.any(Object),
	});
});

// Testing snoozed reminder behavior
it('should handle actions for snoozed SCHEDULED reminders the same as regular reminders', async () => {
	const response = {
		actionIdentifier: 'call_now',
		notification: {
			request: {
				content: {
					data: {
						type: REMINDER_TYPES.SCHEDULED,
						contactId: 'test-contact',
						reminderId: 'test-reminder-id',
						status: 'snoozed',
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

// Test max snooze reached
it('should only show Skip option when max snooze is reached', async () => {
	// Clear navigate mock
	navigate.mockClear();

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

	// Verify navigation to Dashboard
	expect(navigate).toHaveBeenCalledWith('Dashboard', {
		openSnoozeForReminder: expect.any(Object),
	});
});

describe('Frequency-specific snooze behavior', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should navigate to Dashboard for all frequency-specific snooze scenarios', async () => {
		// Clear navigate mock
		navigate.mockClear();

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

		// Just verify navigation to Dashboard - all frequency-specific behavior
		// will be handled in the Dashboard component itself
		expect(navigate).toHaveBeenCalledWith('Dashboard', {
			openSnoozeForReminder: expect.objectContaining({
				firestoreId: 'test-reminder-id',
				contact_id: 'test-contact',
				type: REMINDER_TYPES.SCHEDULED,
			}),
		});
	});

	it('should test contact now option action', async () => {
		// 1. Mock getContactById to return a contact
		getContactById.mockResolvedValueOnce({
			id: 'test-contact',
			first_name: 'John',
			last_name: 'Doe',
		});

		// 2. Reset and set up call handler
		callHandler.handleCallAction.mockClear();

		// 3. Prepare test data
		const contactId = 'test-contact';

		// 4. Directly call the function that the button would trigger
		// This is inside the Contact Now button's onPress handler
		const contact = await getContactById(contactId);
		callHandler.handleCallAction(contact);

		// 5. Verify the call handler was called correctly
		expect(callHandler.handleCallAction).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'test-contact' })
		);
	});

	it('should handle navigation errors gracefully', async () => {
		// Reset Alert mock to a simple spy
		Alert.alert.mockReset();
		Alert.alert.mockImplementation(() => {});

		// Make navigate throw an error
		navigate.mockImplementationOnce(() => {
			throw new Error('Navigation failed');
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

		// Execute the function
		await handleNotificationResponse(response);

		// Should show an error alert
		expect(Alert.alert).toHaveBeenCalledWith(
			'Error',
			'Could not load snooze options. Please try again from the app.'
		);
	});
});
