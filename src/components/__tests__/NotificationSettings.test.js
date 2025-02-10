import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Mock expo-font
jest.mock('expo-font', () => ({
	isLoaded: jest.fn(() => true),
	loadAsync: jest.fn(),
	__internal__: {
		nativeFonts: [],
	},
}));

// Mock Icon component
jest.mock('@expo/vector-icons', () => ({
	Ionicons: 'Icon',
}));

// Mock vector icons
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// Mock settings
jest.mock('../../styles/screens/settings', () => ({
	useStyles: () => ({
		container: {},
		headerSettingsPages: {},
		settingSection: {},
		sectionTitle: {},
		sectionDescription: {},
		settingItem: {},
		settingItemLeft: {},
		settingText: {},
		profileName: {},
		profileSectionContainer: {},
		profileSection: {},
	}),
}));

// Other mocks
jest.mock('../../context/ThemeContext', () => {
	const mockTheme = {
		colors: {
			text: { primary: '#000' },
			background: { primary: '#fff' },
			primary: '#007AFF',
		},
	};

	return {
		ThemeContext: {
			Provider: ({ children }) => children,
		},
		useTheme: () => mockTheme,
	};
});

jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
	getAllScheduledNotificationsAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
	db: {},
	auth: { currentUser: { uid: 'test-user' } },
}));

jest.mock('firebase/firestore', () => ({
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
}));

jest.mock('../../utils/firestore', () => ({
	updateUserProfile: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../context/AuthContext', () => ({
	useAuth: () => ({ user: { uid: 'test-user' } }),
}));

jest.mock('../../utils/notifications/reminderSync', () => ({
	reminderSync: {
		scheduleLocalNotification: jest.fn().mockResolvedValue('notification-id'),
	},
}));

import NotificationSettingsScreen from '../../screens/settings/NotificationSettingsScreen';

describe('NotificationSettingsScreen', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		AsyncStorage.getItem.mockImplementation((key) => {
			if (key === 'cloudNotificationsEnabled') return Promise.resolve('false');
			if (key === 'localNotificationsEnabled') return Promise.resolve('false');
			return Promise.resolve(null);
		});
	});

	it('loads initial notification settings correctly', async () => {
		render(<NotificationSettingsScreen />);

		await waitFor(() => {
			expect(AsyncStorage.getItem).toHaveBeenCalledWith('cloudNotificationsEnabled');
			expect(AsyncStorage.getItem).toHaveBeenCalledWith('localNotificationsEnabled');
		});
	});

	it('handles cloud notifications toggle correctly', async () => {
		const mockScheduledNotifications = [
			{ identifier: 'notification1', content: { data: { type: 'SCHEDULED' } } },
			{ identifier: 'notification2', content: { data: { type: 'CUSTOM_DATE' } } },
		];

		Notifications.getAllScheduledNotificationsAsync.mockResolvedValue(mockScheduledNotifications);

		const { getAllByRole } = render(<NotificationSettingsScreen />);
		const switches = getAllByRole('switch');
		const cloudToggle = switches[0]; // Cloud notifications switch is the first one

		fireEvent(cloudToggle, 'valueChange', true);

		await waitFor(() => {
			expect(AsyncStorage.setItem).toHaveBeenCalledWith('cloudNotificationsEnabled', 'true');
		});

		fireEvent(cloudToggle, 'valueChange', false);

		await waitFor(() => {
			expect(AsyncStorage.setItem).toHaveBeenCalledWith('cloudNotificationsEnabled', 'false');
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification1');
			expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification2');
		});
	});

	it('handles local notifications toggle correctly', async () => {
		const { getAllByRole } = render(<NotificationSettingsScreen />);
		const switches = getAllByRole('switch');
		const localToggle = switches[1]; // Local notifications switch is the second one

		fireEvent(localToggle, 'valueChange', true);

		await waitFor(() => {
			expect(AsyncStorage.setItem).toHaveBeenCalledWith('localNotificationsEnabled', 'true');
		});
	});

	it('preserves existing notifications when toggling on', async () => {
		const mockReminders = [
			{ id: 'reminder1', type: 'SCHEDULED' },
			{ id: 'reminder2', type: 'CUSTOM_DATE' },
		];

		const mockSnapshot = {
			docs: mockReminders.map((reminder) => ({
				id: reminder.id,
				data: () => reminder,
			})),
		};
		require('firebase/firestore').getDocs.mockResolvedValueOnce(mockSnapshot);

		const { getAllByRole } = render(<NotificationSettingsScreen />);
		const switches = getAllByRole('switch');
		const cloudToggle = switches[0]; // Cloud notifications switch is the first one

		fireEvent(cloudToggle, 'valueChange', true);

		await waitFor(() => {
			mockReminders.forEach((reminder) => {
				expect(
					require('../../utils/notifications/reminderSync').reminderSync.scheduleLocalNotification
				).toHaveBeenCalledWith(expect.objectContaining({ id: reminder.id }));
			});
		});
	});
});
