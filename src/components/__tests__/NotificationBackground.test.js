// Mock external dependencies
jest.mock('firebase/firestore', () => {
	const userDocRef = { id: 'test-user-id' };
	return {
		initializeFirestore: jest.fn(),
		persistentLocalCache: jest.fn(),
		persistentMultipleTabManager: jest.fn(),
		getDoc: jest.fn(),
		setDoc: jest.fn(),
		updateDoc: jest.fn(),
		doc: jest.fn().mockReturnValue(userDocRef),
		serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
		arrayUnion: jest.fn((token) => ['mock-token-1', 'mock-token-2', token]),
		getUserProfile: jest.fn().mockResolvedValue({
			expoPushTokens: ['mock-token-1', 'mock-token-2'],
			uid: 'test-user-id',
		}),
	};
});

jest.mock('../../utils/notifications/reminderSync', () => ({
	reminderSync: {
		initialized: false,
		start: jest.fn().mockResolvedValue(true),
		stop: jest.fn(),
	},
}));

jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: {
			uid: 'test-user-id',
		},
	},
	db: {},
}));

jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn((callback) => {
		callback({ isConnected: true });
		return jest.fn();
	}),
	fetch: jest.fn().mockResolvedValue({
		isConnected: true,
		isInternetReachable: true,
	}),
}));

// Define constants that will be used by the coordinator
const NOTIFICATION_MAP_KEY = 'notification_map';
const COORDINATOR_CONFIG = {
	BATCH_SIZE: 50,
	CLEANUP_INTERVAL: 60 * 60 * 1000,
	SYNC_INTERVAL: 15 * 60 * 1000,
	STORAGE_KEYS: {
		NOTIFICATION_MAP: 'notification_map',
		PENDING_QUEUE: '@PendingNotifications',
		LAST_CLEANUP: '@LastCleanupTime',
		LAST_SYNC: '@LastSyncTime',
	},
};
const IOS_CONFIGS = {
	NOTIFICATION_SETTINGS: {
		FOREGROUND: {
			alert: true,
			badge: true,
			sound: true,
		},
		CATEGORIES: {
			SCHEDULED: {
				identifier: 'SCHEDULED',
				actions: [],
			},
			FOLLOW_UP: {
				identifier: 'FOLLOW_UP',
				actions: [],
			},
		},
	},
};
const NOTIFICATION_CONFIGS = {
	FOLLOW_UP: {
		TIMEOUT: 24 * 60 * 60 * 1000,
		CLEANUP: {
			TIMEOUT: 24 * 60 * 60 * 1000,
		},
	},
	SCHEDULED: {
		CLEANUP: {
			TIMEOUT: 24 * 60 * 60 * 1000,
		},
	},
};
const ERROR_HANDLING = {
	RETRY: {
		MAX_ATTEMPTS: 3,
		INTERVALS: [1000, 5000, 15000],
	},
	OFFLINE: {
		MAX_QUEUE_SIZE: 100,
	},
};

// Mock the constants module
jest.mock('../../../constants/notificationConstants', () => ({
	NOTIFICATION_MAP_KEY,
	COORDINATOR_CONFIG,
	IOS_CONFIGS,
	NOTIFICATION_CONFIGS,
	ERROR_HANDLING,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
	Platform: {
		OS: 'ios',
		select: jest.fn(),
	},
	AppState: {
		addEventListener: jest.fn((event, callback) => ({
			remove: jest.fn(),
		})),
		currentState: 'active',
	},
}));

jest.mock('expo-notifications', () => ({
	requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	setNotificationHandler: jest.fn(),
	setBadgeCountAsync: jest.fn(),
	scheduleNotificationAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(),
	setNotificationCategoryAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
	AndroidImportance: { MAX: 5 },
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../utils/notifications/pushNotification', () => ({
	sendPushNotification: jest.fn().mockResolvedValue(true),
	scheduleLocalNotificationWithPush: jest.fn().mockResolvedValue('test-id'),
}));

// Import dependencies after mocks
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationCoordinator } from '../../utils/notificationCoordinator';

describe('Background Mode Tests', () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		notificationCoordinator.initialized = false;
		notificationCoordinator.badgeCount = 0;
		notificationCoordinator.notificationMap = new Map();
		notificationCoordinator.pendingQueue = new Map();

		AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
		AsyncStorage.setItem.mockImplementation(() => Promise.resolve());

		await notificationCoordinator.initialize();
	});

	afterEach(async () => {
		await notificationCoordinator.cleanup();
	});

	describe('Background State Transitions', () => {
		it('should maintain notifications when entering background', async () => {
			const notificationId = 'test-id';
			Notifications.scheduleNotificationAsync.mockResolvedValueOnce(notificationId);

			await notificationCoordinator.scheduleNotification({ title: 'Test', body: 'Message' }, { seconds: 60 });

			await notificationCoordinator.handleAppStateChange('background');
			expect(notificationCoordinator.notificationMap.has(notificationId)).toBeTruthy();
			expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
		});

		it('should sync pending notifications when returning to foreground', async () => {
			const pendingId = 'pending-id';
			notificationCoordinator.pendingQueue.set(pendingId, {
				content: { title: 'Pending', body: 'Test' },
				trigger: { seconds: 60 },
				options: {},
			});

			await notificationCoordinator.handleAppStateChange('active');
			expect(notificationCoordinator.pendingQueue.size).toBe(0);
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
		});

		it('should maintain push token registration in background', async () => {
			const { doc, updateDoc } = require('firebase/firestore');
			const { db } = require('../../config/firebase'); // Add this import

			// Clear previous calls
			updateDoc.mockClear();

			// Force re-initialization
			notificationCoordinator.initialized = false;
			await notificationCoordinator.initialize();

			// Verify token registration was maintained
			expect(updateDoc).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					expoPushTokens: ['mock-token-1', 'mock-token-2', 'mock-expo-token'],
					devicePlatform: 'ios',
					lastTokenUpdate: expect.any(Object),
				})
			);
		});
	});

	describe('Network State Handling', () => {
		it('should queue notifications when offline', async () => {
			NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });

			const notificationId = await notificationCoordinator.scheduleNotification(
				{ title: 'Offline', body: 'Test' },
				{ seconds: 60 }
			);

			expect(notificationCoordinator.pendingQueue.has(notificationId)).toBeTruthy();
		});

		it('should process queue when network becomes available', async () => {
			const pendingId = 'pending-id';
			notificationCoordinator.pendingQueue.set(pendingId, {
				content: { title: 'Pending', body: 'Test' },
				trigger: { seconds: 60 },
				options: {},
			});

			await notificationCoordinator.handleNetworkChange({ isConnected: true });
			expect(notificationCoordinator.pendingQueue.size).toBe(0);
		});
	});

	describe('Background Cleanup', () => {
		it('should perform cleanup when entering background', async () => {
			const expiredId = 'expired-id';
			notificationCoordinator.notificationMap.set(expiredId, {
				timestamp: new Date(Date.now() - NOTIFICATION_CONFIGS.FOLLOW_UP.TIMEOUT - 1000).toISOString(),
				options: { type: 'FOLLOW_UP' },
			});

			await notificationCoordinator.handleAppStateChange('background');
			await notificationCoordinator.performCleanup();
			expect(notificationCoordinator.notificationMap.has(expiredId)).toBeFalsy();
		});

		it('should preserve valid notifications during background cleanup', async () => {
			const validId = 'valid-id';
			notificationCoordinator.notificationMap.set(validId, {
				timestamp: new Date().toISOString(),
				options: { type: 'SCHEDULED' },
			});

			await notificationCoordinator.handleAppStateChange('background');
			expect(notificationCoordinator.notificationMap.has(validId)).toBeTruthy();
		});
	});
});
