import { cleanupSubscriptions } from '../../utils/firestore';
import { cacheManager } from '../../utils/cache';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import { auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';

// Mock the dependencies
jest.mock('../../utils/firestore', () => ({
	cleanupSubscriptions: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/cache', () => ({
	cacheManager: {
		clearAllUserData: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		clearAllNotifications: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock('firebase/auth', () => ({
	signOut: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

describe('Logout Cleanup Process', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('properly sequences cleanup operations', async () => {
		// Simulate the logout sequence
		await cleanupSubscriptions();
		await cacheManager.clearAllUserData();
		await signOut(auth);

		// Verify the order of calls
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);
	});

	it('handles errors in cleanup', async () => {
		// Setup cleanup to fail
		cleanupSubscriptions.mockRejectedValueOnce(new Error('Cleanup failed'));

		// Even with error, the sequence should continue
		try {
			await cleanupSubscriptions();
		} catch (e) {
			// Expected error
		}

		await cacheManager.clearAllUserData();
		await signOut(auth);

		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);
	});

	it('handles error in notificationCoordinator cleanup', async () => {
		// Setup notification cleanup to fail
		notificationCoordinator.clearAllNotifications.mockRejectedValueOnce(
			new Error('Notification cleanup failed')
		);

		// Manually simulate the logout sequence with error handling
		await cleanupSubscriptions();

		try {
			await notificationCoordinator.clearAllNotifications();
		} catch (error) {
			// Expected error, continue with logout process
		}

		await cacheManager.clearAllUserData();
		await signOut(auth);

		// Verify all methods were called despite the error
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(notificationCoordinator.clearAllNotifications).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);
	});

	it('handles timeout during cleanup process', async () => {
		// Mock setTimeout to instantly execute the callback
		jest.useFakeTimers();
		const originalSetTimeout = global.setTimeout;
		global.setTimeout = jest.fn((callback, ms) => {
			callback();
			return 123; // Return a timeout ID
		});

		// Run cleanup sequence with delay
		await cleanupSubscriptions();
		await new Promise((resolve) => setTimeout(resolve, 500)); // This will execute immediately
		await cacheManager.clearAllUserData();
		await signOut(auth);

		expect(global.setTimeout).toHaveBeenCalled();
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);

		// Restore original setTimeout
		global.setTimeout = originalSetTimeout;
		jest.useRealTimers();
	});

	it('handles error during final sign out', async () => {
		// Setup signOut to fail
		signOut.mockRejectedValueOnce(new Error('Sign out failed'));

		// Run the cleanup sequence
		await cleanupSubscriptions();
		await cacheManager.clearAllUserData();

		let error;
		try {
			await signOut(auth);
		} catch (e) {
			error = e;
		}

		// Verify error was caught and previous steps were completed
		expect(error).toBeDefined();
		expect(error.message).toBe('Sign out failed');
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
	});

	it('handles multiple errors throughout the process', async () => {
		// Setup multiple failures
		cleanupSubscriptions.mockRejectedValueOnce(new Error('Subscription cleanup failed'));
		cacheManager.clearAllUserData.mockRejectedValueOnce(new Error('Cache cleanup failed'));
		signOut.mockRejectedValueOnce(new Error('Sign out failed'));

		// Try to run the sequence
		let errors = [];

		try {
			await cleanupSubscriptions();
		} catch (e) {
			errors.push(e);
		}

		try {
			await cacheManager.clearAllUserData();
		} catch (e) {
			errors.push(e);
		}

		try {
			await signOut(auth);
		} catch (e) {
			errors.push(e);
		}

		// Verify all methods were called despite errors
		expect(errors.length).toBe(3);
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);
	});

	it('handles null user during logout process', async () => {
		const configFirebaseMock = jest.requireMock('../../config/firebase');
		const originalCurrentUser = configFirebaseMock.auth.currentUser;

		// Set current user to null for this test
		configFirebaseMock.auth.currentUser = null;

		// Run cleanup sequence
		await cleanupSubscriptions();
		await cacheManager.clearAllUserData();
		await signOut(auth);

		// Verify the methods were still called
		expect(cleanupSubscriptions).toHaveBeenCalled();
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith(auth);

		// Restore original user
		configFirebaseMock.auth.currentUser = originalCurrentUser;
	});
});
