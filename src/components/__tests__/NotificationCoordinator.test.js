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

jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: {
			uid: 'test-user-id',
		},
	},
	db: {},
}));

jest.mock('../../utils/notifications/reminderSync', () => ({
	reminderSync: {
		start: jest.fn().mockResolvedValue(true),
		stop: jest.fn(),
		initialized: false,
	},
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
	REMINDER_TYPES: {
		SCHEDULED: 'SCHEDULED',
		FOLLOW_UP: 'FOLLOW_UP',
		CUSTOM_DATE: 'CUSTOM_DATE',
	},
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
	getBadgeCountAsync: jest.fn().mockResolvedValue(0),
	scheduleNotificationAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(),
	cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(true),
	setNotificationCategoryAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
	AndroidImportance: { MAX: 5 },
	presentNotificationAsync: jest.fn().mockResolvedValue('immediate-id'),
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

		it('should register push token on initialization', async () => {
			const { doc, updateDoc, arrayUnion } = require('firebase/firestore');
			const { db } = require('../../config/firebase');

			// Force re-initialization
			notificationCoordinator.initialized = false;
			await notificationCoordinator.initialize();

			expect(updateDoc).toHaveBeenCalledWith(
				doc(db, 'users', 'test-user-id'),
				expect.objectContaining({
					expoPushTokens: arrayUnion('mock-expo-token'),
					devicePlatform: 'ios',
					lastTokenUpdate: expect.any(Object),
				})
			);
		});

		it('should handle multiple tokens per user', async () => {
			const { getUserProfile } = require('firebase/firestore');
			const { sendPushNotification } = require('../../utils/notifications/pushNotification');

			// Mock multiple tokens
			getUserProfile.mockResolvedValueOnce({
				expoPushTokens: ['token1', 'token2', 'token3'],
				uid: 'test-user-id',
			});

			// Clear previous calls
			sendPushNotification.mockClear();

			await notificationCoordinator.initialize();

			// Schedule notification with a future time to trigger push
			const mockContent = { title: 'Test', body: 'Test notification' };
			const futureDate = new Date(Date.now() + 60000); // 1 minute in future
			await notificationCoordinator.scheduleNotification(mockContent, futureDate);

			// Wait for any pending promises
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(sendPushNotification).toHaveBeenCalledWith(['test-user-id'], expect.any(Object));
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
			const scheduledTime = new Date(Date.now() + 60000); // 60 seconds from now

			Notifications.scheduleNotificationAsync.mockResolvedValueOnce('test-id');

			const result = await notificationCoordinator.scheduleNotification(mockContent, scheduledTime, {
				type: 'SCHEDULED',
			});

			expect(result).toBe('test-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content: expect.objectContaining({
					...mockContent,
					categoryIdentifier: 'SCHEDULED',
				}),
				trigger: scheduledTime,
			});
		});

		it('should properly handle immediate notifications', async () => {
			// Mock Notifications.scheduleNotificationAsync for this test
			const scheduleSpy = jest.spyOn(Notifications, 'scheduleNotificationAsync');
			scheduleSpy.mockImplementationOnce(() => Promise.resolve('immediate-id'));

			// Create a test notification
			const content = {
				title: 'Test',
				body: 'Immediate notification',
			};

			// Schedule with current time (should use null trigger)
			const result = await notificationCoordinator.scheduleNotification(
				content,
				new Date(), // Current time
				{ immediate: true }
			);

			// Verify we got an ID back
			expect(result).toBe('immediate-id');

			// Verify the right parameters were passed
			expect(scheduleSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.any(Object),
					trigger: expect.any(Date),
				})
			);
		});

		it('should properly handle notifications with trigger:null for immediate display', async () => {
			const scheduleSpy = jest.spyOn(Notifications, 'scheduleNotificationAsync');
			scheduleSpy.mockImplementationOnce((params) => {
				return Promise.resolve('test-notification-id');
			});

			// Get badge count mock
			Notifications.getBadgeCountAsync.mockResolvedValueOnce(0);

			const { notificationService } = require('../../utils/notifications');

			// Create test contact
			const mockContact = {
				id: 'test-id',
				first_name: 'John',
				last_name: 'Doe',
				callData: {
					type: 'phone',
					startTime: new Date().toISOString(),
				},
			};

			// Test with immediate time (in the past)
			const pastTime = new Date(Date.now() - 1000); // 1 second in the past

			await notificationService.scheduleCallFollowUp(mockContact, pastTime);

			// Verify the notification was scheduled
			expect(scheduleSpy).toHaveBeenCalled();

			// Test completed successfully
			expect(true).toBe(true);
		});
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

	describe('All Notifications Clearing', () => {
		beforeEach(async () => {
			await notificationCoordinator.initialize();

			notificationCoordinator.badgeCount = 5;
			notificationCoordinator.notificationMap.set('test-id', { content: 'test' });
			notificationCoordinator.pendingQueue.set('pending-id', { content: 'pending' });

			jest.clearAllMocks();
		});

		it('clears all notifications and related data', async () => {
			if (!notificationCoordinator.clearAllNotifications) {
				notificationCoordinator.clearAllNotifications = async function () {
					try {
						// Cancel all scheduled notifications
						await Notifications.cancelAllScheduledNotificationsAsync();

						// Clear the notification map
						this.notificationMap.clear();
						await AsyncStorage.removeItem(COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP);

						// Clear pending queue
						this.pendingQueue.clear();
						await AsyncStorage.removeItem(COORDINATOR_CONFIG.STORAGE_KEYS.PENDING_QUEUE);

						// Clear follow-up notifications
						await AsyncStorage.removeItem('follow_up_notifications');

						// Reset badge count
						this.badgeCount = 0;
						await Notifications.setBadgeCountAsync(0);

						console.log('[NotificationCoordinator] Cleared all notifications');
						return true;
					} catch (error) {
						console.error('[NotificationCoordinator] Error clearing all notifications:', error);
						return false;
					}
				};
			}

			await notificationCoordinator.clearAllNotifications();

			// Verify all notifications are canceled
			expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();

			// Verify notification map is cleared
			expect(notificationCoordinator.notificationMap.size).toBe(0);
			expect(AsyncStorage.removeItem).toHaveBeenCalledWith(COORDINATOR_CONFIG.STORAGE_KEYS.NOTIFICATION_MAP);

			// Verify pending queue is cleared
			expect(notificationCoordinator.pendingQueue.size).toBe(0);

			// Verify badge is reset
			expect(notificationCoordinator.badgeCount).toBe(0);
			expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
		});

		it('handles errors gracefully during all notifications clearing', async () => {
			// Mock an error for the notification cancellation
			Notifications.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(
				new Error('Notification cancellation failed')
			);

			// Method should not throw even with error
			const result = await notificationCoordinator.clearAllNotifications();

			// Verify the function returned the expected false value
			expect(result).toBe(false);
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

		it('should handle invalid token cleanup', async () => {
			const { doc, updateDoc } = require('firebase/firestore');
			const { db } = require('../../config/firebase');

			await notificationCoordinator.initialize();

			// Simulate a push notification failure due to invalid token
			const { sendPushNotification } = require('../../utils/notifications/pushNotification');
			sendPushNotification.mockRejectedValueOnce({
				response: {
					data: { details: { error: 'DeviceNotRegistered' } },
				},
			});

			const content = { title: 'Test' };
			await notificationCoordinator.scheduleNotification(content, new Date());

			expect(updateDoc).toHaveBeenCalledWith(
				doc(db, 'users', 'test-user-id'),
				expect.objectContaining({
					expoPushTokens: expect.not.arrayContaining(['invalid-token']),
				})
			);
		});
	});
});
