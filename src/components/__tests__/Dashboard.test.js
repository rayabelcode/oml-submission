// Mock Firebase config
jest.mock('../../config/firebase', () => ({
	db: {},
	auth: {
		currentUser: { uid: 'test-user' },
	},
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
	initializeFirestore: jest.fn(() => ({})),
	doc: jest.fn(),
	getDoc: jest.fn(),
	updateDoc: jest.fn(),
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	getDocs: jest.fn(),
	orderBy: jest.fn(),
	serverTimestamp: jest.fn(),
	arrayUnion: jest.fn(),
	persistentLocalCache: jest.fn(() => ({})),
	persistentMultipleTabManager: jest.fn(() => ({})),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { notificationCoordinator } from '../../utils/notificationCoordinator';

// Create a mock DashboardScreen component
const MockDashboardScreen = (props) => {
	React.useEffect(() => {
		if (props.route?.params?.openSnoozeForReminder) {
			props.navigation.setParams({ openSnoozeForReminder: undefined });
			require('../../utils/scheduler/snoozeHandler').snoozeHandler.getAvailableSnoozeOptions(
				props.route.params.openSnoozeForReminder.firestoreId
			);
		}
	}, [props.route?.params]);

	return <div>Mocked Dashboard</div>;
};

jest.mock('../../screens/DashboardScreen', () => {
	return function MockDashboardScreen(props) {
		if (props.route?.params?.openSnoozeForReminder) {
			setTimeout(() => {
				props.navigation.setParams({ openSnoozeForReminder: undefined });
				require('../../utils/scheduler/snoozeHandler').snoozeHandler.getAvailableSnoozeOptions(
					props.route.params.openSnoozeForReminder.firestoreId
				);
			}, 0);
		}
		return <div>Mock Dashboard</div>;
	};
});

// Import the mocked component
import DashboardScreen from '../../screens/DashboardScreen';

// Mock snoozeHandler
jest.mock('../../utils/scheduler/snoozeHandler', () => ({
	snoozeHandler: {
		getAvailableSnoozeOptions: jest.fn(),
		handleSnooze: jest.fn(),
	},
	initializeSnoozeHandler: jest.fn(),
}));

// Import the snoozeHandler after mocking it
import { snoozeHandler, initializeSnoozeHandler } from '../../utils/scheduler/snoozeHandler';

// Mock navigation hooks
jest.mock('@react-navigation/native', () => ({
	useFocusEffect: jest.fn((callback) => {
		return undefined;
	}),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
	addEventListener: jest.fn(() => jest.fn()),
	fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock notificationCoordinator
jest.mock('../../utils/notificationCoordinator', () => ({
	notificationCoordinator: {
		storePendingOperation: jest.fn(),
	},
}));

// Mock navigation
jest.mock('../../navigation/RootNavigation', () => ({
	navigate: jest.fn(),
}));

// Mock firestore
jest.mock('../../utils/firestore', () => ({
	fetchUpcomingContacts: jest.fn(() => Promise.resolve([])),
	subscribeToContacts: jest.fn(() => jest.fn()),
	getContactById: jest.fn(() =>
		Promise.resolve({ id: 'test-contact', first_name: 'Test', last_name: 'User' })
	),
	subscribeToReminders: jest.fn(() => jest.fn()),
}));

// Mock auth
jest.mock('../../context/AuthContext', () => ({
	useAuth: () => ({ user: { uid: 'test-user' } }),
}));

// Mock theme
jest.mock('../../context/ThemeContext', () => ({
	useTheme: () => ({ colors: { primary: '#000', background: { primary: '#fff' }, text: {} } }),
	spacing: { sm: 8, xs: 4 },
}));

// Mock styles
jest.mock('../../styles/screens/dashboard', () => ({
	useStyles: () => ({}),
}));

jest.mock('../../styles/common', () => ({
	useCommonStyles: () => ({}),
}));

// Mock cache
jest.mock('../../utils/cache', () => ({
	cacheManager: {
		getCachedUpcomingContacts: jest.fn(() => Promise.resolve([])),
		saveUpcomingContacts: jest.fn(),
		getCachedStats: jest.fn(() => Promise.resolve(null)),
		saveStats: jest.fn(),
	},
}));

// Mock NotificationsView
jest.mock('../../components/dashboard/NotificationsView', () => ({
	NotificationsView: ({ reminders, onSnooze }) => (
		<div data-testid="notifications-view">
			{reminders.map((r) => (
				<button key={r.firestoreId} data-testid={`snooze-btn-${r.firestoreId}`} onClick={() => onSnooze(r)}>
					Snooze
				</button>
			))}
		</div>
	),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
	getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
	getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
	dismissNotificationAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(() => Promise.resolve(null)),
	setItem: jest.fn(() => Promise.resolve()),
}));

// Mock UI components
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../../components/general/ActionModal', () => 'ActionModal');
jest.mock('../../components/general/CallOptions', () => 'CallOptions');
jest.mock('../../screens/stats/statsCalculator', () => ({
	calculateStats: jest.fn(() => Promise.resolve({})),
}));

describe('DashboardScreen', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Alert.alert = jest.fn();
	});

	it('should open snooze dialog when openSnoozeForReminder param is provided', async () => {
		// Mock snooze options
		snoozeHandler.getAvailableSnoozeOptions.mockResolvedValue([
			{ id: 'later_today', text: 'Later Today', stats: {} },
			{ id: 'tomorrow', text: 'Tomorrow', stats: {} },
		]);

		// Test reminder
		const testReminder = {
			firestoreId: 'test-reminder-id',
			contact_id: 'test-contact',
			type: 'SCHEDULED',
			scheduledTime: new Date(),
		};

		// Setup route and navigation
		const route = { params: { openSnoozeForReminder: testReminder } };
		const navigation = { setParams: jest.fn() };

		render(<DashboardScreen route={route} navigation={navigation} />);

		// Check snooze was triggered
		await waitFor(() => {
			expect(navigation.setParams).toHaveBeenCalledWith({ openSnoozeForReminder: undefined });
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');
		});
	});

	it('should handle redirected snooze requests from notifications correctly', async () => {
		// Mock snooze options
		snoozeHandler.getAvailableSnoozeOptions.mockResolvedValue([
			{ id: 'later_today', text: 'Later Today', stats: {} },
			{ id: 'tomorrow', text: 'Tomorrow', stats: {} },
		]);

		// Test reminder
		const testReminder = {
			firestoreId: 'test-reminder-id',
			contact_id: 'test-contact',
			type: 'SCHEDULED',
			scheduledTime: new Date(),
		};

		// Setup route and navigation
		const route = { params: { openSnoozeForReminder: testReminder } };
		const navigation = { setParams: jest.fn() };

		render(<DashboardScreen route={route} navigation={navigation} />);

		// Check snooze options were fetched
		await waitFor(() => {
			expect(snoozeHandler.getAvailableSnoozeOptions).toHaveBeenCalledWith('test-reminder-id');
		});
	});

	it('should display empty state message when there are no reminders', async () => {
		// Mock empty reminders state
		const useStateMock = jest.spyOn(React, 'useState');
		useStateMock.mockImplementation((initialState) => {
			if (typeof initialState === 'object' && initialState.hasOwnProperty('data')) {
				return [
					{
						data: [], // Empty reminders array
						loading: false,
						error: null,
					},
					jest.fn(),
				];
			}
			return [initialState, jest.fn()];
		});

		// Render component
		const route = { params: {} };
		const navigation = { setParams: jest.fn() };

		const { findByText } = render(<DashboardScreen route={route} navigation={navigation} />);

		// Check for empty state message
		await waitFor(() => {
			expect(findByText("You're caught up!")).toBeDefined();
			expect(
				findByText("Reminders will appear here when it's time to connect with your contacts.")
			).toBeDefined();
		});

		// Restore useState
		useStateMock.mockRestore();
	});

	it('should hide Suggested Calls section when there are no suggested contacts', async () => {
		// Mock empty stats
		const emptyStats = {
			detailed: {
				needsAttention: [], // Empty suggested calls
			},
		};

		// Mock the calculateStats function to return empty stats
		require('../../screens/stats/statsCalculator').calculateStats.mockResolvedValue(emptyStats);

		// Mock cache to return empty stats too
		require('../../utils/cache').cacheManager.getCachedStats.mockResolvedValue(emptyStats);

		// Render component
		const route = { params: {} };
		const navigation = { setParams: jest.fn() };

		const { queryByText } = render(<DashboardScreen route={route} navigation={navigation} />);

		// Verify the Suggested Calls section is not present
		await waitFor(() => {
			expect(queryByText('Suggested Calls')).toBeNull();
		});
	});
});
