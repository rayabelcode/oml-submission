// Mock dependencies first
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
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn(() => {
		return () => {};
	}),
	fetch: jest.fn().mockResolvedValue({
		isConnected: true,
		isInternetReachable: true,
		type: 'wifi',
	}),
}));

jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: { uid: 'test-user' },
	},
	db: {},
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

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));

jest.mock('../../utils/notifications/pushNotification', () => ({
	sendPushNotification: jest.fn().mockResolvedValue(true),
	scheduleLocalNotificationWithPush: jest.fn().mockResolvedValue('test-id'),
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
	ERROR_HANDLING,
	IOS_CONFIGS: {
		NOTIFICATION_SETTINGS: {
			FOREGROUND: {
				alert: true,
				badge: true,
				sound: true,
			},
			CATEGORIES: {
				SCHEDULED: { identifier: 'SCHEDULED' },
				FOLLOW_UP: { identifier: 'FOLLOW_UP' },
			},
		},
	},
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationCoordinator } from '../../utils/notificationCoordinator';

describe('Notification UI Integration Tests', () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		Platform.OS = 'ios';

		// Reset coordinator state
		notificationCoordinator.initialized = false;
		notificationCoordinator.badgeCount = 0;
		notificationCoordinator.notificationMap = new Map();
		notificationCoordinator.pendingQueue = new Map();

		AsyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
		AsyncStorage.setItem.mockImplementation(() => Promise.resolve());

		// Initialize coordinator
		await notificationCoordinator.initialize();
	});

	afterEach(async () => {
		await notificationCoordinator.cleanup();
	});

	it('should create recurring notification with correct schedule', async () => {
		const notificationId = 'recurring-test';
		Notifications.scheduleNotificationAsync.mockResolvedValueOnce(notificationId);

		const recurringNotification = await notificationCoordinator.scheduleNotification(
			{
				title: 'Recurring Test',
				body: 'Daily reminder',
				data: { recurring: true },
			},
			{
				seconds: 86400, // 24 hours
				repeats: true,
			}
		);

		expect(recurringNotification).toBe(notificationId);
		expect(notificationCoordinator.notificationMap.get(notificationId).trigger.repeats).toBe(true);
	}, 10000);

	it('should update existing recurring notification', async () => {
		const originalId = 'original-recurring';
		Notifications.scheduleNotificationAsync.mockResolvedValueOnce(originalId);

		await notificationCoordinator.scheduleNotification(
			{
				title: 'Original Recurring',
				body: 'Initial schedule',
				data: { recurring: true },
			},
			{ seconds: 86400, repeats: true }
		);

		const updatedId = 'updated-recurring';
		Notifications.scheduleNotificationAsync.mockResolvedValueOnce(updatedId);

		const updateResult = await notificationCoordinator.scheduleNotification(
			{
				title: 'Updated Recurring',
				body: 'New schedule',
				data: { recurring: true },
			},
			{ seconds: 43200, repeats: true },
			{ replaceId: originalId }
		);

		expect(updateResult).toBe(updatedId);
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(originalId);
	}, 10000);

	it('should handle notification interaction response', async () => {
		const notificationId = 'interactive-test';
		Notifications.scheduleNotificationAsync.mockResolvedValueOnce(notificationId);

		await notificationCoordinator.scheduleNotification(
			{
				title: 'Interactive Test',
				body: 'Test actions',
				data: { type: 'SCHEDULED' },
			},
			{ seconds: 60 }
		);

		const response = {
			notification: {
				request: {
					identifier: notificationId,
					content: {
						data: { type: 'SCHEDULED' },
					},
				},
			},
			actionIdentifier: 'snooze',
		};

		expect(notificationCoordinator.notificationMap.has(notificationId)).toBeTruthy();
	}, 10000);
});
