import { scheduleLocalNotificationWithPush } from '../../utils/notifications/pushNotification';
import * as Notifications from 'expo-notifications';
import { addReminder, updateReminder, deleteReminder, subscribeToReminders } from '../../utils/firestore';
import { REMINDER_STATUS, REMINDER_TYPES } from '../../../constants/notificationConstants';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	scheduleNotificationAsync: jest.fn().mockResolvedValue('local-notification-id'),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(),
	getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
}));

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
	collection: jest.fn(),
	doc: jest.fn(),
	getDoc: jest.fn(),
	getDocs: jest.fn(),
	addDoc: jest.fn(),
	updateDoc: jest.fn(),
	deleteDoc: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	onSnapshot: jest.fn(),
	serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

describe('Reminder Sync System', () => {
	const testUserId = 'test-user';
	const testContactId = 'test-contact';
	let snapshotCallback;

	beforeEach(() => {
		jest.clearAllMocks();
		const { onSnapshot } = require('firebase/firestore');

		// Setup snapshot listener mock
		onSnapshot.mockImplementation((query, callback) => {
			snapshotCallback = callback;
			return () => {}; // Unsubscribe function
		});
	});

	describe('Firestore to Local Notification Sync', () => {
		it('should schedule local notification when reminder is added to Firestore', async () => {
			const newReminder = {
				id: 'test-reminder',
				contact_id: testContactId,
				user_id: testUserId,
				type: REMINDER_TYPES.SCHEDULED,
				status: REMINDER_STATUS.PENDING,
				scheduledTime: new Date(Date.now() + 3600000), // 1 hour from now
				title: 'Test Reminder',
				body: 'This is a test reminder',
			};

			// Simulate adding reminder to Firestore
			await addReminder(newReminder);

			// Simulate Firestore snapshot update
			snapshotCallback({
				docs: [
					{
						id: newReminder.id,
						data: () => newReminder,
					},
				],
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
					trigger: expect.any(Object),
				})
			);
		});

		it('should cancel local notification when reminder is deleted from Firestore', async () => {
			const reminderId = 'test-reminder';

			// Setup existing notification
			Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
				{
					identifier: 'local-notification-id',
					content: {
						data: {
							reminderId,
						},
					},
				},
			]);

			// Simulate deleting reminder from Firestore
			await deleteReminder(reminderId);

			// Simulate empty snapshot
			snapshotCallback({
				docs: [],
			});

			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('local-notification-id');
		});

		it('should update local notification when reminder is modified in Firestore', async () => {
			const reminderId = 'test-reminder';
			const updatedReminder = {
				id: reminderId,
				title: 'Updated Title',
				body: 'Updated Body',
				scheduledTime: new Date(Date.now() + 7200000), // 2 hours from now
			};

			// Setup existing notification
			Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
				{
					identifier: 'local-notification-id',
					content: {
						data: {
							reminderId,
						},
					},
				},
			]);

			// Simulate updating reminder in Firestore
			await updateReminder(reminderId, updatedReminder);

			// Simulate updated snapshot
			snapshotCallback({
				docs: [
					{
						id: reminderId,
						data: () => updatedReminder,
					},
				],
			});

			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('local-notification-id');
			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						title: updatedReminder.title,
						body: updatedReminder.body,
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

			// Simulate snapshot with multiple reminders
			snapshotCallback({
				docs: reminders.map((reminder) => ({
					id: reminder.id,
					data: () => reminder,
				})),
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
			snapshotCallback({
				docs: [
					{
						id: newReminder.id,
						data: () => newReminder,
					},
				],
			});

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it('should handle Firestore errors gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
			const { onSnapshot } = require('firebase/firestore');

			// Simulate Firestore error
			onSnapshot.mockImplementationOnce((query, callback, errorCallback) => {
				errorCallback(new Error('Firestore error'));
				return () => {};
			});

			// Setup subscription
			subscribeToReminders(testUserId, REMINDER_STATUS.PENDING, () => {});

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
