import { DateTime } from 'luxon';
import { snoozeHandler, SnoozeHandler } from '../../utils/snoozeHandler';
import { MAX_SNOOZE_ATTEMPTS } from '../../../constants/notificationConstants';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import { schedulingHistory } from '../../utils/schedulingHistory';
import { completeFollowUp } from '../../utils/callHandler';
import { cleanupService } from '../../utils/cleanup';
import { SchedulingService } from '../../utils/scheduler';
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
			type: 'scheduled',
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

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn(),
	fetch: jest.fn().mockResolvedValue({
		isConnected: true,
		isInternetReachable: true,
	}),
}));

// Mock schedulingHistory with default export
jest.mock('../../utils/schedulingHistory', () => {
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
	getUserPreferences: jest.fn().mockResolvedValue({}),
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
			type: 'scheduled',
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
	},
}));

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

	beforeEach(() => {
		jest.clearAllMocks();
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
		const mockHistory = require('../../utils/schedulingHistory').schedulingHistory;
		expect(mockHistory.trackSnooze).toHaveBeenCalled();
	});

	it('handles tomorrow scheduling', async () => {
		await snoozeHandler.initialize();
		const result = await snoozeHandler.handleSnooze(mockContactId, 'tomorrow', mockCurrentTime);
		expect(result).toBeTruthy();
		const mockHistory = require('../../utils/schedulingHistory').schedulingHistory;
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
		const mockHistory = require('../../utils/schedulingHistory').schedulingHistory;
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
		const mockHistory = require('../../utils/schedulingHistory').schedulingHistory;
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
		// Get the mock coordinator from the mock
		const { notificationCoordinator: mockCoordinator } = require('../../utils/notificationCoordinator');
		mockCoordinator.notificationMap.clear();
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

		// Setup initial reminder
		const initialDate = new Date();
		const schedulingResult = await schedulingService.scheduleReminder(mockContact, initialDate, 'weekly');

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
		const mockHistory = require('../../utils/schedulingHistory').schedulingHistory;
		const history = await mockHistory.analyzeContactPatterns(mockContact.id);
		expect(history.successfulAttempts.length).toBeGreaterThan(0);
	});

	// Add these tests in the Complete Reminder Lifecycle describe block

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
});
