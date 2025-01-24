import * as Notifications from 'expo-notifications';
import { DateTime } from 'luxon';
import { reminderSync } from '../../utils/notifications/reminderSync';
import { getUserPreferences } from '../../utils/preferences';
import { collection, onSnapshot, query, where, REMINDER_STATUS, REMINDER_TYPES } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn((notification) => Promise.resolve('test-notification-id')),
	cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
	getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

// Mock getUserPreferences
jest.mock('../../utils/preferences', () => ({
	getUserPreferences: jest.fn().mockResolvedValue({
		timezone: 'America/New_York',
		scheduling_preferences: {
			minimumGapMinutes: 30,
			optimalGapMinutes: 120,
			timezone: 'America/New_York',
		},
	}),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

// Mock firebase/firestore
jest.mock('firebase/firestore', () => {
	const mockOnSnapshot = jest.fn();
	const mockCollection = jest.fn();
	const mockQuery = jest.fn();
	const mockWhere = jest.fn();
	const mockDoc = jest.fn();
	const mockGetDoc = jest.fn();

	class Timestamp {
		constructor(seconds, nanoseconds) {
			this.seconds = seconds;
			this.nanoseconds = nanoseconds;
		}

		toDate() {
			return new Date(this.seconds * 1000);
		}

		static now() {
			const now = Date.now();
			return new Timestamp(Math.floor(now / 1000), (now % 1000) * 1000000);
		}

		static fromDate(date) {
			const timestamp = new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
			return timestamp;
		}
	}

	return {
		collection: mockCollection,
		query: mockQuery,
		where: mockWhere,
		onSnapshot: mockOnSnapshot,
		doc: mockDoc,
		getDoc: mockGetDoc,
		Timestamp,
		REMINDER_STATUS: {
			PENDING: 'pending',
		},
		REMINDER_TYPES: {
			SCHEDULED: 'SCHEDULED',
		},
	};
});

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
		onAuthStateChanged: (callback) => {
			callback({ uid: 'test-user' });
			return () => {};
		},
	},
}));

describe('Reminder Sync System', () => {
	const testUserId = 'test-user';
	const testContactId = 'test-contact';
	let onSnapshotCallback;

	beforeEach(async () => {
		jest.clearAllMocks();

		// Setup snapshot listener mock
		onSnapshot.mockImplementation((query, callback) => {
			onSnapshotCallback = callback;
			return () => {};
		});

		// Initialize reminderSync and wait for it to complete
		await reminderSync.start();

		// Verify query setup
		expect(collection).toHaveBeenCalled();
		expect(query).toHaveBeenCalled();
		expect(where).toHaveBeenCalledWith('user_id', '==', testUserId);
		expect(where).toHaveBeenCalledWith('status', '==', REMINDER_STATUS.PENDING);
		expect(onSnapshot).toHaveBeenCalled();
	});

	afterEach(() => {
		reminderSync.stop();
	});

	describe('Firestore to Local Notification Sync', () => {
		it('should schedule local notification when reminder is added to Firestore', async () => {
			const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now
			const newReminder = {
				id: 'test-reminder',
				contact_id: testContactId,
				user_id: testUserId,
				type: REMINDER_TYPES.SCHEDULED,
				status: REMINDER_STATUS.PENDING,
				scheduledTime,
				title: 'Test Reminder',
				body: 'This is a test reminder',
			};

			// Simulate Firestore snapshot update
			await new Promise((resolve) => {
				onSnapshotCallback({
					docChanges: () => [
						{
							type: 'added',
							doc: {
								id: newReminder.id,
								data: () => newReminder,
							},
						},
					],
				});
				setTimeout(resolve, 0);
			});

			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content: {
					title: newReminder.title,
					body: newReminder.body,
					data: {
						reminderId: newReminder.id,
						contactId: testContactId,
						type: REMINDER_TYPES.SCHEDULED,
						scheduledTimezone: 'America/New_York',
						originalTime: scheduledTime.toISOString(),
					},
				},
				trigger: scheduledTime,
			});
		});

		it('should cancel local notification when reminder is deleted from Firestore', async () => {
			const reminderId = 'test-reminder';

			// Setup existing notification in the Map
			reminderSync.localNotifications.set(reminderId, 'local-notification-id');

			// Simulate Firestore deletion
			await new Promise((resolve) => {
				onSnapshotCallback({
					docChanges: () => [
						{
							type: 'removed',
							doc: {
								id: reminderId,
								data: () => ({}),
							},
						},
					],
				});
				setTimeout(resolve, 0);
			});

			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('local-notification-id');
		});

		it('should update local notification when reminder is modified in Firestore', async () => {
			const reminderId = 'test-reminder';
			const scheduledTime = new Date(Date.now() + 7200000); // 2 hours from now
			const updatedReminder = {
				id: reminderId,
				title: 'Updated Title',
				body: 'Updated Body',
				scheduledTime,
			};

			// Setup existing notification in the Map
			reminderSync.localNotifications.set(reminderId, 'local-notification-id');

			// Simulate Firestore update
			await new Promise((resolve) => {
				onSnapshotCallback({
					docChanges: () => [
						{
							type: 'modified',
							doc: {
								id: reminderId,
								data: () => updatedReminder,
							},
						},
					],
				});
				setTimeout(resolve, 0);
			});

			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content: {
					title: updatedReminder.title,
					body: updatedReminder.body,
					data: {
						reminderId: reminderId,
						scheduledTimezone: 'America/New_York',
						originalTime: scheduledTime.toISOString(),
						type: undefined,
						contactId: undefined,
					},
				},
				trigger: scheduledTime,
			});
		});

		it('should handle multiple reminders efficiently', async () => {
			const reminders = Array.from({ length: 5 }, (_, i) => ({
				id: `reminder-${i}`,
				title: `Reminder ${i}`,
				body: `Body ${i}`,
				scheduledTime: new Date(Date.now() + (i + 1) * 3600000),
			}));

			// Simulate multiple additions
			await new Promise((resolve) => {
				onSnapshotCallback({
					docChanges: () =>
						reminders.map((reminder) => ({
							type: 'added',
							doc: {
								id: reminder.id,
								data: () => reminder,
							},
						})),
				});
				setTimeout(resolve, 0);
			});

			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(reminders.length);
		});
	});

	describe('Error Handling', () => {
		it('should handle scheduling errors gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
			Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('Scheduling failed'));

			const newReminder = {
				id: 'test-reminder',
				title: 'Test',
				body: 'Test Body',
				scheduledTime: new Date(Date.now() + 3600000),
			};

			// Simulate snapshot with reminder that will fail to schedule
			await new Promise((resolve) => {
				onSnapshotCallback({
					docChanges: () => [
						{
							type: 'added',
							doc: {
								id: newReminder.id,
								data: () => newReminder,
							},
						},
					],
				});
				setTimeout(resolve, 0);
			});

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should handle auth initialization gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

			// Stop the current instance
			reminderSync.stop();

			// Mock auth to simulate no user
			const { auth } = require('../../config/firebase');
			const originalAuth = { ...auth };

			auth.currentUser = null;
			auth.onAuthStateChanged = jest.fn((callback) => {
				return () => {};
			});

			// Try to start with no auth, using test mode
			await reminderSync.start({ testing: true });

			// Verify error was logged
			expect(consoleSpy).toHaveBeenCalledWith('No authenticated user');

			// Restore original auth
			Object.assign(auth, originalAuth);
			consoleSpy.mockRestore();
		});
	});

	describe('Timezone Handling', () => {
		let mockNow;

		beforeEach(() => {
			jest.clearAllMocks();
			// Set a fixed timestamp for January 1, 2024
			mockNow = new Date('2024-01-01T00:00:00.000Z').getTime();

			// Mock both Date.now and new Date()
			global.Date.now = jest.fn(() => mockNow);
			const RealDate = global.Date;
			global.Date = class extends RealDate {
				constructor(...args) {
					if (args.length === 0) {
						return new RealDate(mockNow);
					}
					return new RealDate(...args);
				}
			};
			global.Date.now = jest.fn(() => mockNow);
		});

		afterEach(() => {
			global.Date = Date;
			jest.restoreAllMocks();
		});

		it('should store timezone information with notification', async () => {
			const scheduledTime = new Date('2024-01-20T15:00:00.000Z');
			const reminder = {
				id: 'test-reminder',
				user_id: 'test-user',
				scheduledTime,
				title: 'Test Reminder',
			};

			getUserPreferences.mockResolvedValue({ timezone: 'America/New_York' });

			await reminderSync.scheduleLocalNotification(reminder);

			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
				content: {
					title: 'Test Reminder',
					body: 'Time to reach out!',
					data: {
						reminderId: 'test-reminder',
						scheduledTimezone: 'America/New_York',
						originalTime: scheduledTime.toISOString(),
						type: undefined,
						contactId: undefined,
					},
				},
				trigger: scheduledTime,
			});
		});

		describe('Offline Support', () => {
			it('should queue reminders when offline', async () => {
				// Mock offline state
				NetInfo.fetch.mockResolvedValueOnce({
					isConnected: false,
					isInternetReachable: false,
				});

				const reminder = {
					id: 'offline-reminder',
					title: 'Offline Test',
					scheduledTime: new Date(Date.now() + 3600000),
				};

				await reminderSync.handleReminderUpdate({
					docChanges: () => [
						{
							type: 'added',
							doc: {
								id: reminder.id,
								data: () => reminder,
							},
						},
					],
				});

				expect(reminderSync.offlineQueue.has('offline-reminder')).toBe(true);
				expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
			});

			it('should sync offline queue when coming online', async () => {
				// Setup offline queue
				const reminder = {
					id: 'queued-reminder',
					title: 'Queued Test',
					scheduledTime: new Date(Date.now() + 3600000),
				};

				await reminderSync.handleOfflineReminder(reminder);

				// Mock coming online
				NetInfo.fetch.mockResolvedValueOnce({
					isConnected: true,
					isInternetReachable: true,
				});

				await reminderSync.syncOfflineQueue();

				expect(reminderSync.offlineQueue.size).toBe(0);
			});
		});
	});
});
