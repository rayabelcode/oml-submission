import { notificationService } from '../../utils/notifications';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addReminder, updateReminder, deleteReminder } from '../../utils/firestore';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	setNotificationHandler: jest.fn(),
	scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(true),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
}));

// Mock firestore utilities
jest.mock('../../utils/firestore', () => ({
	addReminder: jest.fn().mockResolvedValue('mock-firestore-id'),
	updateReminder: jest.fn().mockResolvedValue(true),
	deleteReminder: jest.fn().mockResolvedValue(true),
}));

describe('NotificationService', () => {
	beforeEach(() => {
		jest.clearAllMocks(); // Clear mocks before each test
		notificationService.initialized = false; // Reset state
		notificationService.badgeCount = 0;
		notificationService.notificationMap.clear();
	});

	describe('initialize', () => {
		it('should initialize successfully', async () => {
			// Mock AsyncStorage responses
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
			id: 'contact-123',
			first_name: 'John',
			scheduling: {
				relationship_type: 'family',
			},
		};

		const mockDate = new Date('2024-01-01T10:00:00Z');
		const mockUserId = 'user-123';

		beforeEach(async () => {
			await notificationService.initialize();
		});

		it('should schedule a reminder successfully', async () => {
			const mockFirestoreId = 'reminder-123';
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
						sound: 'family.wav',
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
			const mockFirestoreId = 'reminder-123';
			const mockLocalId = 'local-123';

			notificationService.notificationMap.set(mockFirestoreId, {
				localId: mockLocalId,
				scheduledTime: new Date(),
			});

			const result = await notificationService.cancelReminder(mockFirestoreId);

			expect(result).toBe(true);
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(mockLocalId);
			expect(updateReminder).toHaveBeenCalledWith(mockFirestoreId, { status: 'cancelled' });
			expect(notificationService.notificationMap.has(mockFirestoreId)).toBe(false);
		});
	});
});
