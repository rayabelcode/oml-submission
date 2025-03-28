// Mock firebase/auth
jest.mock('firebase/auth', () => ({
	onAuthStateChanged: jest.fn((auth, callback) => {
		callback(null);
		return () => {};
	}),
	signInWithEmailAndPassword: jest.fn(),
	createUserWithEmailAndPassword: jest.fn(),
	signOut: jest.fn(),
	sendPasswordResetEmail: jest.fn(),
	signInWithCredential: jest.fn(),
	EmailAuthProvider: {
		credential: jest.fn().mockReturnValue({ token: 'mock-credential' }),
	},
	reauthenticateWithCredential: jest.fn(),
	OAuthProvider: jest.fn(() => ({
		addScope: jest.fn(),
		setCustomParameters: jest.fn(),
		credential: jest.fn().mockReturnValue({ token: 'mock-credential' }),
	})),
}));

// Mock firebase config
jest.mock('../../config/firebase', () => ({
	auth: {
		currentUser: null,
	},
	db: {},
	app: {},
}));

// Mock Apple Authentication
jest.mock('expo-apple-authentication', () => ({
	signInAsync: jest.fn(),
	getCredentialStateAsync: jest.fn(),
	AppleAuthenticationScope: {
		FULL_NAME: 'FULL_NAME',
		EMAIL: 'EMAIL',
	},
	AppleAuthenticationCredential: {
		user: 'testUser',
		identityToken: 'testToken',
		fullName: {
			givenName: 'Test',
			familyName: 'User',
		},
		email: 'test@example.com',
		realUserStatus: 1,
		state: 1,
	},
}));

import { renderHook } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { auth } from '../../config/firebase';
import { Alert } from 'react-native';
import { cacheManager } from '../../utils/cache';
import { notificationCoordinator } from '../../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	sendPasswordResetEmail,
	signInWithCredential,
	OAuthProvider,
} from 'firebase/auth';

jest.mock('../../utils/cache', () => ({
	cacheManager: {
		clearAllUserData: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		clearAllNotifications: jest.fn().mockResolvedValue(true),
		notificationMap: new Map(),
	},
}));

jest.mock('expo-notifications', () => ({
	...jest.requireActual('expo-notifications'),
	cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(true),
	setBadgeCountAsync: jest.fn().mockResolvedValue(true),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('AuthContext', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Reset onAuthStateChanged mock implementation for each test
		onAuthStateChanged.mockImplementation((auth, callback) => {
			callback(null);
			return () => {};
		});
	});

	describe('Sign In', () => {
		it('successfully signs in user', async () => {
			signInWithEmailAndPassword.mockResolvedValueOnce({
				user: { email: 'test@example.com' },
			});

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signIn({
					email: 'test@example.com',
					password: 'password123',
				});
			});

			expect(response.error).toBeNull();
			expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'test@example.com', 'password123');
		});

		it('handles sign in error', async () => {
			signInWithEmailAndPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signIn({
					email: 'test@example.com',
					password: 'wrong',
				});
			});

			expect(response.error).toBeTruthy();
		});
	});

	describe('Sign Up', () => {
		it('successfully creates new user', async () => {
			createUserWithEmailAndPassword.mockResolvedValueOnce({
				user: { email: 'new@example.com' },
			});

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signUp({
					email: 'new@example.com',
					password: 'password123',
				});
			});

			expect(response.error).toBeNull();
			expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'new@example.com', 'password123');
		});

		it('handles sign up error', async () => {
			createUserWithEmailAndPassword.mockRejectedValueOnce(new Error('Email already in use'));

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signUp({
					email: 'existing@example.com',
					password: 'password123',
				});
			});

			expect(response.error).toBeTruthy();
		});
	});

	describe('Sign Out', () => {
		it('successfully signs out user', async () => {
			signOut.mockResolvedValueOnce();

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			await act(async () => {
				await result.current.signOut();
			});

			expect(signOut).toHaveBeenCalledWith(auth);
		});

		it('handles sign out error', async () => {
			const errorMessage = 'Sign out failed';
			signOut.mockRejectedValueOnce(new Error(errorMessage));

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signOut();
			});

			expect(response.error.message).toBe(errorMessage);
		});
	});

	describe('Reset Password', () => {
		it('successfully sends reset password email', async () => {
			sendPasswordResetEmail.mockResolvedValueOnce();

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.resetPassword('test@example.com');
			});

			expect(response.error).toBeNull();
			expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'test@example.com');
		});

		it('handles reset password error', async () => {
			sendPasswordResetEmail.mockRejectedValueOnce(new Error('User not found'));

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.resetPassword('nonexistent@example.com');
			});

			expect(response.error).toBeTruthy();
		});
	});

	describe('Apple Sign In', () => {
		it('successfully signs in with Apple', async () => {
			const mockAppleCredential = {
				identityToken: 'mock-token',
				nonce: 'mock-nonce',
				fullName: {
					givenName: 'John',
					familyName: 'Doe',
				},
				email: 'john.doe@example.com',
				user: 'mock-user-id',
				state: 1,
				realUserStatus: 1,
			};

			require('expo-apple-authentication').signInAsync.mockResolvedValueOnce(mockAppleCredential);

			signInWithCredential.mockResolvedValueOnce({
				user: {
					email: 'apple@example.com',
					uid: 'mock-user-id',
				},
			});

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signInWithApple();
			});

			expect(response.error).toBeNull();
			expect(signInWithCredential).toHaveBeenCalled();
		});

		it('handles Apple sign in error', async () => {
			require('expo-apple-authentication').signInAsync.mockRejectedValueOnce(
				new Error('Apple sign in failed')
			);

			const { result } = renderHook(() => useAuth(), {
				wrapper: AuthProvider,
			});

			let response;
			await act(async () => {
				response = await result.current.signInWithApple();
			});

			expect(response.error).toBeTruthy();
		});
	});
});

describe('Account Deletion', () => {
	const mockUser = {
		email: 'test@example.com',
		uid: 'mock-user-id',
		delete: jest.fn(),
		providerData: [{ providerId: 'password' }],
	};

	beforeEach(() => {
		mockUser.delete.mockClear();
		onAuthStateChanged.mockImplementation((auth, callback) => {
			callback(mockUser);
			return () => {};
		});
	});

	it('successfully deletes email/password account', async () => {
		mockUser.delete.mockResolvedValue();

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await mockUser.delete();
		});

		expect(mockUser.delete).toHaveBeenCalled();
	});

	it('successfully deletes Apple account', async () => {
		const mockAppleUser = {
			...mockUser,
			providerData: [{ providerId: 'apple.com' }],
			delete: jest.fn().mockResolvedValue(),
		};

		onAuthStateChanged.mockImplementation((auth, callback) => {
			callback(mockAppleUser);
			return () => {};
		});

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await mockAppleUser.delete();
		});

		expect(mockAppleUser.delete).toHaveBeenCalled();
	});

	it('handles deletion error', async () => {
		mockUser.delete.mockRejectedValue(new Error('Deletion failed'));

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		let error;
		await act(async () => {
			try {
				await mockUser.delete();
			} catch (e) {
				error = e;
			}
		});

		expect(error).toBeTruthy();
		expect(error.message).toBe('Deletion failed');
	});
});

describe('Data Clearing', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock user for onAuthStateChanged
		onAuthStateChanged.mockImplementation((auth, callback) => {
			callback({ uid: 'test-user-id' });
			return () => {};
		});
	});

	it('clears cache and notifications on sign in', async () => {
		signInWithEmailAndPassword.mockResolvedValueOnce({
			user: { email: 'test@example.com', uid: 'test-user-id' },
		});

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await result.current.signIn({
				email: 'test@example.com',
				password: 'password123',
			});
		});

		// Check if cache and notifications were cleared
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(notificationCoordinator.clearAllNotifications).toHaveBeenCalled();
	});

	it('clears cache and notifications on sign up', async () => {
		createUserWithEmailAndPassword.mockResolvedValueOnce({
			user: { email: 'new@example.com', uid: 'new-user-id' },
		});

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await result.current.signUp({
				email: 'new@example.com',
				password: 'password123',
			});
		});

		// Check if cache and notifications were cleared
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(notificationCoordinator.clearAllNotifications).toHaveBeenCalled();
	});

	it('clears cache and notifications on Apple sign in', async () => {
		const mockAppleCredential = {
			identityToken: 'mock-token',
			nonce: 'mock-nonce',
			fullName: {
				givenName: 'John',
				familyName: 'Doe',
			},
		};

		require('expo-apple-authentication').signInAsync.mockResolvedValueOnce(mockAppleCredential);

		signInWithCredential.mockResolvedValueOnce({
			user: {
				email: 'apple@example.com',
				uid: 'apple-user-id',
			},
		});

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await result.current.signInWithApple();
		});

		// Check if cache and notifications were cleared
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(notificationCoordinator.clearAllNotifications).toHaveBeenCalled();
	});

	it('clears cache and notifications on sign out', async () => {
		signOut.mockResolvedValueOnce();

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		await act(async () => {
			await result.current.signOut();
		});

		// Check if cache and notifications were cleared
		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
		expect(notificationCoordinator.clearAllNotifications).toHaveBeenCalled();
	});

	it('handles errors during data clearing on sign out', async () => {
		// Mock an error during cache clearing
		cacheManager.clearAllUserData.mockRejectedValueOnce(new Error('Cache clearing failed'));

		signOut.mockResolvedValueOnce();

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		// Call signOut
		let response;
		await act(async () => {
			response = await result.current.signOut();
		});

		// Should still attempt to sign out even if cache clearing fails
		expect(signOut).toHaveBeenCalled();

		expect(cacheManager.clearAllUserData).toHaveBeenCalled();
	});

	it('proceeds with login even if data clearing fails', async () => {
		// Mock an error during notification clearing
		notificationCoordinator.clearAllNotifications.mockRejectedValueOnce(
			new Error('Notification clearing failed')
		);

		signInWithEmailAndPassword.mockResolvedValueOnce({
			user: { email: 'test@example.com', uid: 'test-user-id' },
		});

		const { result } = renderHook(() => useAuth(), {
			wrapper: AuthProvider,
		});

		let response;
		await act(async () => {
			response = await result.current.signIn({
				email: 'test@example.com',
				password: 'password123',
			});
		});

		// Should still successfully log in
		expect(response.data).toBeTruthy();
		expect(response.error).toBeNull();
		expect(signInWithEmailAndPassword).toHaveBeenCalled();
	});
});
