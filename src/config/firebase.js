import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
	apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let auth;

if (Platform.OS === 'web') {
	auth = getAuth(app);
	auth.setPersistence(browserLocalPersistence); // Explicit persistence for web
} else {
	// Only require `getReactNativePersistence` for non-web platforms
	const { getReactNativePersistence } = require('firebase/auth');
	auth = initializeAuth(app, {
		persistence: getReactNativePersistence(AsyncStorage),
	});
}

export { auth };
export const db = getFirestore(app);
export default app;
