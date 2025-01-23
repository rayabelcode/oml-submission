// Mock Firebase
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
	where: jest.fn().mockReturnThis(),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
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
	scheduleNotificationAsync: jest
		.fn()
		.mockImplementation(() => Promise.resolve(`notification-${Math.random()}`)),
	cancelScheduledNotificationAsync: jest.fn(),
	setNotificationCategoryAsync: jest.fn(),
	getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-expo-token' }),
	AndroidImportance: { MAX: 5 },
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
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

// Mock reminderSync
jest.mock('../../utils/notifications/reminderSync', () => ({
	reminderSync: {
		start: jest.fn().mockResolvedValue(true),
		stop: jest.fn(),
		initialized: false,
	},
}));

import { notificationCoordinator } from '../../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Notification Grouping Tests', () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		notificationCoordinator.initialized = false;
		notificationCoordinator.notificationMap = new Map();
		notificationCoordinator.pendingQueue = new Map();
		await notificationCoordinator.initialize();
	});

	afterEach(() => {
		jest.clearAllTimers();
		notificationCoordinator.cleanup();
	});

	it('should group similar notifications', async () => {
		const notifications = await Promise.all([
			notificationCoordinator.scheduleNotification(
				{
					title: 'Group Test 1',
					body: 'Similar content',
					data: { groupId: 'test-group' },
				},
				{ seconds: 60 }
			),
			notificationCoordinator.scheduleNotification(
				{
					title: 'Group Test 2',
					body: 'Similar content',
					data: { groupId: 'test-group' },
				},
				{ seconds: 120 }
			),
		]);

		const uniqueGroups = new Set(
			Array.from(notificationCoordinator.notificationMap.values()).map((n) => n.content.data?.groupId)
		);
		expect(uniqueGroups.size).toBe(1);
		expect(notifications.length).toBe(2);
	}, 10000);

	it('should handle batch notification limits', async () => {
		const batchSize = 5;
		const notifications = Array(batchSize)
			.fill()
			.map((_, i) => ({
				title: `Batch Test ${i}`,
				body: 'Test notification',
				data: { batchId: 'test-batch' },
			}));

		const results = await Promise.all(
			notifications.map((n) => notificationCoordinator.scheduleNotification(n, { seconds: 60 }))
		);

		expect(results.length).toBe(batchSize);
		expect(notificationCoordinator.notificationMap.size).toBe(batchSize);
	}, 10000);

	it('should prioritize notifications correctly', async () => {
		const highPriority = await notificationCoordinator.scheduleNotification(
			{
				title: 'High Priority',
				body: 'Urgent notification',
				data: { priority: 'high' },
			},
			{ seconds: 60 }
		);

		const lowPriority = await notificationCoordinator.scheduleNotification(
			{
				title: 'Low Priority',
				body: 'Regular notification',
				data: { priority: 'low' },
			},
			{ seconds: 60 }
		);

		const notifications = Array.from(notificationCoordinator.notificationMap.values());
		const highPriorityNotification = notifications.find((n) => n.content.data?.priority === 'high');
		expect(highPriorityNotification).toBeTruthy();
	}, 10000);

	it('should send grouped notifications to multiple devices', async () => {
		const { getUserProfile } = require('firebase/firestore');

		// Mock user with multiple devices
		getUserProfile.mockResolvedValueOnce({
			expoPushTokens: ['device1', 'device2', 'device3'],
			uid: 'test-user-id',
		});

		const groupId = 'multi-device-group';
		const notifications = await Promise.all([
			notificationCoordinator.scheduleNotification(
				{
					title: 'Multi-device Test 1',
					body: 'Test content',
					data: { groupId },
				},
				{ seconds: 60 }
			),
			notificationCoordinator.scheduleNotification(
				{
					title: 'Multi-device Test 2',
					body: 'Test content',
					data: { groupId },
				},
				{ seconds: 120 }
			),
		]);

		const storedNotifications = Array.from(notificationCoordinator.notificationMap.values());
		expect(storedNotifications.length).toBe(2);
		expect(storedNotifications.every((n) => n.content.data?.groupId === groupId)).toBe(true);
	});

	it('should handle token updates within groups', async () => {
		const { doc, updateDoc, arrayUnion } = require('firebase/firestore');
		const { db } = require('../../config/firebase');

		// Reset coordinator state
		notificationCoordinator.initialized = false;

		// Create a mock document reference and setup mocks
		const userDocRef = { id: 'test-user-id' };
		doc.mockReturnValue(userDocRef);

		// Clear previous calls
		updateDoc.mockClear();

		// Trigger initial token registration
		await notificationCoordinator.initialize();

		// Schedule grouped notifications
		await Promise.all([
			notificationCoordinator.scheduleNotification(
				{
					title: 'Token Update Test 1',
					body: 'Test content',
					data: { groupId: 'token-test' },
				},
				{ seconds: 60 }
			),
			notificationCoordinator.scheduleNotification(
				{
					title: 'Token Update Test 2',
					body: 'Test content',
					data: { groupId: 'token-test' },
				},
				{ seconds: 120 }
			),
		]);

		// Simulate app state change to trigger token update
		await notificationCoordinator.handleAppStateChange('background');
		await notificationCoordinator.handleAppStateChange('active');

		// Verify token update was called
		expect(updateDoc).toHaveBeenCalledWith(
			userDocRef,
			expect.objectContaining({
				expoPushTokens: arrayUnion('mock-expo-token'),
				devicePlatform: 'ios',
				lastTokenUpdate: expect.any(Object),
			})
		);
	});

	it('should respect device limit in groups', async () => {
		const { getUserProfile } = require('firebase/firestore');

		// Mock user with maximum devices
		const maxTokens = Array(20)
			.fill()
			.map((_, i) => `device-${i}`);
		getUserProfile.mockResolvedValueOnce({
			expoPushTokens: maxTokens,
			uid: 'test-user-id',
		});

		const notification = await notificationCoordinator.scheduleNotification(
			{
				title: 'Device Limit Test',
				body: 'Test content',
				data: { groupId: 'limit-test' },
			},
			{ seconds: 60 }
		);

		expect(notification).toBeTruthy();
		const stored = notificationCoordinator.notificationMap.get(notification);
		expect(stored).toBeTruthy();
	});
});
