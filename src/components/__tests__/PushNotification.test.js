import {
	sendPushNotification,
	scheduleLocalNotificationWithPush,
} from '../../utils/notifications/pushNotification';
import * as Notifications from 'expo-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn().mockResolvedValue('local-notification-id'),
}));

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn().mockResolvedValue({}),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock console.error to suppress error messages in tests
const originalError = console.error;
beforeAll(() => {
	console.error = jest.fn();
});

afterAll(() => {
	console.error = originalError;
});

describe('Push Notification System', () => {
	const { getDoc } = require('firebase/firestore');
	const NetInfo = require('@react-native-community/netinfo');

	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn().mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('sendPushNotification', () => {
		it('should send push notifications to valid tokens', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const result = await sendPushNotification(['user1', 'user2'], notification);

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Object),
					body: expect.stringContaining('ExponentPushToken[test]'),
				})
			);
		});

		it('should handle invalid tokens gracefully', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'invalid-token' }),
			});

			global.fetch.mockRejectedValueOnce(new Error('InvalidToken'));

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const result = await sendPushNotification(['user1'], notification);
			expect(result).toBeFalsy();
			expect(console.error).toHaveBeenCalled();
		});

		it('should filter out null tokens', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: null }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).not.toHaveBeenCalled();
			expect(getDoc).toHaveBeenCalled();
		});

		it('should handle batch notifications efficiently', async () => {
			const userIds = Array.from({ length: 100 }, (_, i) => `user${i}`);
			getDoc.mockImplementation(() => ({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			}));

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const startTime = Date.now();
			const result = await sendPushNotification(userIds, notification);
			const endTime = Date.now();

			expect(result).toBeTruthy();
			expect(endTime - startTime).toBeLessThan(1000);
			expect(fetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('scheduleLocalNotificationWithPush', () => {
		it('should schedule both local and push notifications for future events', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			const content = {
				title: 'Test Notification',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const trigger = {
				seconds: 3600,
			};

			const localNotificationId = await scheduleLocalNotificationWithPush('user1', content, trigger);

			expect(localNotificationId).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content,
				trigger,
			});
			expect(fetch).toHaveBeenCalled();
		});

		it('should only schedule local notification for immediate events', async () => {
			const content = {
				title: 'Test Notification',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const trigger = {
				seconds: 0,
			};

			const localNotificationId = await scheduleLocalNotificationWithPush('user1', content, trigger);

			expect(localNotificationId).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
			expect(fetch).not.toHaveBeenCalled();
		});

		it('should handle scheduling errors', async () => {
			Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Scheduling failed'));

			const content = {
				title: 'Test Notification',
				body: 'Test Body',
			};

			const trigger = {
				seconds: 3600,
			};

			await expect(scheduleLocalNotificationWithPush('user1', content, trigger)).rejects.toThrow(
				'Scheduling failed'
			);
			expect(console.error).toHaveBeenCalled();
		});

		it('should handle timezone-sensitive scheduling', async () => {
			const originalDate = new Date('2024-01-01T10:00:00Z');
			jest.setSystemTime(originalDate);

			const content = {
				title: 'Test Notification',
				body: 'Test Body',
			};

			const trigger = {
				seconds: 3600,
			};

			const result = await scheduleLocalNotificationWithPush('user1', content, trigger);
			expect(result).toBeDefined();
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					trigger: expect.objectContaining({
						seconds: 3600,
					}),
				})
			);

			jest.setSystemTime(new Date());
		});
	});
});
