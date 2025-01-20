import {
	sendPushNotification,
	scheduleLocalNotificationWithPush,
	_internal,
} from '../../utils/notifications/pushNotification';
import * as Notifications from 'expo-notifications';
import { ERROR_HANDLING } from '../../../constants/notificationConstants';

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
		jest.useFakeTimers();
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data: [] }),
		});
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
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

			const resultPromise = sendPushNotification(['user1', 'user2'], notification);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Object),
					body: expect.stringContaining('ExponentPushToken[test]'),
				})
			);
		}, 10000);

		it('should handle invalid tokens gracefully', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'invalid-token' }),
			});

			global.fetch.mockRejectedValueOnce(new Error('InvalidToken'));

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const resultPromise = sendPushNotification(['user1'], notification);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBeFalsy();
			expect(console.error).toHaveBeenCalled();
		}, 10000);

		it('should filter out null tokens', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: null }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const resultPromise = sendPushNotification(['user1'], notification);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBeTruthy();
			expect(global.fetch).not.toHaveBeenCalled();
			expect(getDoc).toHaveBeenCalled();
		}, 10000);

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
			const resultPromise = sendPushNotification(userIds, notification);
			jest.runAllTimers();
			const result = await resultPromise;
			const endTime = Date.now();

			expect(result).toBeTruthy();
			expect(endTime - startTime).toBeLessThan(1000);
			expect(fetch).toHaveBeenCalledTimes(1);
		}, 10000);

		it('should retry on network errors with exponential backoff', async () => {
			// Mock the delay function
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			_internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch
				.mockRejectedValueOnce(new Error('network error'))
				.mockRejectedValueOnce(new Error('network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ data: [] }),
				});

			const notification = { title: 'Test', body: 'Test' };
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledTimes(3);
			expect(mockDelay).toHaveBeenCalledTimes(2); // Called twice for two retries

			// Verify exponential backoff
			expect(mockDelay.mock.calls[0][0]).toBeLessThan(mockDelay.mock.calls[1][0]);
		}, 1000);

		it('should handle failed tokens in response', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								status: 'error',
								message: 'InvalidToken',
								token: 'ExponentPushToken[test]',
							},
						],
					}),
			});

			const notification = { title: 'Test', body: 'Test' };
			const resultPromise = sendPushNotification(['user1'], notification);
			jest.runAllTimers();
			await resultPromise;

			expect(global.fetch).toHaveBeenCalledTimes(1);
			expect(require('firebase/firestore').updateDoc).toHaveBeenCalled();
		}, 10000);

		it('should stop retrying after max attempts', async () => {
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			_internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch.mockRejectedValue(new Error('network error'));

			const notification = { title: 'Test', body: 'Test' };
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeFalsy();
			// Initial attempt + MAX_ATTEMPTS retries
			expect(fetch).toHaveBeenCalledTimes(ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS + 1);
			// Called only during retries, so MAX_ATTEMPTS times
			expect(mockDelay).toHaveBeenCalledTimes(ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS);
		});

		it('should handle rate limiting errors with backoff', async () => {
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			_internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch.mockRejectedValueOnce(new Error('rate limit exceeded')).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledTimes(2);
			expect(mockDelay).toHaveBeenCalledTimes(1);
		});

		it('should handle malformed server responses', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ malformed: 'response' }), // Missing data field
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy(); // Should succeed even with malformed response
			expect(fetch).toHaveBeenCalledTimes(1);
		});

		it('should handle concurrent notification requests', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const promises = Array(5)
				.fill()
				.map(() => sendPushNotification(['user1'], notification));

			const results = await Promise.all(promises);
			expect(results.every((result) => result === true)).toBeTruthy();
			expect(fetch).toHaveBeenCalledTimes(5);
		});

		it('should handle empty notification data gracefully', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			const notification = {}; // Empty notification
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Object),
					body: expect.stringContaining('"to":"ExponentPushToken[test]"'),
				})
			);

			// Verify the body structure
			const body = JSON.parse(fetch.mock.calls[0][1].body);
			expect(body).toEqual([
				expect.objectContaining({
					to: 'ExponentPushToken[test]',
					sound: 'default',
					data: {},
					badge: 1,
					_displayInForeground: true,
					// title and body should be omitted since they're undefined
				}),
			]);
		});

		it('should handle server errors with different status codes', async () => {
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			_internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushToken: 'ExponentPushToken[test]' }),
			});

			global.fetch
				.mockResolvedValueOnce({ ok: false, status: 502 }) // Bad Gateway
				.mockResolvedValueOnce({ ok: false, status: 503 }) // Service Unavailable
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ data: [] }),
				});

			const notification = { title: 'Test', body: 'Test' };
			const result = await sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(fetch).toHaveBeenCalledTimes(3);
			expect(mockDelay).toHaveBeenCalledTimes(2);
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

			const resultPromise = scheduleLocalNotificationWithPush('user1', content, trigger);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content,
				trigger,
			});
			expect(fetch).toHaveBeenCalled();
		}, 10000);

		it('should only schedule local notification for immediate events', async () => {
			const content = {
				title: 'Test Notification',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const trigger = {
				seconds: 0,
			};

			const resultPromise = scheduleLocalNotificationWithPush('user1', content, trigger);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
			expect(fetch).not.toHaveBeenCalled();
		}, 10000);

		it('should handle scheduling errors', async () => {
			Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Scheduling failed'));

			const content = {
				title: 'Test Notification',
				body: 'Test Body',
			};

			const trigger = {
				seconds: 3600,
			};

			const resultPromise = scheduleLocalNotificationWithPush('user1', content, trigger);
			jest.runAllTimers();

			await expect(resultPromise).rejects.toThrow('Scheduling failed');
			expect(console.error).toHaveBeenCalled();
		}, 10000);

		it('should handle timezone-sensitive scheduling', async () => {
			const content = {
				title: 'Test Notification',
				body: 'Test Body',
			};

			const trigger = {
				seconds: 3600,
			};

			const resultPromise = scheduleLocalNotificationWithPush('user1', content, trigger);
			jest.runAllTimers();
			const result = await resultPromise;

			expect(result).toBeDefined();
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					trigger: expect.objectContaining({
						seconds: 3600,
					}),
				})
			);
		}, 10000);
	});
});
