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

import {
	handleNotificationResponse,
	setupNotificationHandlers,
} from '../../utils/notifications/notificationHandler';
import { snoozeHandler } from '../../utils/scheduler/snoozeHandler';
import { Notifications } from 'expo-notifications';

jest.mock('../../utils/scheduler/snoozeHandler', () => ({
	snoozeHandler: {
		handleSnooze: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock('expo-notifications', () => ({
	Notifications: {
		addNotificationResponseReceivedListener: jest.fn(),
	},
}));

describe('Notification Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('handleNotificationResponse', () => {
		it('should handle snooze action for scheduled notifications', async () => {
			const response = {
				actionIdentifier: 'snooze',
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

			expect(snoozeHandler.handleSnooze).toHaveBeenCalledWith('test-contact', 'later_today');
		});

		it('should ignore notifications without type', async () => {
			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {},
						},
					},
				},
			};

			await handleNotificationResponse(response);

			expect(snoozeHandler.handleSnooze).not.toHaveBeenCalled();
		});

		it('should handle follow-up notifications', async () => {
			const response = {
				notification: {
					request: {
						content: {
							data: {
								type: 'FOLLOW_UP',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);
			// TO DO: Add assertions for follow-up handling once implemented
		});
	});

	describe('setupNotificationHandlers', () => {
		it('should set up notification response listener', () => {
			setupNotificationHandlers();

			expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(
				expect.any(Function)
			);
		});
	});
});
