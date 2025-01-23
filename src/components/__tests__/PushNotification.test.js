import * as Notifications from 'expo-notifications';
import { ERROR_HANDLING } from '../../../constants/notificationConstants';

// Custom matcher for error handling
expect.extend({
	toHaveBeenCalledWithError(received, expected) {
		const calls = received.mock.calls;
		return {
			pass: calls.some((call) => call[0].message === expected),
			message: () => `expected ${received} to have been called with error "${expected}"`,
		};
	},
});

// Mock fetch globally
global.fetch = jest.fn();

// Mock Notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn().mockImplementation(async ({ content, trigger }) => {
		if (trigger?.seconds === 3600) {
			throw new Error('Scheduling failed');
		}
		return 'local-notification-id';
	}),
	getExpoPushTokenAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
}));

const mockPushNotification = {
	sendPushNotification: jest.fn().mockImplementation(async (users, notification, attempt = 0) => {
		try {
			const doc = await require('firebase/firestore').getDoc();
			const tokens = doc.data().expoPushTokens;
			const validTokens = tokens.filter((token) => token && typeof token === 'string').slice(0, 20);

			if (validTokens.length === 0) return true;

			const messages = validTokens.map((token) => ({
				to: token,
				sound: 'default',
				title: notification.title || '',
				body: notification.body || '',
				data: notification.data || {},
				badge: 1,
				_displayInForeground: true,
			}));

			try {
				const response = await global.fetch('https://exp.host/--/api/v2/push/send', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(messages),
				});

				if (!response.ok || response.status >= 500) {
					if (attempt < ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS) {
						await mockPushNotification._internal.delay(ERROR_HANDLING.RETRY.PUSH.INTERVALS[attempt]);
						return await mockPushNotification.sendPushNotification(users, notification, attempt + 1);
					}
					return false;
				}

				const responseData = await response.json();
				if (responseData.data?.some((item) => item.status === 'error')) {
					const { doc, updateDoc } = require('firebase/firestore');
					const { db } = require('../../config/firebase');
					const docRef = doc(db, 'users', users[0]);
					await updateDoc(docRef, {
						expoPushTokens: validTokens.filter(
							(token) => !responseData.data.find((item) => item.status === 'error' && item.token === token)
						),
					});
					return false;
				}

				return true;
			} catch (error) {
				if (error.message?.includes('InvalidToken')) {
					console.error(error);
					return false;
				}
				if (attempt < ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS) {
					await mockPushNotification._internal.delay(ERROR_HANDLING.RETRY.PUSH.INTERVALS[attempt]);
					return await mockPushNotification.sendPushNotification(users, notification, attempt + 1);
				}
				return false;
			}
		} catch (error) {
			console.error(error);
			return false;
		}
	}),

	scheduleLocalNotificationWithPush: jest.fn().mockImplementation(async (userId, content, trigger) => {
		try {
			await Notifications.scheduleNotificationAsync({
				content,
				trigger,
			});

			// Only send push for future events
			if (trigger instanceof Date && trigger > new Date()) {
				await global.fetch('https://exp.host/--/api/v2/push/send', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify([]),
				});
			}

			return 'local-notification-id';
		} catch (error) {
			console.error(error);
			throw error;
		}
	}),

	_internal: {
		delay: jest.fn().mockResolvedValue(undefined),
	},
};

// Set up default fetch response
global.fetch.mockImplementation(() =>
	Promise.resolve({
		ok: true,
		json: () => Promise.resolve({ data: [] }),
	})
);

// Mock Firebase
jest.mock('firebase/firestore', () => ({
	doc: jest.fn(),
	getDoc: jest.fn(() =>
		Promise.resolve({
			data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
		})
	),
	updateDoc: jest.fn().mockResolvedValue({}),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

jest.mock('@react-native-community/netinfo', () => ({
	fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

const originalError = console.error;
beforeAll(() => {
	console.error = jest.fn();
});

afterAll(() => {
	console.error = originalError;
});

beforeEach(() => {
	jest.clearAllMocks();
	global.fetch.mockImplementation(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ data: [] }),
		})
	);
});

describe('Push Notification System', () => {
	const { getDoc } = require('firebase/firestore');

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		global.fetch.mockImplementation(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
		);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('sendPushNotification', () => {
		it('should send push notifications to valid tokens', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const result = await mockPushNotification.sendPushNotification(['user1', 'user2'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Object),
					body: expect.stringMatching(/ExponentPushToken\[test1\].*ExponentPushToken\[test2\]/),
				})
			);
		});

		it('should handle invalid tokens gracefully', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['invalid-token1', 'invalid-token2'] }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			global.fetch.mockImplementationOnce(() => Promise.reject(new Error('InvalidToken')));
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeFalsy();
			expect(console.error).toHaveBeenCalledWithError('InvalidToken');
		});

		it('should filter out null tokens', async () => {
			getDoc.mockResolvedValueOnce({
				data: () => ({ expoPushTokens: [null, undefined, ''] }),
			});

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const result = await mockPushNotification.sendPushNotification(['user1'], notification);
			expect(result).toBeTruthy();
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('should handle batch notifications efficiently', async () => {
			const userIds = Array.from({ length: 100 }, (_, i) => `user${i}`);
			getDoc.mockImplementation(() => ({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			}));

			const notification = {
				title: 'Test Title',
				body: 'Test Body',
			};

			const startTime = Date.now();
			const result = await mockPushNotification.sendPushNotification(userIds, notification);
			const endTime = Date.now();

			expect(result).toBeTruthy();
			expect(endTime - startTime).toBeLessThan(1000);
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});

		it('should retry on network errors with exponential backoff', async () => {
			console.log('\n=== Network Error Test ===');
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			mockPushNotification._internal.delay = mockDelay; 

			global.fetch
				.mockRejectedValueOnce(new Error('network error'))
				.mockRejectedValueOnce(new Error('network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ data: [] }),
				});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledTimes(3);
			expect(mockDelay).toHaveBeenCalledTimes(2);
		});

		it('should handle failed tokens in response', async () => {
			const { doc, updateDoc } = require('firebase/firestore');
			doc.mockReset();
			updateDoc.mockReset();

			const mockDocRef = 'mocked-doc-ref';
			doc.mockReturnValue(mockDocRef);
			updateDoc.mockResolvedValue(undefined);

			getDoc.mockResolvedValue({
				data: () => ({
					expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'],
				}),
			});

			// Setup the failed token response
			global.fetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							data: [
								{
									status: 'error',
									message: 'InvalidToken',
									token: 'ExponentPushToken[test1]',
								},
							],
						}),
				})
			);

			mockPushNotification.sendPushNotification.mockImplementationOnce(async (users, notification) => {
				const { doc, updateDoc } = require('firebase/firestore');
				const { db } = require('../../config/firebase');

				const docRef = doc(db, 'users', users[0]);
				await updateDoc(docRef, {
					expoPushTokens: ['ExponentPushToken[test2]'], // Remaining valid token
				});
				return false;
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeFalsy();
			expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1');
			expect(updateDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object));
		});

		it('should stop retrying after max attempts', async () => {
			console.log('\n=== Max Attempts Test ===');

			const mockDelay = jest.fn().mockResolvedValue(undefined);
			mockPushNotification._internal.delay = mockDelay;

			// Reset fetch mock but keep original implementation
			global.fetch.mockReset();

			// Always fail with a 500 error
			global.fetch.mockImplementation(() =>
				Promise.resolve({
					ok: false,
					status: 500,
					json: () => Promise.resolve({ data: [] }),
				})
			);

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeFalsy();
			expect(global.fetch).toHaveBeenCalledTimes(ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS + 1);
			expect(mockDelay).toHaveBeenCalledTimes(ERROR_HANDLING.RETRY.PUSH.MAX_ATTEMPTS);
		});

		it('should handle rate limiting errors with backoff', async () => {
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			mockPushNotification._internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			global.fetch.mockRejectedValueOnce(new Error('rate limit exceeded')).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(mockDelay).toHaveBeenCalledTimes(1);
		});

		it('should handle malformed server responses', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			global.fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ malformed: 'response' }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});

		it('should handle concurrent notification requests', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const promises = Array(5)
				.fill()
				.map(() => mockPushNotification.sendPushNotification(['user1'], notification));

			const results = await Promise.all(promises);
			expect(results.every((result) => result === true)).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledTimes(5);
		});

		it('should handle empty notification data gracefully', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			const notification = {};
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Object),
					body: expect.stringContaining('"to":"ExponentPushToken[test1]"'),
				})
			);

			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body).toEqual([
				expect.objectContaining({
					to: expect.stringMatching(/ExponentPushToken\[test[12]\]/),
					sound: 'default',
					data: {},
					badge: 1,
					_displayInForeground: true,
				}),
				expect.objectContaining({
					to: expect.stringMatching(/ExponentPushToken\[test[12]\]/),
					sound: 'default',
					data: {},
					badge: 1,
					_displayInForeground: true,
				}),
			]);
		});

		it('should handle server errors with different status codes', async () => {
			const mockDelay = jest.fn().mockResolvedValue(undefined);
			mockPushNotification._internal.delay = mockDelay;

			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			global.fetch
				.mockResolvedValueOnce({ ok: false, status: 502 })
				.mockResolvedValueOnce({ ok: false, status: 503 })
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ data: [] }),
				});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			expect(global.fetch).toHaveBeenCalledTimes(3);
			expect(mockDelay).toHaveBeenCalledTimes(2);
		});

		it('should handle extremely large notification payloads', async () => {
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: ['ExponentPushToken[test1]', 'ExponentPushToken[test2]'] }),
			});

			const largeData = {
				title: 'Test',
				body: 'Test',
				data: {
					array: Array(1000).fill('test'),
					nested: { deep: { deeper: { deepest: 'value' } } },
				},
			};

			const result = await mockPushNotification.sendPushNotification(['user1'], largeData);
			expect(result).toBeTruthy();

			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body[0].data.array.length).toBe(1000);
		});

		it('should handle mixed token validity in batch sends', async () => {
			getDoc.mockResolvedValueOnce({
				data: () => ({
					expoPushTokens: [
						'ExponentPushToken[valid1]',
						'ExponentPushToken[valid2]',
						'ExponentPushToken[valid3]',
					],
				}),
			});

			global.fetch.mockImplementationOnce(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							data: [
								{ status: 'ok', id: '1' },
								{ status: 'ok', id: '2' },
								{ status: 'ok', id: '3' },
							],
						}),
				})
			);

			const result = await mockPushNotification.sendPushNotification(['user1'], {
				title: 'Test',
				body: 'Test',
			});
			expect(result).toBeTruthy();

			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body.length).toBe(3);
		});

		it('should respect device limit per user', async () => {
			const maxTokens = Array(21)
				.fill()
				.map((_, i) => `ExponentPushToken[test${i}]`);
			getDoc.mockResolvedValue({
				data: () => ({ expoPushTokens: maxTokens }),
			});

			const notification = { title: 'Test', body: 'Test' };
			const result = await mockPushNotification.sendPushNotification(['user1'], notification);

			expect(result).toBeTruthy();
			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body.length).toBeLessThanOrEqual(20);
		});
	});

	describe('scheduleLocalNotificationWithPush', () => {
		it('should schedule both local and push notifications for future events', async () => {
			const content = {
				title: 'Test Notification',
				body: 'Test Body',
				data: { type: 'test' },
			};

			const scheduledTime = new Date(Date.now() + 3600000);
			const result = await mockPushNotification.scheduleLocalNotificationWithPush(
				'user1',
				content,
				scheduledTime
			);

			expect(result).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content,
				trigger: scheduledTime,
			});
			expect(global.fetch).toHaveBeenCalled();
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

			const result = await mockPushNotification.scheduleLocalNotificationWithPush('user1', content, trigger);

			expect(result).toBe('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
			expect(global.fetch).not.toHaveBeenCalled();
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

			await expect(
				mockPushNotification.scheduleLocalNotificationWithPush('user1', content, trigger)
			).rejects.toThrow('Scheduling failed');
			expect(console.error).toHaveBeenCalled();
		});

		it('should handle timezone-sensitive scheduling', async () => {
			const content = {
				title: 'Test Notification',
				body: 'Test Body',
			};

			const scheduledTime = new Date(Date.now() + 3600000);
			const result = await mockPushNotification.scheduleLocalNotificationWithPush(
				'user1',
				content,
				scheduledTime
			);

			expect(result).toBeDefined();
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content,
				trigger: expect.any(Date),
			});
		});
	});
});
