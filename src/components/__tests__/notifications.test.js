import { notificationService } from '../../utils/notifications';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	addReminder,
	updateReminder,
	deleteReminder,
	getReminder,
	getContactReminders,
} from '../../utils/firestore';

// Suppress console.error during tests
beforeAll(() => {
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	console.error.mockRestore();
});

// Mock firestore utilities
jest.mock('../../utils/firestore', () => ({
	addReminder: jest.fn().mockResolvedValue('mock-firestore-id'),
	updateReminder: jest.fn().mockResolvedValue(true),
	deleteReminder: jest.fn().mockResolvedValue(true),
	getReminder: jest.fn().mockResolvedValue({
		id: 'reminder-123',
		contact_id: 'contact-123',
		date: new Date('2024-01-01T10:00:00Z'),
		type: 'regular',
		user_id: 'user-123',
	}),
	getContactReminders: jest.fn().mockResolvedValue([
		{
			id: 'reminder-123',
			contact_id: 'contact-123',
			date: new Date('2024-01-01T10:00:00Z'),
		},
	]),
}));

describe('NotificationService', () => {
	const mockUserId = 'user-123';
	const mockContactId = 'contact-123';
	const mockReminderId = 'reminder-123';
	const mockDate = new Date('2024-01-01T10:00:00Z');

	beforeEach(() => {
		jest.clearAllMocks();
		notificationService.initialized = false;
		notificationService.badgeCount = 0;
		notificationService.notificationMap.clear();
	});

	describe('updateReminder', () => {
		it('should update a reminder successfully', async () => {
			const updateData = {
				notes: 'Updated test reminder',
			};

			const result = await updateReminder(mockReminderId, updateData);

			expect(result).toBe(true);
			expect(updateReminder).toHaveBeenCalledWith(mockReminderId, expect.objectContaining(updateData));
		});
	});

	describe('deleteReminder', () => {
		it('should delete a reminder successfully', async () => {
			const result = await deleteReminder(mockReminderId);

			expect(result).toBe(true);
			expect(deleteReminder).toHaveBeenCalledWith(mockReminderId);
		});
	});

	describe('getReminder', () => {
		it('should retrieve a reminder successfully', async () => {
			const reminder = await getReminder(mockReminderId);

			expect(reminder).toHaveProperty('id');
			expect(reminder).toHaveProperty('contact_id');
			expect(reminder).toHaveProperty('date');
			expect(getReminder).toHaveBeenCalledWith(mockReminderId);
		});
	});

	describe('getContactReminders', () => {
		it('should retrieve contact reminders successfully', async () => {
			const reminders = await getContactReminders(mockContactId, mockUserId);

			expect(Array.isArray(reminders)).toBe(true);
			expect(reminders.length).toBeGreaterThan(0);
			expect(getContactReminders).toHaveBeenCalledWith(mockContactId, mockUserId);
		});
	});

	describe('initialize', () => {
		it('should initialize successfully', async () => {
			AsyncStorage.getItem.mockImplementation((key) => {
				if (key === 'badgeCount') return Promise.resolve('5');
				if (key === 'notification_map') return Promise.resolve('[]');
				return Promise.resolve(null);
			});

			const result = await notificationService.initialize();

			expect(result).toBe(true);
			expect(notificationService.initialized).toBe(true);
			expect(notificationService.badgeCount).toBe(5);
			expect(Notifications.setNotificationHandler).toHaveBeenCalled();
		});

		it('should handle initialization errors', async () => {
			AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

			const result = await notificationService.initialize();

			expect(result).toBe(false);
			expect(notificationService.initialized).toBe(false);
		});
	});

	describe('scheduleContactReminder', () => {
		const mockContact = {
			id: mockContactId,
			first_name: 'John',
		};

		beforeEach(async () => {
			await notificationService.initialize();
		});

		it('should schedule a reminder successfully', async () => {
			const mockFirestoreId = mockReminderId;
			const mockLocalId = 'local-123';

			addReminder.mockResolvedValue(mockFirestoreId);
			Notifications.scheduleNotificationAsync.mockResolvedValue(mockLocalId);

			const result = await notificationService.scheduleContactReminder(mockContact, mockDate, mockUserId);

			expect(result).toEqual({
				firestoreId: mockFirestoreId,
				localNotificationId: mockLocalId,
			});

			expect(addReminder).toHaveBeenCalledWith(
				expect.objectContaining({
					contactId: mockContact.id,
					userId: mockUserId,
					type: 'regular',
					status: 'pending',
				})
			);

			expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.objectContaining({
						title: expect.any(String),
						badge: expect.any(Number),
					}),
					trigger: { date: mockDate },
				})
			);
		});

		it('should handle scheduling errors', async () => {
			addReminder.mockRejectedValue(new Error('Firestore error'));

			const result = await notificationService.scheduleContactReminder(mockContact, mockDate, mockUserId);

			expect(result).toBeNull();
			expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
		});
	});

	describe('cancelReminder', () => {
		it('should cancel a reminder successfully', async () => {
			const mockLocalId = 'local-123';

			notificationService.notificationMap.set(mockReminderId, {
				localId: mockLocalId,
				scheduledTime: new Date(),
			});

			const result = await notificationService.cancelReminder(mockReminderId);

			expect(result).toBe(true);
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(mockLocalId);
			expect(updateReminder).toHaveBeenCalledWith(mockReminderId, { status: 'cancelled' });
			expect(notificationService.notificationMap.has(mockReminderId)).toBe(false);
		});
	});
});
