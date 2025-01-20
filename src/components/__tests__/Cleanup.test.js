import { cleanupService } from '../../utils/cleanup';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { NOTIFICATION_CONFIGS, REMINDER_TYPES } from '../../../constants/notificationConstants';
import {
	getReminder,
	updateReminder,
	getContactById,
	deleteReminder,
	addContactHistory,
} from '../../utils/firestore';

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: { uid: 'test-user' },
	},
	db: {
		collection: jest.fn(),
		doc: jest.fn(),
	},
	app: {},
}));

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
	collection: jest.fn(),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
	Timestamp: {
		now: () => ({
			toDate: () => new Date(),
			seconds: Math.floor(Date.now() / 1000),
			nanoseconds: 0,
		}),
	},
	initializeFirestore: jest.fn(() => ({})),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

// Mock dependencies
jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		notificationMap: new Map(),
		saveNotificationMap: jest.fn(),
	},
}));

jest.mock('expo-notifications');

// Mock firestore utilities
jest.mock('../../utils/firestore', () => ({
	getReminder: jest.fn(),
	updateReminder: jest.fn(),
	getContactById: jest.fn(),
	deleteReminder: jest.fn(),
	addContactHistory: jest.fn(),
}));

describe('CleanupService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		cleanupService.initialized = false;
		cleanupService.lastCleanupTime = null;
	});

	describe('Initialization', () => {
		it('should initialize successfully', async () => {
			const result = await cleanupService.initialize();
			expect(result).toBe(true);
			expect(cleanupService.initialized).toBe(true);
		});

		it('should not initialize twice', async () => {
			await cleanupService.initialize();
			const result = await cleanupService.initialize();
			expect(result).toBe(true);
		});
	});

	describe('Cleanup Logic', () => {
		it('should cleanup follow-up with notes added', async () => {
			const reminder = {
				type: REMINDER_TYPES.FOLLOW_UP,
				notes_added: true,
			};

			const result = await cleanupService.shouldCleanupReminder(reminder, new Date());
			expect(result).toBe(true);
		});

		it('should cleanup expired follow-up', async () => {
			const reminder = {
				type: REMINDER_TYPES.FOLLOW_UP,
				notes_added: false,
				scheduledTime: {
					toDate: () => new Date(Date.now() - 25 * 60 * 60 * 1000),
				},
			};

			const result = await cleanupService.shouldCleanupReminder(reminder, new Date());
			expect(result).toBe(true);
		});

		it('should not cleanup active scheduled reminder', async () => {
			const reminder = {
				type: REMINDER_TYPES.SCHEDULED,
				status: 'pending',
				scheduledTime: {
					toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
				},
			};

			const result = await cleanupService.shouldCleanupReminder(reminder, new Date());
			expect(result).toBe(false);
		});
	});

	describe('Cleanup Actions', () => {
		it('should perform complete cleanup cycle', async () => {
			const mockReminder = {
				type: REMINDER_TYPES.FOLLOW_UP,
				notes_added: true,
				status: 'completed',
				contact_id: 'test-contact-id',
				notes: 'Test notes',
			};

			getReminder.mockResolvedValue(mockReminder);
			addContactHistory.mockResolvedValue(true);
			deleteReminder.mockResolvedValue(true);
			notificationCoordinator.saveNotificationMap.mockResolvedValue();

			notificationCoordinator.notificationMap.set('test-id', { localId: 'local-id' });

			const result = await cleanupService.performCleanup();

			expect(result).toBe(true);
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('local-id');
			expect(addContactHistory).toHaveBeenCalled();
			expect(deleteReminder).toHaveBeenCalled();
			expect(notificationCoordinator.notificationMap.size).toBe(0);
		});
	});

	describe('AppState Integration', () => {
		it('should trigger cleanup on app becoming active', async () => {
			await cleanupService.initialize();

			// Simulate app becoming active after 6+ hours
			cleanupService.lastCleanupTime = new Date(Date.now() - 7 * 60 * 60 * 1000);

			const mockAppStateCallback = AppState.addEventListener.mock.calls[0][1];
			await mockAppStateCallback('active');

			expect(cleanupService.lastCleanupTime).not.toBe(null);
		});
	});

	describe('Cleanup Integration', () => {
		it('should properly handle completed recurring reminders', async () => {
			const mockReminder = {
				type: REMINDER_TYPES.SCHEDULED,
				status: 'completed',
				contact_id: 'test-contact-id',
				notes: 'Test notes',
				scheduledTime: {
					toDate: () => new Date(),
				},
			};

			const mockContact = {
				id: 'test-contact-id',
				scheduling: {
					frequency: 'weekly',
				},
			};

			getReminder.mockResolvedValue(mockReminder);
			getContactById.mockResolvedValue(mockContact);
			addContactHistory.mockResolvedValue(true);
			deleteReminder.mockResolvedValue(true);

			notificationCoordinator.notificationMap.set('test-id', { localId: 'local-id' });

			const result = await cleanupService.performCleanup();

			expect(result).toBe(true);
			expect(addContactHistory).toHaveBeenCalledWith(
				'test-contact-id',
				expect.objectContaining({
					type: REMINDER_TYPES.SCHEDULED,
					status: 'completed',
				})
			);
			expect(deleteReminder).toHaveBeenCalled();
		});

		it('should properly handle snoozed reminders', async () => {
			const mockReminder = {
				type: REMINDER_TYPES.SCHEDULED,
				status: 'snoozed',
				contact_id: 'test-contact-id',
				scheduledTime: {
					toDate: () => new Date(),
				},
			};

			getReminder.mockResolvedValue(mockReminder);

			notificationCoordinator.notificationMap.set('test-id', { localId: 'local-id' });

			const result = await cleanupService.performCleanup();

			// Snoozed reminders should not be cleaned up
			expect(result).toBe(true);
			expect(deleteReminder).not.toHaveBeenCalled();
			expect(addContactHistory).not.toHaveBeenCalled();
		});

		it('should properly handle reminders with notes', async () => {
			const mockReminder = {
				type: REMINDER_TYPES.SCHEDULED,
				status: 'completed',
				notes_added: true,
				notes: 'Test notes',
				contact_id: 'test-contact-id',
				scheduledTime: {
					toDate: () => new Date(),
				},
			};

			getReminder.mockResolvedValue(mockReminder);
			addContactHistory.mockResolvedValue(true);
			deleteReminder.mockResolvedValue(true);

			notificationCoordinator.notificationMap.set('test-id', { localId: 'local-id' });

			const result = await cleanupService.performCleanup();

			expect(result).toBe(true);
			expect(addContactHistory).toHaveBeenCalledWith(
				'test-contact-id',
				expect.objectContaining({
					notes: 'Test notes',
				})
			);
			expect(deleteReminder).toHaveBeenCalled();
		});
	});

	describe('CleanupService Edge Cases', () => {
		beforeEach(() => {
			jest.clearAllMocks();
			cleanupService.cleanupStats = {
				lastRunTime: null,
				successCount: 0,
				failureCount: 0,
				lastError: null,
			};
		});

		it('should handle network timeout gracefully', async () => {
			getReminder.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 100)));

			const result = await cleanupService.performCleanup();
			expect(result).toBe(true);
		});

		it('should handle corrupt notification data', async () => {
			notificationCoordinator.notificationMap.clear();
			notificationCoordinator.notificationMap.set('corrupt-id', null);

			const result = await cleanupService.performCleanup();
			expect(result).toBe(true);
			expect(cleanupService.cleanupStats.successCount).toBe(1);
			expect(cleanupService.cleanupStats.failureCount).toBe(0);
		}, 10000); // Timeout

		it('should handle concurrent cleanup requests', async () => {
			notificationCoordinator.notificationMap.clear();
			const promise1 = cleanupService.performCleanup();
			const promise2 = cleanupService.performCleanup();

			const [result1, result2] = await Promise.all([promise1, promise2]);
			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});

		it('should handle reminders with missing scheduledTime', async () => {
			const mockReminder = {
				type: REMINDER_TYPES.FOLLOW_UP,
				notes_added: false,
				scheduledTime: null,
			};

			getReminder.mockResolvedValue(mockReminder);
			const result = await cleanupService.shouldCleanupReminder(mockReminder, new Date());
			expect(result).toBe(true);
		});

		it('should handle app state changes during cleanup', async () => {
			notificationCoordinator.notificationMap.clear();
			await cleanupService.initialize();
			const mockAppStateCallback = AppState.addEventListener.mock.calls[0][1];

			const cleanupPromise = cleanupService.performCleanup();
			await mockAppStateCallback('background');
			await mockAppStateCallback('active');

			const result = await cleanupPromise;
			expect(result).toBe(true);
		});

		it('should track cleanup statistics', async () => {
			notificationCoordinator.notificationMap.clear();
			cleanupService.cleanupStats = {
				lastRunTime: null,
				successCount: 0,
				failureCount: 0,
				lastError: null,
			};

			const initialStats = cleanupService.getCleanupStats();
			expect(initialStats.successCount).toBe(0);

			notificationCoordinator.notificationMap.set('test-id', { localId: 'test-local-id' });
			getReminder.mockResolvedValue({
				type: REMINDER_TYPES.FOLLOW_UP,
				notes_added: true,
			});

			await cleanupService.performCleanup();

			const updatedStats = cleanupService.getCleanupStats();
			expect(updatedStats.lastRunTime).toBeInstanceOf(Date);
			expect(updatedStats.successCount).toBe(1);
			expect(updatedStats.failureCount).toBe(0);
		});
	});
});
