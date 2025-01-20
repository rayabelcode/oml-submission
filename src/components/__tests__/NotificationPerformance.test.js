// Mock Firebase first
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
	getUserProfile: jest.fn().mockResolvedValue({
		expoPushToken: 'mock-token',
		uid: 'test-user-id',
	}),
}));

// Mock notification constants
const NOTIFICATION_CONSTANTS = {
	COORDINATOR_CONFIG: {
		BATCH_SIZE: 50,
		CLEANUP_INTERVAL: 60 * 60 * 1000,
		SYNC_INTERVAL: 15 * 60 * 1000,
		STORAGE_KEYS: {
			NOTIFICATION_MAP: 'notification_map',
			PENDING_QUEUE: '@PendingNotifications',
			LAST_CLEANUP: '@LastCleanupTime',
			LAST_SYNC: '@LastSyncTime',
		},
	},
	ERROR_HANDLING: {
		RETRY: {
			MAX_ATTEMPTS: 3,
			INTERVALS: [1000, 5000, 15000],
		},
		OFFLINE: {
			MAX_QUEUE_SIZE: 100,
		},
	},
};

jest.mock('../../../constants/notificationConstants', () => NOTIFICATION_CONSTANTS);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn((callback) => {
		callback({ isConnected: true, isInternetReachable: true });
		return jest.fn();
	}),
	fetch: jest.fn().mockResolvedValue({
		isConnected: true,
		isInternetReachable: true,
	}),
}));

// Mock React Native
jest.mock('react-native', () => ({
	Platform: {
		OS: 'ios',
		select: jest.fn(),
	},
	AppState: {
		addEventListener: jest.fn(() => ({
			remove: jest.fn(),
		})),
	},
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	setNotificationHandler: jest.fn(),
	setBadgeCountAsync: jest.fn(),
	scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id'),
	cancelScheduledNotificationAsync: jest.fn(),
	setNotificationCategoryAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
	AndroidImportance: { MAX: 5 },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));

// Mock config/firebase
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

// Rest of imports
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Notification Performance and Concurrency Tests', () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		notificationCoordinator.initialized = false;
		notificationCoordinator.notificationMap = new Map();
		notificationCoordinator.pendingQueue = new Map();
		await notificationCoordinator.initialize();
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('Batch Processing', () => {
		it('should handle large batches of notifications efficiently', async () => {
			const batchSize = 100;
			const notifications = Array(batchSize)
				.fill()
				.map((_, index) => ({
					content: {
						title: `Test ${index}`,
						body: `Test notification ${index}`,
						data: { type: 'SCHEDULED' },
					},
					trigger: { seconds: 60 + index },
				}));

			const startTime = Date.now();
			const results = await Promise.all(
				notifications.map(({ content, trigger }) =>
					notificationCoordinator.scheduleNotification(content, trigger)
				)
			);

			const endTime = Date.now();
			const processingTime = endTime - startTime;

			expect(results).toHaveLength(batchSize);
			expect(processingTime).toBeLessThan(5000); // Should process 100 notifications in under 5 seconds
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(batchSize);
		});
	});

	describe('Rate Limiting', () => {
		it('should handle rate limiting when scheduling many notifications quickly', async () => {
			const requests = 20;
			const interval = 100; // ms between requests
			const notifications = [];

			for (let i = 0; i < requests; i++) {
				notifications.push(
					notificationCoordinator.scheduleNotification(
						{
							title: `Test ${i}`,
							body: `Test notification ${i}`,
							data: { type: 'SCHEDULED' },
						},
						{ seconds: 60 }
					)
				);
				await new Promise((resolve) => setTimeout(resolve, interval));
			}

			const results = await Promise.all(notifications);
			expect(results).toHaveLength(requests);
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(requests);
		});
	});

	describe('Concurrent Operations', () => {
		it('should handle concurrent notification scheduling and cancellation', async () => {
			const operations = [];

			// Schedule notifications
			for (let i = 0; i < 10; i++) {
				operations.push(
					notificationCoordinator.scheduleNotification({ title: `Test ${i}` }, { seconds: 60 })
				);
			}

			// Perform cleanup while scheduling
			operations.push(notificationCoordinator.performCleanup());

			// Add some cancellations
			operations.push(
				notificationCoordinator.cancelNotification('test-id-1'),
				notificationCoordinator.cancelNotification('test-id-2')
			);

			await expect(Promise.all(operations)).resolves.toBeDefined();
		});
	});

	describe('Error Recovery', () => {
		it('should recover from storage errors during batch operations', async () => {
			AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

			const notifications = Array(5)
				.fill()
				.map((_, i) => ({
					content: { title: `Test ${i}` },
					trigger: { seconds: 60 },
				}));

			const results = await Promise.all(
				notifications.map(({ content, trigger }) =>
					notificationCoordinator.scheduleNotification(content, trigger)
				)
			);

			expect(results).toHaveLength(5);
		});
	});
});
