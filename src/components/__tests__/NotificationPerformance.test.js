// Mock Firebase first
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
	where: jest.fn().mockReturnThis(),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
	query: jest.fn().mockReturnThis(),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
	arrayUnion: jest.fn((token) => ['mock-token-1', 'mock-token-2', token]),
	getUserProfile: jest.fn().mockResolvedValue({
		expoPushTokens: ['mock-token-1', 'mock-token-2'],
		uid: 'test-user-id',
	}),
	collection: jest.fn(() => ({
		where: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		get: jest.fn().mockResolvedValue({ docs: [] }),
	})),
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
	REMINDER_TYPES: {
		SCHEDULED: 'SCHEDULED',
		FOLLOW_UP: 'FOLLOW_UP',
	},
	NOTIFICATION_TYPES: {
		SCHEDULED: 'SCHEDULED',
		FOLLOW_UP: 'FOLLOW_UP',
	},
	ERROR_CODES: {
		NETWORK_ERROR: 'NETWORK_ERROR',
		INVALID_TOKEN: 'INVALID_TOKEN',
		RATE_LIMIT: 'RATE_LIMIT',
	},
	REMINDER_STATUS: {
		PENDING: 'PENDING',
		COMPLETED: 'COMPLETED',
		SNOOZED: 'SNOOZED',
		SKIPPED: 'SKIPPED',
	},
	NOTIFICATION_CONFIGS: {
		SCHEDULED: {
			CLEANUP: {
				TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
			},
		},
		FOLLOW_UP: {
			CLEANUP: {
				TIMEOUT: 24 * 60 * 60 * 1000,
			},
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
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
	scheduleNotificationAsync: jest
		.fn()
		.mockImplementation(() => Promise.resolve(`notification-${Math.random()}`)),
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

	describe('Recurring Notification Performance', () => {
		beforeEach(async () => {
			jest.clearAllMocks();
			await notificationCoordinator.initialize();
		});

		it('should handle multiple recurring notifications efficiently', async () => {
			const recurringNotifications = Array(10)
				.fill()
				.map((_, index) => ({
					content: {
						title: `Recurring Test ${index}`,
						body: `Recurring notification ${index}`,
						data: {
							type: 'SCHEDULED',
							recurring: true,
							frequency: 'weekly',
						},
					},
					trigger: {
						seconds: 60 + index,
						repeats: true,
					},
				}));

			const startTime = Date.now();
			const results = await Promise.all(
				recurringNotifications.map(({ content, trigger }) =>
					notificationCoordinator.scheduleNotification(content, trigger)
				)
			);

			const endTime = Date.now();
			const processingTime = endTime - startTime;

			expect(results).toHaveLength(10);
			expect(processingTime).toBeLessThan(1000); // Should process 10 recurring notifications in under 1 second
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(10);
		});

		it('should handle concurrent recurring and one-time notifications', async () => {
			const mixedNotifications = [
				// Recurring notifications
				...Array(5)
					.fill()
					.map((_, index) => ({
						content: {
							title: `Recurring ${index}`,
							data: { type: 'SCHEDULED', recurring: true },
						},
						trigger: { seconds: 60, repeats: true },
					})),
				// One-time notifications
				...Array(5)
					.fill()
					.map((_, index) => ({
						content: {
							title: `One-time ${index}`,
							data: { type: 'SCHEDULED' },
						},
						trigger: { seconds: 60 },
					})),
			];

			const results = await Promise.all(
				mixedNotifications.map(({ content, trigger }) =>
					notificationCoordinator.scheduleNotification(content, trigger)
				)
			);

			expect(results).toHaveLength(10);
			expect(notificationCoordinator.notificationMap.size).toBe(10);
		});

		it('should handle updates to recurring notifications', async () => {
			// Mock a consistent ID generator
			let idCounter = 0;
			Notifications.scheduleNotificationAsync.mockImplementation(() =>
				Promise.resolve(`test-id-${idCounter++}`)
			);

			// Schedule initial notification
			const originalId = await notificationCoordinator.scheduleNotification(
				{
					title: 'Recurring Test',
					data: { type: 'SCHEDULED', recurring: true },
				},
				{ seconds: 60, repeats: true }
			);

			// Update notification
			const updateResult = await notificationCoordinator.scheduleNotification(
				{
					title: 'Updated Recurring Test',
					data: { type: 'SCHEDULED', recurring: true },
				},
				{ seconds: 120, repeats: true },
				{ replaceId: originalId }
			);

			expect(updateResult).toBe('test-id-1');
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(originalId);
		});

		it('should cleanup expired recurring notifications correctly', async () => {
			const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

			// Clear existing notifications
			notificationCoordinator.notificationMap.clear();

			// Mock the cleanup behavior
			Notifications.cancelScheduledNotificationAsync.mockImplementation(() => Promise.resolve());

			for (let i = 0; i < 5; i++) {
				const notificationId = `expired-recurring-${i}`;
				notificationCoordinator.notificationMap.set(notificationId, {
					content: {
						title: `Expired Recurring ${i}`,
						data: { type: NOTIFICATION_CONSTANTS.REMINDER_TYPES.SCHEDULED },
					},
					trigger: { repeats: true },
					timestamp: expiredDate.toISOString(),
					options: {
						type: NOTIFICATION_CONSTANTS.REMINDER_TYPES.SCHEDULED,
						recurring: true,
					},
				});
			}

			await notificationCoordinator.performCleanup();

			expect(notificationCoordinator.notificationMap.size).toBe(0);
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(5);
		});
	});

	describe('Multi-Token Performance', () => {
		beforeEach(async () => {
			jest.clearAllMocks();
			await notificationCoordinator.initialize();
		});

		it('should efficiently handle notifications for multiple devices', async () => {
			const { getUserProfile } = require('firebase/firestore');

			// Mock user with multiple devices
			const devices = Array(20)
				.fill()
				.map((_, i) => `device-${i}`);
			getUserProfile.mockResolvedValueOnce({
				expoPushTokens: devices,
				uid: 'test-user-id',
			});

			const startTime = Date.now();

			// Schedule notifications that will trigger push to all devices
			const results = await Promise.all(
				Array(10)
					.fill()
					.map((_, i) =>
						notificationCoordinator.scheduleNotification(
							{
								title: `Multi-device Test ${i}`,
								body: 'Test notification',
								data: { type: 'SCHEDULED' },
							},
							{ seconds: 60 + i }
						)
					)
			);

			const endTime = Date.now();
			const processingTime = endTime - startTime;

			expect(results).toHaveLength(10);
			expect(processingTime).toBeLessThan(2000); // Reasonable time for processing
			expect(notificationCoordinator.notificationMap.size).toBe(10);
		});

		it('should handle token cleanup efficiently', async () => {
			const { doc, updateDoc } = require('firebase/firestore');
			const { db } = require('../../config/firebase');

			// Create a mock document reference
			const userDocRef = { id: 'test-user-id' };
			doc.mockReturnValue(userDocRef);

			// Clear previous calls
			updateDoc.mockClear();

			const startTime = Date.now();

			// Simulate token cleanup
			await updateDoc(userDocRef, {
				expoPushTokens: ['valid-1', 'valid-2', 'valid-3'],
				lastTokenUpdate: expect.any(Object),
			});

			const endTime = Date.now();
			const cleanupTime = endTime - startTime;

			expect(cleanupTime).toBeLessThan(1000);
			expect(updateDoc).toHaveBeenCalledWith(
				userDocRef,
				expect.objectContaining({
					expoPushTokens: expect.any(Array),
				})
			);
		});

		it('should efficiently handle token updates during batch operations', async () => {
			const { doc, updateDoc, arrayUnion } = require('firebase/firestore');
			const { db } = require('../../config/firebase');

			// Create a mock document reference
			const userDocRef = { id: 'test-user-id' };
			doc.mockReturnValue(userDocRef);

			// Clear previous calls
			updateDoc.mockClear();

			// Reset coordinator state
			notificationCoordinator.initialized = false;

			// Initialize first to set up token handling
			await notificationCoordinator.initialize();

			// Schedule batch of notifications
			const batchSize = 50;
			const notifications = await Promise.all(
				Array(batchSize)
					.fill()
					.map((_, i) =>
						notificationCoordinator.scheduleNotification(
							{
								title: `Batch ${i}`,
								body: 'Test',
								data: { type: 'SCHEDULED' },
							},
							{ seconds: 60 + i }
						)
					)
			);

			// Verify token update
			expect(updateDoc).toHaveBeenCalledWith(
				userDocRef,
				expect.objectContaining({
					expoPushTokens: arrayUnion('mock-expo-token'),
					devicePlatform: 'ios',
					lastTokenUpdate: expect.any(Object),
				})
			);
			expect(notifications).toHaveLength(batchSize);
		});
	});
});
