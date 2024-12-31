jest.mock('firebase/firestore', () => ({
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
		}),
		now: () => ({
			toDate: () => new Date(),
			seconds: Math.floor(Date.now() / 1000),
			nanoseconds: (Date.now() % 1000) * 1000000,
		}),
	},
}));

jest.mock('expo-notifications', () => ({
	setNotificationHandler: jest.fn(),
	scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(true),
	getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
	AndroidImportance: {
		MAX: 5,
	},
}));

jest.mock('firebase/auth', () => ({
	getReactNativePersistence: jest.fn(),
	initializeAuth: jest.fn(),
	getAuth: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
	getFirestore: jest.fn(),
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	orderBy: jest.fn(),
	getDocs: jest.fn(),
	addDoc: jest.fn(),
	updateDoc: jest.fn(),
	deleteDoc: jest.fn(),
	doc: jest.fn(),
	setDoc: jest.fn(),
	serverTimestamp: jest.fn(),
	getDoc: jest.fn(),
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
		}),
		now: () => ({
			toDate: () => new Date(),
			seconds: Math.floor(Date.now() / 1000),
			nanoseconds: (Date.now() % 1000) * 1000000,
		}),
	},
}));

jest.mock('firebase/storage', () => ({
	getStorage: jest.fn(),
	ref: jest.fn(),
	uploadBytes: jest.fn(),
	getDownloadURL: jest.fn(),
}));
