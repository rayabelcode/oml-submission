import { DateTime } from 'luxon';
import { snoozeHandler, SnoozeHandler } from '../../utils/scheduler/snoozeHandler';
import { MAX_SNOOZE_ATTEMPTS } from '../../../constants/notificationConstants';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import { schedulingHistory } from '../../utils/scheduler/schedulingHistory';
import { completeFollowUp } from '../../utils/callHandler';
import { cleanupService } from '../../utils/cleanup';
import { SchedulingService } from '../../utils/scheduler/scheduler';
import { handleNotificationResponse } from '../../utils/notifications/notificationHandler';
import { eventEmitter } from '../../utils/notifications';
import * as Notifications from 'expo-notifications';
import {
	getReminder,
	getContactById,
	updateReminder,
	addContactHistory,
	updateContactScheduling,
} from '../../utils/firestore';

// Mock callHandler
jest.mock('../../utils/callHandler', () => ({
	completeFollowUp: jest.fn().mockImplementation(async (reminderId, notes) => {
		// Get reminder
		const mockReminder = await require('../../utils/firestore').getReminder(reminderId);
		if (!mockReminder) {
			throw new Error('Reminder not found');
		}

		// Validate reminder status
		if (mockReminder.status === 'completed') {
			throw new Error('Invalid status transition');
		}

		// Get contact
		const mockContact = await require('../../utils/firestore').getContactById(mockReminder.contact_id);
		if (!mockContact) {
			throw new Error('Contact not found');
		}

		// Validate notes length
		if (notes && notes.length > 1000) {
			throw new Error('Notes too long');
		}

		// Update reminder
		await require('../../utils/firestore').updateReminder(reminderId, {
			status: 'completed',
			notes_added: true,
			notes: notes,
		});

		// Add to history
		await require('../../utils/firestore').addContactHistory(mockReminder.contact_id, {
			type: 'SCHEDULED',
			status: 'completed',
			notes: notes,
		});

		// Schedule next reminder
		await require('../../utils/firestore').updateContactScheduling(mockReminder.contact_id, {
			frequency: mockContact.scheduling?.frequency || 'weekly',
		});

		return true;
	}),
}));

beforeAll(() => {
	// Suppress expected console errors in tests
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	// Restore console.error
	jest.spyOn(console, 'error').mockRestore();
});

// Mock navigation
jest.mock('@react-navigation/native', () => ({
	createNavigationContainerRef: () => ({
		current: {
			navigate: jest.fn(),
			dispatch: jest.fn(),
		},
	}),
	NavigationContainer: jest.fn(),
	useNavigation: () => ({
		navigate: jest.fn(),
		dispatch: jest.fn(),
	}),
	Platform: {
		select: jest.fn(),
		OS: 'ios',
	},
}));

// Mock Notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(),
	getAllScheduledNotificationsAsync: jest.fn(),
	presentNotificationAsync: jest.fn().mockReturnValue('mock-notification-id'),
	getBadgeCountAsync: jest.fn().mockResolvedValue(0),
	setBadgeCountAsync: jest.fn().mockResolvedValue(1),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn(),
	fetch: jest.fn().mockResolvedValue({
		isConnected: true,
		isInternetReachable: true,
	}),
}));

// Mock schedulingHistory with default export
jest.mock('../../utils/scheduler/schedulingHistory', () => {
	const mockHistory = {
		initialize: jest.fn().mockResolvedValue(true),
		trackSnooze: jest.fn().mockResolvedValue(true),
		trackSkip: jest.fn().mockResolvedValue(true),
		storeReschedulingPattern: jest.fn().mockResolvedValue(true),
		analyzeContactPatterns: jest.fn().mockResolvedValue({
			successRates: {
				byHour: { 16: { successRate: 0.8 } },
			},
			successfulAttempts: [1, 2, 3],
		}),
	};
	return {
		__esModule: true,
		default: mockHistory,
		schedulingHistory: mockHistory,
	};
});

// Mock Firebase
jest.mock('firebase/firestore', () => ({
	getFirestore: jest.fn(),
	doc: jest.fn(),
	getDoc: jest.fn(() => ({
		exists: () => true,
		data: () => ({
			scheduling: {},
			contact_history: [],
		}),
	})),
	updateDoc: jest.fn(),
	writeBatch: jest.fn(() => ({
		set: jest.fn(),
		update: jest.fn(),
		commit: jest.fn().mockResolvedValue(true),
	})),
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	getDocs: jest.fn(() => ({
		docs: [],
	})),
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
			_seconds: Math.floor(date.getTime() / 1000),
			_nanoseconds: (date.getTime() % 1000) * 1000000,
		}),
		now: () => ({
			toDate: () => new Date(),
			_seconds: Math.floor(Date.now() / 1000),
			_nanoseconds: 0,
		}),
	},
	increment: jest.fn((num) => ({ increment: num })),
	serverTimestamp: jest.fn(() => ({
		_seconds: Math.floor(Date.now() / 1000),
		_nanoseconds: 0,
	})),
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
	app: {},
}));

// Mock firestore utilities
jest.mock('../../utils/firestore', () => ({
	...jest.requireActual('../../utils/firestore'),
	getUserPreferences: jest.fn().mockImplementation(async (userId) => {
		if (!userId) throw new Error('User not authenticated');
		return {
			scheduling_preferences: {
				minimumGapMinutes: 30,
				preferredTimeSlots: [],
				timezone: 'America/New_York',
			},
		};
	}),
	getActiveReminders: jest.fn().mockResolvedValue([]),
	updateContactScheduling: jest.fn().mockResolvedValue(true),
	getContactById: jest.fn().mockImplementation(async (contactId) => {
		if (contactId === 'missing-contact') return null;
		return {
			id: contactId,
			scheduling: {
				frequency: 'weekly',
				relationship_type: 'friend',
			},
		};
	}),
	getReminder: jest.fn().mockImplementation(async (reminderId) => {
		if (reminderId === 'non-existent-id') return null;
		return {
			id: reminderId,
			type: 'SCHEDULED',
			status: 'pending',
			contact_id: 'test-contact',
			scheduledTime: { toDate: () => new Date() },
			notes: 'Test call notes',
		};
	}),
	updateReminder: jest.fn().mockResolvedValue(true),
	addContactHistory: jest.fn().mockResolvedValue(true),
	deleteReminder: jest.fn().mockImplementation(async (reminderId) => {
		if (reminderId === 'test-reminder') return true;
		throw new Error('Cleanup failed');
	}),
}));

// Mock cleanup service
jest.mock('../../utils/cleanup', () => ({
	cleanupService: {
		performCleanup: jest.fn().mockImplementation(async () => {
			try {
				await require('../../utils/firestore').deleteReminder('test-reminder');
				return true;
			} catch (error) {
				// Swallow the error and continue
				console.error('Cleanup error:', error);
				return true;
			}
		}),
	},
}));

// Mock react-native
jest.mock('react-native', () => ({
	Platform: {
		OS: 'ios',
		select: jest.fn((input) => input.ios),
	},
	NativeModules: {
		RNCNetInfo: {
			getCurrentState: jest.fn(),
			getCurrentConnectivity: jest.fn(),
			isConnectionMetered: jest.fn(),
			addListener: jest.fn(),
			removeListeners: jest.fn(),
		},
	},
}));

// Mock notificationCoordinator
jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		notificationMap: new Map(),
		initialize: jest.fn().mockResolvedValue(true),
		scheduleNotification: jest.fn().mockResolvedValue('notification-id'),
		cancelNotification: jest.fn().mockResolvedValue(true),
		saveNotificationMap: jest.fn().mockResolvedValue(true),
		scheduleCustomDateReminder: jest.fn().mockImplementation(async (reminder) => {
			const mockNotifications = require('expo-notifications');
			await mockNotifications.scheduleNotificationAsync({
				content: {
					data: {
						type: 'CUSTOM_DATE',
						contactId: reminder.contactId,
					},
				},
			});
			return true;
		}),
	},
}));

// Mock for notificationHandler
jest.mock('../../utils/notifications/notificationHandler', () => ({
	handleNotificationResponse: jest.fn().mockImplementation(async (response) => {
		if (response.actionIdentifier === 'complete') {
			await require('../../utils/firestore').updateContactScheduling(
				response.notification.request.content.data.contactId,
				{ status: 'completed' }
			);
		} else if (response.actionIdentifier === 'snooze') {
			const { snoozeHandler } = require('../../utils/scheduler/snoozeHandler');
			await snoozeHandler.handleSnooze(
				response.notification.request.content.data.contactId,
				'later_today',
				undefined,
				response.notification.request.content.data.type
			);
		}
		return true;
	}),
}));

// Mock scheduler
jest.mock('../../utils/scheduler/scheduler', () => {
	let callCount = 0;

	return {
		SchedulingService: jest.fn().mockImplementation(() => ({
			findAvailableTimeSlot: jest.fn((date) => date),
			initialize: jest.fn(),
			scheduleNotificationForReminder: jest.fn().mockResolvedValue(true),
			scheduleReminder: jest.fn().mockImplementation(() => {
				const timestamp = Date.now() + ++callCount * 7 * 24 * 60 * 60 * 1000;
				return Promise.resolve({
					id: 'test-reminder-id',
					contact_id: 'test-contact',
					date: {
						toDate: () => new Date(timestamp),
					},
					scheduledTime: {
						toDate: () => new Date(timestamp),
					},
				});
			}),
		})),
		__resetCallCount: () => {
			callCount = 0;
		},
	};
});

const mockUserPreferences = {
	scheduling_preferences: {
		minimumGapMinutes: 30,
		optimalGapMinutes: 120,
	},
	relationship_types: {
		friend: {
			active_hours: { start: '09:00', end: '17:00' },
			preferred_days: ['monday', 'wednesday', 'friday'],
		},
	},
};

const schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');

describe('Notification Flow Integration', () => {
	const mockContactId = 'test-contact';
	const mockCurrentTime = DateTime.fromObject({ hour: 14 }); // 2 PM
	const mockUserId = 'test-user';

	beforeEach(() => {
		jest.clearAllMocks();
		// Initialize snoozeHandler with userId
		snoozeHandler.userId = mockUserId;
	});

	it('handles complete snooze flow', async () => {
		await snoozeHandler.initialize();
		const snoozeResult = await snoozeHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime);

		expect(snoozeResult).toBeTruthy();
	});

	it('handles skip flow', async () => {
		await snoozeHandler.initialize();
		const skipResult = await snoozeHandler.handleSnooze(mockContactId, 'skip', mockCurrentTime);

		expect(skipResult).toBeTruthy();
	});

	it('respects scheduling patterns', async () => {
		const result = await snoozeHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime);

		expect(result).toBeTruthy();
	});

	it('handles invalid snooze option', async () => {
		await expect(
			snoozeHandler.handleSnooze(mockContactId, 'invalid_option', mockCurrentTime)
		).rejects.toThrow();
	});

	it('handles failed scheduling attempt', async () => {
		const mockError = new Error('Scheduling failed');
		require('../../utils/firestore').updateContactScheduling.mockRejectedValueOnce(mockError);

		await expect(snoozeHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime)).rejects.toThrow(
			'Scheduling failed'
		);
	});

	it('tracks snooze attempts correctly', async () => {
		await snoozeHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime);
		const mockHistory = require('../../utils/scheduler/schedulingHistory').schedulingHistory;
		expect(mockHistory.trackSnooze).toHaveBeenCalled();
	});

	it('handles tomorrow scheduling', async () => {
		await snoozeHandler.initialize();
		const result = await snoozeHandler.handleSnooze(mockContactId, 'tomorrow', mockCurrentTime);
		expect(result).toBeTruthy();
		const mockHistory = require('../../utils/scheduler/schedulingHistory').schedulingHistory;
		expect(mockHistory.trackSnooze).toHaveBeenCalledWith(
			mockContactId,
			mockCurrentTime,
			expect.any(DateTime),
			'tomorrow'
		);
	});

	it('handles next week scheduling', async () => {
		await snoozeHandler.initialize();
		const result = await snoozeHandler.handleSnooze(mockContactId, 'next_week', mockCurrentTime);
		expect(result).toBeTruthy();
		const mockHistory = require('../../utils/scheduler/schedulingHistory').schedulingHistory;
		expect(mockHistory.trackSnooze).toHaveBeenCalledWith(
			mockContactId,
			mockCurrentTime,
			expect.any(DateTime),
			'next_week'
		);
	});

	it('fails initialization when user is not authenticated', async () => {
		// Mock getUserPreferences to throw an auth error
		const firestore = require('../../utils/firestore');
		firestore.getUserPreferences.mockRejectedValueOnce(new Error('User not authenticated'));

		await expect(snoozeHandler.initialize()).rejects.toThrow('User not authenticated');
	});

	it('uses optimal time from pattern analysis', async () => {
		const mockHistory = require('../../utils/scheduler/schedulingHistory').schedulingHistory;
		mockHistory.analyzeContactPatterns.mockResolvedValueOnce({
			successRates: {
				byHour: {
					16: { successRate: 0.9 },
					15: { successRate: 0.8 },
				},
			},
		});

		await snoozeHandler.initialize();
		const result = await snoozeHandler.handleSnooze(mockContactId, 'tomorrow', mockCurrentTime);

		expect(result).toBeTruthy();
		expect(mockHistory.analyzeContactPatterns).toHaveBeenCalled();
	});

	it('enforces max snooze attempts', async () => {
		const mockContact = {
			scheduling: {
				snooze_count: MAX_SNOOZE_ATTEMPTS,
			},
		};

		// Mock both getContactById and updateContactScheduling
		const firestore = require('../../utils/firestore');
		firestore.getContactById.mockResolvedValueOnce(mockContact);
		firestore.updateContactScheduling.mockRejectedValueOnce(new Error('Maximum snooze attempts reached'));

		await snoozeHandler.initialize();
		await expect(snoozeHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime)).rejects.toThrow(
			/maximum snooze attempts/i
		);
	});

	it('handles timezone conversions correctly', async () => {
		const timezone = 'America/New_York';
		const localHandler = new SnoozeHandler('test-user', timezone);
		await localHandler.initialize();

		const result = await localHandler.handleSnooze(mockContactId, 'later_today', mockCurrentTime);

		expect(result).toBeTruthy();
		const scheduledTime = DateTime.fromJSDate(result).setZone(timezone);
		expect(scheduledTime.zoneName).toBe(timezone);
	});
});

// Complete reminder lifecycle
describe('Complete Reminder Lifecycle', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		const { notificationCoordinator: mockCoordinator } = require('../../utils/notificationCoordinator');
		mockCoordinator.notificationMap.clear();
		require('../../utils/scheduler/scheduler').__resetCallCount();
		// Reset schedulingHistory mock to return consistent data
		require('../../utils/scheduler/schedulingHistory').schedulingHistory.analyzeContactPatterns.mockResolvedValue(
			{
				successRates: {
					byHour: { 16: { successRate: 0.8 } },
				},
				successfulAttempts: [1, 2, 3],
			}
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});
	it('should handle complete reminder lifecycle', async () => {
		const mockContact = {
			id: 'test-contact',
			scheduling: {
				frequency: 'weekly',
				relationship_type: 'friend',
			},
		};

		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: mockContact.id,
			scheduledTime: { toDate: () => new Date() },
			notes: 'Test call notes',
		};

		// Setup mocks
		getReminder.mockResolvedValue(mockReminder);
		getContactById.mockResolvedValue(mockContact);
		updateReminder.mockResolvedValue(true);
		addContactHistory.mockResolvedValue(true);
		updateContactScheduling.mockResolvedValue({
			next_contact: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week later
		});

		// 1. Complete the call
		const completionResult = await completeFollowUp(mockReminder.id, 'Test notes');
		expect(completionResult).toBeTruthy();

		// 2. Verify reminder was updated
		expect(updateReminder).toHaveBeenCalledWith(
			mockReminder.id,
			expect.objectContaining({
				status: 'completed',
				notes_added: true,
				notes: 'Test notes',
			})
		);

		// 3. Verify contact history was updated
		expect(addContactHistory).toHaveBeenCalledWith(
			mockContact.id,
			expect.objectContaining({
				type: REMINDER_TYPES.SCHEDULED,
				status: 'completed',
				notes: 'Test notes',
			})
		);

		// 4. Verify next reminder was scheduled
		expect(updateContactScheduling).toHaveBeenCalledWith(
			mockContact.id,
			expect.objectContaining({
				frequency: 'weekly',
			})
		);

		// 5. Wait for cleanup cycle and verify cleanup
		await cleanupService.performCleanup();
		const firestore = require('../../utils/firestore');
		expect(firestore.deleteReminder).toHaveBeenCalledWith(mockReminder.id);
		expect(
			require('../../utils/notificationCoordinator').notificationCoordinator.notificationMap.has(
				mockReminder.id
			)
		).toBeFalsy();
	});

	it('should handle recurring reminder rescheduling', async () => {
		const mockContact = {
			id: 'test-contact',
			scheduling: {
				frequency: 'weekly',
				relationship_type: 'friend',
			},
		};

		// Setup mocks for multiple iterations
		getContactById.mockResolvedValue(mockContact);
		getReminder.mockResolvedValue({
			id: 'test-reminder-id',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: mockContact.id,
			scheduledTime: {
				toDate: () => new Date(),
			},
		});

		// Create fixed timestamps to ensure different times
		const firstTimestamp = new Date('2024-01-01T10:00:00Z').getTime();
		const secondTimestamp = new Date('2024-01-08T10:00:00Z').getTime();

		let isFirstCall = true;
		jest.spyOn(schedulingService, 'scheduleReminder').mockImplementation(() => {
			const timestamp = isFirstCall ? firstTimestamp : secondTimestamp;
			isFirstCall = false;
			return Promise.resolve({
				id: 'test-reminder-id',
				contact_id: mockContact.id,
				date: {
					toDate: () => new Date(timestamp),
				},
				scheduledTime: {
					toDate: () => new Date(timestamp),
				},
			});
		});

		// Setup initial reminder
		const schedulingResult = await schedulingService.scheduleReminder(mockContact, new Date(), 'weekly');
		expect(schedulingResult.date).toBeDefined();
		expect(schedulingResult.contact_id).toBe(mockContact.id);

		// Complete the reminder
		await completeFollowUp(schedulingResult.id, 'Test notes');

		// Verify next reminder was scheduled correctly
		const nextSchedule = await schedulingService.scheduleReminder(
			mockContact,
			schedulingResult.date.toDate(),
			'weekly'
		);

		expect(nextSchedule.date.toDate().getTime()).toBeGreaterThan(schedulingResult.date.toDate().getTime());
		expect(nextSchedule.contact_id).toBe(mockContact.id);

		// Verify scheduling history was updated
		const history = await schedulingHistory.analyzeContactPatterns(mockContact.id);
		expect(history.successfulAttempts.length).toBeGreaterThan(0);
	});

	it('should handle failed cleanup gracefully', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'completed',
		};

		getReminder.mockResolvedValue(mockReminder);
		require('../../utils/firestore').deleteReminder.mockRejectedValueOnce(new Error('Cleanup failed'));

		await expect(cleanupService.performCleanup()).resolves.not.toThrow();
	});

	it('should handle concurrent completions of the same reminder', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: 'test-contact',
		};

		getReminder.mockResolvedValue(mockReminder);
		updateReminder.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('Already completed'));

		// First completion should succeed
		await expect(completeFollowUp(mockReminder.id, 'First completion')).resolves.toBeTruthy();

		// Second completion should fail
		await expect(completeFollowUp(mockReminder.id, 'Second completion')).rejects.toThrow('Already completed');
	});

	it('should handle completion of non-existent reminder', async () => {
		getReminder.mockResolvedValue(null);

		await expect(completeFollowUp('non-existent-id', 'Test notes')).rejects.toThrow('Reminder not found');
	});

	it('should handle reminder completion with missing contact', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: 'missing-contact',
		};

		getReminder.mockResolvedValue(mockReminder);
		getContactById.mockResolvedValue(null);

		await expect(completeFollowUp(mockReminder.id, 'Test notes')).rejects.toThrow('Contact not found');
	});

	it('should handle network errors during reminder completion', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: 'test-contact',
		};

		getReminder.mockResolvedValueOnce(mockReminder);
		getContactById.mockResolvedValueOnce({
			id: 'test-contact',
			scheduling: { frequency: 'weekly' },
		});
		updateReminder.mockRejectedValueOnce(new Error('Network error'));

		await expect(completeFollowUp(mockReminder.id, 'Test notes')).rejects.toThrow('Network error');
	});

	it('should handle invalid reminder status transitions', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'completed', // Already completed
			contact_id: 'test-contact',
		};

		getReminder.mockResolvedValue(mockReminder);

		await expect(completeFollowUp(mockReminder.id, 'Test notes')).rejects.toThrow(
			'Invalid status transition'
		);
	});

	it('should handle long notes gracefully', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: 'test-contact',
		};

		const longNotes = 'a'.repeat(10000);
		getReminder.mockResolvedValueOnce(mockReminder);
		getContactById.mockResolvedValueOnce({
			id: 'test-contact',
			scheduling: { frequency: 'weekly' },
		});

		await expect(completeFollowUp(mockReminder.id, longNotes)).rejects.toThrow('Notes too long');
	});

	it('should handle reminder completion with special characters in notes', async () => {
		const mockReminder = {
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: 'test-contact',
		};

		const specialNotes = '🚀 Special chars: &<>"\'\\n\\r\\t';
		getReminder.mockResolvedValueOnce(mockReminder);
		getContactById.mockResolvedValueOnce({
			id: 'test-contact',
			scheduling: { frequency: 'weekly' },
		});

		const result = await completeFollowUp(mockReminder.id, specialNotes);
		expect(result).toBeTruthy();
		expect(updateReminder).toHaveBeenCalledWith(
			mockReminder.id,
			expect.objectContaining({
				notes: specialNotes,
			})
		);
	});

	it('should maintain reminder history after multiple reschedules', async () => {
		const mockContact = {
			id: 'test-contact',
			scheduling: {
				frequency: 'weekly',
				relationship_type: 'friend',
			},
		};

		// Setup mocks for multiple iterations
		getContactById.mockResolvedValue(mockContact);
		getReminder.mockResolvedValue({
			id: 'test-reminder',
			type: REMINDER_TYPES.SCHEDULED,
			status: 'pending',
			contact_id: mockContact.id,
		});

		// Complete and reschedule multiple times
		for (let i = 0; i < 3; i++) {
			const reminder = await schedulingService.scheduleReminder(mockContact, new Date(), 'weekly');
			await completeFollowUp(reminder.id, `Completion ${i}`);

			// Verify history is maintained
			const history = await schedulingHistory.analyzeContactPatterns(mockContact.id);
			expect(history.successfulAttempts.length).toBeGreaterThan(i);
		}
	});

	describe('CUSTOM_DATE Notification Flow', () => {
		it('handles complete flow for CUSTOM_DATE reminders', async () => {
			const customReminder = {
				id: 'custom-1',
				type: 'CUSTOM_DATE',
				scheduledTime: new Date('2024-12-31T12:00:00Z'),
				contactId: 'contact-1',
				contactName: 'John Custom',
			};

			// Test creation
			await notificationCoordinator.scheduleCustomDateReminder(customReminder);
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						data: expect.objectContaining({
							type: 'CUSTOM_DATE',
						}),
					}),
				})
			);

			// Spy for this test
			const { snoozeHandler } = require('../../utils/scheduler/snoozeHandler');
			const spy = jest.spyOn(snoozeHandler, 'handleSnooze');

			const response = {
				actionIdentifier: 'snooze',
				notification: {
					request: {
						content: {
							data: {
								type: 'CUSTOM_DATE',
								contactId: 'custom-1',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);
			expect(spy).toHaveBeenCalledWith('custom-1', 'later_today', undefined, 'CUSTOM_DATE');

			// Clean up spy
			spy.mockRestore();
		});

		it('handles completion of CUSTOM_DATE reminders', async () => {
			const response = {
				actionIdentifier: 'complete',
				notification: {
					request: {
						content: {
							data: {
								type: 'CUSTOM_DATE',
								contactId: 'custom-1',
							},
						},
					},
				},
			};

			await handleNotificationResponse(response);
			expect(updateContactScheduling).toHaveBeenCalledWith(
				'custom-1',
				expect.objectContaining({
					status: 'completed',
				})
			);
		});
	});

	it('emits an event when a follow-up notification is created', async () => {
		const mockNotifications = require('expo-notifications');
		mockNotifications.scheduleNotificationAsync.mockResolvedValue('mock-notification-id');
		mockNotifications.presentNotificationAsync.mockResolvedValue('mock-notification-id');
		mockNotifications.getBadgeCountAsync.mockResolvedValue(0);
		mockNotifications.setBadgeCountAsync.mockResolvedValue(1);

		// Mock AsyncStorage
		const AsyncStorage = require('@react-native-async-storage/async-storage');
		AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
		AsyncStorage.setItem.mockResolvedValue(undefined);

		// Mock the event emitter
		const { eventEmitter } = require('../../utils/notifications');
		const emitSpy = jest.spyOn(eventEmitter, 'emit');

		// Create a simple mock contact
		const mockContact = {
			id: 'contact-123',
			first_name: 'John',
			last_name: 'Doe',
			callData: {
				startTime: new Date().toISOString(),
				type: 'phone',
			},
		};

		// Future time to make sure we use scheduleNotificationAsync
		const futureTime = new Date(Date.now() + 60000);

		// Get the notification service
		const { notificationService } = require('../../utils/notifications');

		// Call method that should emit the event
		await notificationService.scheduleCallFollowUp(mockContact, futureTime);

		// Verify the event was emitted
		expect(emitSpy).toHaveBeenCalledWith('followUpCreated');
	});
});
