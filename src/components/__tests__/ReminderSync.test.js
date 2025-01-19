import { reminderSync } from '../../utils/notifications/reminderSync';
import * as Notifications from 'expo-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { REMINDER_STATUS, REMINDER_TYPES } from '../../../constants/notificationConstants';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn().mockResolvedValue('local-notification-id'),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(),
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
}));

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
	collection: jest.fn().mockReturnValue('reminders-collection'),
	query: jest.fn().mockReturnValue('reminders-query'),
	where: jest.fn().mockReturnValue('where-clause'),
	onSnapshot: jest.fn(),
	Timestamp: {
		now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
		fromDate: jest.fn((date) => ({
			seconds: Math.floor(date.getTime() / 1000),
			nanoseconds: 0,
			toDate: () => date,
		})),
	},
}));

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

			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						title: newReminder.title,
						body: newReminder.body,
						data: expect.objectContaining({
							reminderId: newReminder.id,
						}),
					}),
					trigger: expect.objectContaining({
						date: scheduledTime,
					}),
				})
			);
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
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						title: updatedReminder.title,
						body: updatedReminder.body,
					}),
					trigger: expect.objectContaining({
						date: scheduledTime,
					}),
				})
			);
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
});
