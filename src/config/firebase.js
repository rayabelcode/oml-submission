import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
	apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Verify config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
	console.error('Firebase configuration is incomplete. Check your environment variables.');
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Authentication
let auth;

if (Platform.OS === 'web') {
	// Web: Use browser persistence
	auth = getAuth(app);
	auth.setPersistence(browserLocalPersistence);
} else {
	// Use native persistence for mobile platforms
	const { getReactNativePersistence } = require('firebase/auth');
	auth = initializeAuth(app, {
		persistence: getReactNativePersistence(AsyncStorage),
	});
}

// Firestore Database
export const db = getFirestore(app);

export const storage = getStorage(app);

export { auth, app };
