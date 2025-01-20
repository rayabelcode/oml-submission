jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(),
	persistentMultipleTabManager: jest.fn(),
	getDoc: jest.fn(),
	setDoc: jest.fn(),
	updateDoc: jest.fn(),
	doc: jest.fn(),
	serverTimestamp: jest.fn(),
	getUserProfile: jest.fn().mockResolvedValue({
		expoPushToken: 'mock-token',
		uid: 'test-user-id',
	}),
}));

jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: {
			uid: 'test-user-id',
		},
	},
	db: {},
}));

import { jest } from '@jest/globals';
import NetInfo from '@react-native-community/netinfo';

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

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';

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

// Mock the constants module before any imports that might use it
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
}));

jest.mock('../../utils/notifications/pushNotification', () => ({
	sendPushNotification: jest.fn().mockResolvedValue(true),
	scheduleLocalNotificationWithPush: jest.fn().mockResolvedValue('test-id'),
}));

// Import coordinator after all mocks are set up
import { notificationCoordinator } from '../../utils/notificationCoordinator';

describe('NotificationCoordinator', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Reset coordinator state
		notificationCoordinator.initialized = false;
		notificationCoordinator.badgeCount = 0;
		notificationCoordinator.notificationMap = new Map();
		notificationCoordinator.pendingQueue = new Map();

		// Mock AsyncStorage
		AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
		AsyncStorage.setItem.mockImplementation(() => Promise.resolve());

		// Reset NetInfo mocks
		NetInfo.fetch.mockClear();
		NetInfo.addEventListener.mockClear();
	});

	describe('Initialization', () => {
		it('should initialize successfully', async () => {
			Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
			Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

			const result = await notificationCoordinator.initialize();

			expect(result).toBe(true);
			expect(notificationCoordinator.initialized).toBe(true);
			expect(Notifications.setNotificationHandler).toHaveBeenCalled();
		});

		it('should load stored data correctly', async () => {
			const mockStoredData = {
				badgeCount: '5',
				[COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP]: JSON.stringify([
					[1, { content: 'test', options: { type: 'SCHEDULED' } }],
				]),
				[COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE]: JSON.stringify([
					[2, { content: 'pending', options: { type: 'SCHEDULED' } }],
				]),
			};
			AsyncStorage.getItem.mockImplementation((key) => Promise.resolve(mockStoredData[key]));
			await notificationCoordinator.initialize();
			expect(notificationCoordinator.badgeCount).toBe(5);
			expect(notificationCoordinator.notificationMap.size).toBe(1);
			expect(notificationCoordinator.pendingQueue.size).toBe(1);
		});
	});

	describe('Notification Scheduling', () => {
		beforeEach(async () => {
			await notificationCoordinator.initialize();
		});

		it('should schedule notification successfully', async () => {
			const mockContent = {
				title: 'Test',
				body: 'Test notification',
				data: {},
			};
			const mockTrigger = {
				seconds: 60,
				repeats: false,
			};

			Notifications.scheduleNotificationAsync.mockResolvedValueOnce('test-id');

			const result = await notificationCoordinator.scheduleNotification(mockContent, mockTrigger, {
				type: 'SCHEDULED',
			});

			expect(result).toBe('test-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content: expect.objectContaining(mockContent),
				trigger: mockTrigger,
			});
		}, 10000);
	});

	describe('Badge Management', () => {
		beforeEach(async () => {
			await notificationCoordinator.initialize();
			Notifications.setBadgeCountAsync.mockClear();
		});

		it('should handle badge count operations correctly', async () => {
			// Test increment
			await notificationCoordinator.incrementBadge();
			expect(notificationCoordinator.badgeCount).toBe(1);
			expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(1);

			// Test decrement
			await notificationCoordinator.decrementBadge();
			expect(notificationCoordinator.badgeCount).toBe(0);
			expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(0);

			// Test reset
			notificationCoordinator.badgeCount = 5;
			await notificationCoordinator.resetBadge();
			expect(notificationCoordinator.badgeCount).toBe(0);
			expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(0);
		});
	});

	describe('Cleanup Operations', () => {
		beforeEach(async () => {
			await notificationCoordinator.initialize();
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.clearAllTimers();
			jest.clearAllMocks();
		});

		it('should clean up expired notifications', async () => {
			const mockExpiredNotification = {
				content: { title: 'Expired' },
				timestamp: new Date(Date.now() - NOTIFICATION_CONFIGS.FOLLOW_UP.TIMEOUT - 1000).toISOString(),
				options: { type: 'FOLLOW_UP' },
			};

			notificationCoordinator.notificationMap.set('expired-id', mockExpiredNotification);

			await notificationCoordinator.performCleanup();

			expect(notificationCoordinator.notificationMap.has('expired-id')).toBe(false);
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('expired-id');
		});

		it('should maintain active notifications', async () => {
			const mockActiveNotification = {
				content: { title: 'Active' },
				timestamp: new Date().toISOString(),
			};

			notificationCoordinator.notificationMap.set('active-id', mockActiveNotification);

			await notificationCoordinator.performCleanup();

			expect(notificationCoordinator.notificationMap.has('active-id')).toBe(true);
			expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('active-id');
		});

		it('should update last cleanup time', async () => {
			await notificationCoordinator.performCleanup();

			expect(AsyncStorage.setItem).toHaveBeenCalledWith(
				COORDINATOR_CONFIG.STORAGE_KEYS.LAST_CLEANUP,
				expect.any(String)
			);
		});
	});

	describe('Sync Operations', () => {
		beforeEach(async () => {
			await notificationCoordinator.initialize();
		});

		it('should handle failed sync attempts', async () => {
			// Setup
			const mockPendingNotification = {
				content: { title: 'Pending' },
				trigger: { seconds: 60 },
				options: { type: 'SCHEDULED', retry: false },
			};

			notificationCoordinator.pendingQueue.set('pending-id', mockPendingNotification);

			// Mock in order
			NetInfo.fetch.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
			Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Sync failed'));

			await notificationCoordinator.syncPendingNotifications();

			expect(notificationCoordinator.pendingQueue.has('pending-id')).toBe(true);
		}, 10000);

		it('should not sync when offline', async () => {
			NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
			await notificationCoordinator.syncPendingNotifications();
			expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
		});
	});

	describe('Event Listeners', () => {
		it('should register app state listener on initialization', async () => {
			await notificationCoordinator.initialize();
			expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
		});

		it('should register network listener on initialization', async () => {
			await notificationCoordinator.initialize();
			expect(NetInfo.addEventListener).toHaveBeenCalled();
		});

		it('should clean up listeners on cleanup', async () => {
			// Set up mock before initialization
			const mockRemove = jest.fn();
			const mockListener = { remove: mockRemove };

			// Mock both listeners
			AppState.addEventListener.mockReturnValue(mockListener);
			NetInfo.addEventListener.mockReturnValue(mockRemove);

			// Initialize and wait for it to complete
			await notificationCoordinator.initialize();

			// Call cleanup
			await notificationCoordinator.cleanup();

			// Both listeners should be cleaned up
			expect(mockRemove).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should handle storage errors gracefully', async () => {
			AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

			await notificationCoordinator.saveNotificationMap();

			// Should not throw error
			expect(AsyncStorage.setItem).toHaveBeenCalled();
		});

		it('should handle notification scheduling errors', async () => {
			Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Scheduling error'));

			const content = { title: 'Test' };
			const trigger = { seconds: 60 };

			await expect(
				notificationCoordinator.scheduleNotification(content, trigger, { retry: false })
			).rejects.toThrow('Scheduling error');
		});

		it('should handle permission errors', async () => {
			Notifications.getPermissionsAsync.mockRejectedValueOnce(new Error('Permission error'));
			const result = await notificationCoordinator.requestPermissions();
			expect(result).toBe(false);
		});
	});
});
