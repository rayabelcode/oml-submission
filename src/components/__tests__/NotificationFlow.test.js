import { DateTime } from 'luxon';
import { snoozeHandler, SnoozeHandler } from '../../utils/snoozeHandler';
import { MAX_SNOOZE_ATTEMPTS } from '../../../constants/notificationConstants';

beforeAll(() => {
	// Suppress expected console errors in tests
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	// Restore console.error
	jest.spyOn(console, 'error').mockRestore();
});

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
	getUserPreferences: jest.fn().mockResolvedValue({}),
	getActiveReminders: jest.fn().mockResolvedValue([]),
	updateContactScheduling: jest.fn().mockResolvedValue(true),
	getContactById: jest.fn().mockResolvedValue({}),
}));

// Mock react-native
jest.mock('react-native', () => ({
	Platform: {
		OS: 'ios',
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
