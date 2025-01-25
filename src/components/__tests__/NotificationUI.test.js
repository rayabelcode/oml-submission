// Mock dependencies first
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(),
	persistentMultipleTabManager: jest.fn(),
	getDoc: jest.fn().mockImplementation(() => ({
		exists: () => true,
		data: () => ({
			scheduling_preferences: {
				timezone: 'America/New_York',
				minimumGapMinutes: 30,
				optimalGapMinutes: 120,
			},
			expoPushTokens: ['device1', 'device2', 'device3'],
			uid: 'test-user-id',
		}),
	})),
	setDoc: jest.fn(),
	updateDoc: jest.fn(),
	doc: jest.fn(),
	serverTimestamp: jest.fn(),
	arrayUnion: jest.fn((token) => ['mock-token-1', 'mock-token-2', token]),
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	onSnapshot: jest.fn(() => jest.fn()),
	getUserProfile: jest.fn().mockImplementation(() =>
		Promise.resolve({
			expoPushTokens: ['device1', 'device2', 'device3'],
			uid: 'test-user-id',
		})
	),
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
	scheduleNotificationAsync: jest.fn().mockImplementation(() => Promise.resolve('test-notification-id')),
	cancelScheduledNotificationAsync: jest.fn(),
	setNotificationCategoryAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
	AndroidImportance: { MAX: 5 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}));

const mockSendPushNotification = jest.fn().mockResolvedValue(true);
const mockScheduleLocalNotificationWithPush = jest.fn().mockResolvedValue('test-id');

jest.mock('../../utils/notifications/pushNotification', () => {
	return {
		sendPushNotification: jest.fn(async (users, notification) => true),
		scheduleLocalNotificationWithPush: jest.fn(async () => 'test-id'),
	};
});

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
	REMINDER_STATUS: {
		PENDING: 'PENDING',
		COMPLETED: 'COMPLETED',
		SNOOZED: 'SNOOZED',
		SKIPPED: 'SKIPPED',
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

	describe('Multi-Device Notification Tests', () => {
		const { sendPushNotification } = require('../../utils/notifications/pushNotification');

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('should schedule notifications for all registered devices', async () => {
			const notification = {
				title: 'Multi-device Test',
				body: 'Should reach all devices',
				data: { type: 'SCHEDULED' },
			};

			const notificationId = await notificationCoordinator.scheduleNotification(
				notification,
				new Date(Date.now() + 60000)
			);

			await new Promise((resolve) => setImmediate(resolve));

			expect(notificationId).toBe('test-notification-id');
			expect(sendPushNotification).toHaveBeenCalledWith(
				['test-user'],
				expect.objectContaining({
					title: notification.title,
					body: notification.body,
					data: expect.any(Object),
				})
			);
			expect(notificationCoordinator.notificationMap.has(notificationId)).toBe(true);
		});

		it('should schedule notification with device token', async () => {
			const notificationId = await notificationCoordinator.scheduleNotification(
				{
					title: 'Device Test',
					body: 'Test notification',
					data: {
						type: 'SCHEDULED',
						deviceToken: 'mock-token-1',
					},
				},
				new Date(Date.now() + 60000)
			);

			expect(notificationId).toBe('test-notification-id');
			expect(notificationCoordinator.notificationMap.has(notificationId)).toBe(true);
			expect(notificationCoordinator.notificationMap.get(notificationId).content.data.deviceToken).toBe(
				'mock-token-1'
			);
		});

		it('should respect device limit when scheduling notifications', async () => {
			const maxDevices = Array(20)
				.fill()
				.map((_, i) => `device-${i}`);
			const { getUserProfile } = require('firebase/firestore');

			getUserProfile.mockImplementationOnce(() =>
				Promise.resolve({
					expoPushTokens: maxDevices,
					uid: 'test-user-id',
				})
			);

			const notificationId = await notificationCoordinator.scheduleNotification(
				{
					title: 'Device Limit Test',
					body: 'Test notification',
					data: { type: 'SCHEDULED' },
				},
				{ seconds: 60 }
			);

			expect(notificationId).toBe('test-notification-id');
			expect(notificationCoordinator.notificationMap.has(notificationId)).toBe(true);
		});
	});

	it('should create recurring notification with correct schedule', async () => {
		const notificationId = 'recurring-test';
		Notifications.scheduleNotificationAsync.mockResolvedValueOnce(notificationId);

		const scheduledTime = new Date(Date.now() + 86400000);
		const recurringNotification = await notificationCoordinator.scheduleNotification(
			{
				title: 'Recurring Test',
				body: 'Daily reminder',
				data: { recurring: true },
			},
			scheduledTime
		);

		expect(recurringNotification).toBe(notificationId);
		expect(notificationCoordinator.notificationMap.get(notificationId).scheduledTime).toEqual(scheduledTime);
	});

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
