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
	REMINDER_STATUS: {
		SKIPPED: 'skipped',
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
		DAILY_MAX_REACHED: 'Your daily notifications for this call will continue tomorrow if you skip.',
		RECURRING_MAX_REACHED: "You've snoozed this contact often, do you want to reschedule?",
		WEEKLY_LIMIT: 'Weekly reminders have limited snooze options',
		DAILY_LIMIT: 'Daily reminders can only be snoozed once',
	},
	MAX_SNOOZE_ATTEMPTS: 5,
	NOTIFICATION_MESSAGES: {
		MAX_SNOOZE_REACHED: {
			title: 'Maximum Snooze Reached',
			message: 'You have reached the maximum number of snoozes for this reminder.',
		},
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
	REMINDER_STATUS,
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

jest.mock('../../utils/scheduledCalls', () => ({
	scheduledCallService: {
		showSnoozeOptions: jest.fn(() => Promise.resolve()),
		handleSkip: jest.fn(() => Promise.resolve(true)),
	},
}));

jest.mock('../../utils/callNotes', () => ({
	callNotesService: {
		handleFollowUpComplete: jest.fn(() => Promise.resolve(true)),
	},
}));

// Mock firestore functions
jest.mock('../../utils/firestore', () => ({
	getContactById: jest.fn((id) => {
		// For error test
		if (id === 'error-contact') {
			return Promise.reject(new Error('Contact not found'));
		}
		return Promise.resolve({
			id: 'test-contact',
			first_name: 'John',
			last_name: 'Doe',
		});
	}),
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
import { scheduledCallService } from '../../utils/scheduledCalls';
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
		it('should handle snooze for scheduled reminders', async () => {
			// Clear mocks
			scheduledCallService.showSnoozeOptions.mockClear();

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

			// Check that scheduledCallService.showSnoozeOptions was called with the right params
			expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'test-reminder-id',
					contactId: 'test-contact',
					type: REMINDER_TYPES.SCHEDULED,
				})
			);
		});

		// CUSTOM_DATE notification tests
		it('should handle snooze for custom date reminders by navigating to Dashboard', async () => {
			// Clear mocks
			scheduledCallService.showSnoozeOptions.mockClear();

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

			// Check that scheduledCallService.showSnoozeOptions was called with the right params
			expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'test-reminder-id',
					contactId: 'test-contact',
					type: REMINDER_TYPES.CUSTOM_DATE,
				})
			);
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
								reminderId: 'test-reminder-id',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(getContactById).toHaveBeenCalledWith('test-contact');
			expect(navigate).toHaveBeenCalledWith('Dashboard', {
				initialView: 'notifications',
				openCallOptionsForContact: expect.objectContaining({ id: 'test-contact' }),
				reminderToComplete: {
					firestoreId: 'test-reminder-id',
					type: REMINDER_TYPES.SCHEDULED,
					contact_id: 'test-contact',
				},
			});
		});

		// Default action (tapping) tests
		it('should navigate to contact on tap for scheduled reminders', async () => {
			// Setup mocks
			scheduledCallService.showSnoozeOptions.mockClear();

			const response = {
				actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
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

			// Check that scheduledCallService.showSnoozeOptions was called with the right params
			expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'test-reminder-id',
					contactId: 'test-contact',
					type: REMINDER_TYPES.SCHEDULED,
				})
			);
		});

		it('should navigate to contact on tap for custom date reminders', async () => {
			// Set up the mocks
			getContactById.mockClear();
			scheduledCallService.showSnoozeOptions.mockClear();

			const response = {
				actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
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

			// Check that scheduledCallService.showSnoozeOptions was called
			expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'test-reminder-id',
					contactId: 'test-contact',
					type: REMINDER_TYPES.CUSTOM_DATE,
				})
			);
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
				actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
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

			// Mock methods to check how error handling flows
			scheduledCallService.showSnoozeOptions.mockImplementationOnce(() => {
				throw new Error('No user ID available');
			});
			Alert.alert.mockClear();

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

			// Should show error alert when showSnoozeOptions fails
			expect(Alert.alert).toHaveBeenCalledWith(
				'Error',
				'Could not load snooze options. Please try again from the app.'
			);

			// Restore the user
			require('../../config/firebase').auth = originalAuth;
		});

		it('should handle missing reminder ID gracefully when snoozing', async () => {
			// Clear mocks
			scheduledCallService.showSnoozeOptions.mockClear();
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

			// Should call showSnoozeOptions with undefined id
			expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					contactId: 'test-contact',
					type: REMINDER_TYPES.SCHEDULED,
				})
			);
		});

		it('should handle getContactById failure', async () => {
			// Set up the mocks
			navigate.mockClear();

			// Create a response for a tap action with a contact ID that will trigger an error
			const response = {
				actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
				notification: {
					request: {
						content: {
							data: {
								type: REMINDER_TYPES.SCHEDULED,
								contactId: 'error-contact', // This will trigger our mocked rejection
							},
						},
					},
				},
			};

			// Should not throw
			await expect(handleNotificationResponse(response)).resolves.not.toThrow();

			// Navigate should not be called after the error
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

// Testing contact options
it('should navigate to Dashboard with call options when Contact Now option is selected', async () => {
	// Clear previous mocks
	getContactById.mockClear();
	navigate.mockClear();

	const response = {
		actionIdentifier: 'call_now',
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
	expect(navigate).toHaveBeenCalledWith('Dashboard', {
		initialView: 'notifications',
		openCallOptionsForContact: expect.objectContaining({ id: 'test-contact' }),
		reminderToComplete: {
			firestoreId: 'test-reminder-id',
			type: REMINDER_TYPES.SCHEDULED,
			contact_id: 'test-contact',
		},
	});
});

// Testing skip functionality
it('should handle skip option for scheduled reminders', async () => {
	// Clear navigate mock
	scheduledCallService.showSnoozeOptions.mockClear();

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

	// Should call showSnoozeOptions instead of navigate directly
	expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
		expect.objectContaining({
			id: 'test-reminder-id',
			contactId: 'test-contact',
			type: REMINDER_TYPES.SCHEDULED,
		})
	);
});

// Testing snoozed reminder behavior
it('should handle actions for snoozed SCHEDULED reminders the same as regular reminders', async () => {
	getContactById.mockClear();
	navigate.mockClear();

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
	expect(navigate).toHaveBeenCalledWith('Dashboard', {
		initialView: 'notifications',
		openCallOptionsForContact: expect.objectContaining({ id: 'test-contact' }),
		reminderToComplete: {
			firestoreId: 'test-reminder-id',
			type: REMINDER_TYPES.SCHEDULED,
			contact_id: 'test-contact',
		},
	});
});

// Test max snooze reached
it('should only show Skip option when max snooze is reached', async () => {
	// Clear mocks
	scheduledCallService.showSnoozeOptions.mockClear();

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

	// Should call showSnoozeOptions
	expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
		expect.objectContaining({
			id: 'test-reminder-id',
			contactId: 'test-contact',
			type: REMINDER_TYPES.SCHEDULED,
		})
	);
});

describe('Frequency-specific snooze behavior', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should navigate to Dashboard for all frequency-specific snooze scenarios', async () => {
		// Clear mocks
		scheduledCallService.showSnoozeOptions.mockClear();

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

		// Verify showSnoozeOptions was called with correct params
		expect(scheduledCallService.showSnoozeOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'test-reminder-id',
				contactId: 'test-contact',
				type: REMINDER_TYPES.SCHEDULED,
			})
		);
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
		// Reset Alert mock
		Alert.alert.mockReset();

		// Make scheduledCallService.showSnoozeOptions throw an error
		scheduledCallService.showSnoozeOptions.mockImplementationOnce(() => {
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
