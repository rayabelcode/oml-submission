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
import { createUserDocument } from '../utils/firestore';

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

	const signInWithApple = async () => {
		try {
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
			return { data: null, error };
		}
	};

	const signUp = async ({ email, password }) => {
		try {
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
			const { user } = await signInWithEmailAndPassword(auth, email, password);
			return { data: user, error: null };
		} catch (error) {
			return { data: null, error };
		}
	};

	const signOut = async () => {
		try {
			await firebaseSignOut(auth);
			return { error: null };
		} catch (error) {
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
