import React, { createContext, useState, useContext, useEffect } from 'react';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut as firebaseSignOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	signInWithCredential,
	OAuthProvider,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createUserDocument, cleanupSubscriptions } from '../utils/firestore';
import { cacheManager } from '../utils/cache';
import { notificationCoordinator } from '../utils/notificationCoordinator';
import * as Notifications from 'expo-notifications';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			setUser(user);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	// Clear all user-related data
	const clearAllUserData = async () => {
		try {
			// Clear notifications
			await notificationCoordinator.clearAllNotifications();

			// Clear all cached data
			await cacheManager.clearAllUserData();

			return true;
		} catch (error) {
			console.error('[AuthContext] Error clearing user data:', error);
			return false;
		}
	};

	const signInWithApple = async () => {
		try {
			// Clear previous user data
			await clearAllUserData();

			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL,
				],
			});

			const provider = new OAuthProvider('apple.com');
			const authCredential = provider.credential({
				idToken: credential.identityToken,
				rawNonce: credential.nonce,
			});

			const { user } = await signInWithCredential(auth, authCredential);
			await createUserDocument(user.uid, {
				email: user.email,
				first_name: credential.fullName?.givenName || '',
				last_name: credential.fullName?.familyName || '',
			});
			return { data: user, error: null };
		} catch (error) {
			// Handle Apple authentication errors
			const errorMessage = error.message || '';

			if (errorMessage.includes('canceled') || errorMessage.includes('cancelled')) {
				console.log('User cancelled Apple Sign In');
				// Return specific error for cancellation
				return {
					data: null,
					error: {
						code: 'auth/cancelled',
						message: 'Sign in was cancelled',
					},
				};
			}

			if (errorMessage.includes('invalid') || errorMessage.includes('authorization')) {
				console.log('Apple Sign In authorization needs renewal');
				return {
					data: null,
					error: {
						code: 'auth/authorization-expired',
						message: 'Your Apple ID authorization needs to be renewed. Please try again.',
					},
				};
			}

			if (errorMessage.includes('network') || errorMessage.includes('connection')) {
				console.log('Network error during Apple Sign In');
				return {
					data: null,
					error: {
						code: 'auth/network-error',
						message: 'Cannot connect to Apple services. Please check your connection.',
					},
				};
			}

			// Log full error for debugging
			console.error('Apple sign in error:', error);

			// Return generic error for other cases
			return {
				data: null,
				error: {
					code: 'auth/apple-sign-in-failed',
					message: 'Failed to sign in with Apple. Please try again.',
				},
			};
		}
	};

	const signUp = async ({ email, password }) => {
		try {
			// Clear previous user data
			await clearAllUserData();

			const { user } = await createUserWithEmailAndPassword(auth, email, password);
			await createUserDocument(user.uid, {
				email: user.email,
				first_name: '',
				last_name: '',
			});
			return { data: user, error: null };
		} catch (error) {
			return { data: null, error };
		}
	};

	const signIn = async ({ email, password }) => {
		try {
			// Clear previous user data
			await clearAllUserData();

			const { user } = await signInWithEmailAndPassword(auth, email, password);
			return { data: user, error: null };
		} catch (error) {
			return { data: null, error };
		}
	};

	const signOut = async () => {
		try {
			// Clean up all subscriptions and await promise
			await Promise.resolve(cleanupSubscriptions());

			// Clear all user data
			await clearAllUserData();

			// Delay to make sure all cleanup operations have completed
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Sign out of Firebase
			await firebaseSignOut(auth);
			setUser(null);
			return { error: null };
		} catch (error) {
			console.error('Sign out error:', error);
			return { error };
		}
	};

	const resetPassword = async (email) => {
		try {
			await sendPasswordResetEmail(auth, email);
			return { error: null };
		} catch (error) {
			return { error };
		}
	};

	const isAppleUser = () => {
		if (!user) return false;
		return user.providerData.some((provider) => provider.providerId === 'apple.com');
	};

	const value = {
		user,
		setUser,
		signUp,
		signIn,
		signOut,
		resetPassword,
		signInWithApple,
		loading,
		isAppleUser,
	};

	return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
