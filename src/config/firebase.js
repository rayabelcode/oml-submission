import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import {
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
	console.error('Firebase configuration is incomplete. Check your environment variables.');
}

const app = initializeApp(firebaseConfig);

let auth;

if (Platform.OS === 'web') {
	auth = getAuth(app);
	setPersistence(auth, browserLocalPersistence)
		.then(() => {
			console.log('Web persistence initialized');
		})
		.catch((error) => {
			console.error('Error setting persistence:', error);
		});
} else {
	const { getReactNativePersistence } = require('firebase/auth');
	auth = initializeAuth(app, {
		persistence: getReactNativePersistence(AsyncStorage),
	});
}

const db = initializeFirestore(app, {
	cache: persistentLocalCache(
		Platform.OS === 'web' ? { tabManager: persistentMultipleTabManager() } : undefined
	),
});

const storage = getStorage(app);

export { auth, app, db, storage };
