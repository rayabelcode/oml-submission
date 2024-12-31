// src/components/__tests__/NotificationsView.test.js
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { NotificationsView } from '../dashboard/NotificationsView';

// Mock GestureHandler
jest.mock('react-native-gesture-handler', () => ({
	GestureHandlerRootView: ({ children }) => children,
	Swipeable: ({ children }) => children,
}));

// Mock ThemeContext
jest.mock('../../context/ThemeContext', () => ({
	useTheme: () => ({
		colors: {
			primary: '#000',
			text: { primary: '#000' },
			background: { primary: '#fff' },
			danger: '#ff0000',
		},
	}),
}));

// Mock styles
jest.mock('../../styles/screens/dashboard', () => ({
	useStyles: () => ({
		contactsList: {},
		message: {},
		card: {},
		cardName: {},
		cardDate: {},
		notificationsContainer: {},
	}),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
}));

// Mock Firebase
jest.mock('firebase/auth', () => ({
	getReactNativePersistence: jest.fn(),
	initializeAuth: jest.fn(),
	getAuth: jest.fn(),
}));

// Mock Firebase config
jest.mock('../../config/firebase', () => ({
	auth: {},
	db: {},
	app: {},
}));

// Mock FollowUpNotification component
jest.mock('../../utils/FollowUpNotification', () => ({
	FollowUpNotification: ({ reminder, onComplete }) => (
		<div data-testid="follow-up-notification">Mock FollowUpNotification</div>
	),
}));

describe('NotificationsView', () => {
	const mockReminders = [
		{
			firestoreId: 'reminder1',
			scheduledTime: '2024-12-31T17:21:18.881Z',
			localId: 'local1',
		},
		{
			firestoreId: 'reminder2',
			scheduledTime: '2024-12-31T18:21:18.881Z',
			localId: 'local2',
		},
	];

	const defaultProps = {
		reminders: mockReminders,
		onComplete: jest.fn(),
		loading: false,
		onRefresh: jest.fn(),
		refreshing: false,
	};

	const renderComponent = (props = defaultProps) => {
		return render(<NotificationsView {...props} />);
	};

	it('renders loading state', () => {
		const { getByText } = renderComponent({
			...defaultProps,
			loading: true,
		});
		expect(getByText('Loading notifications...')).toBeTruthy();
	});

	it('renders empty state', () => {
		const { getByText } = renderComponent({
			...defaultProps,
			reminders: [],
		});
		expect(getByText('No notifications')).toBeTruthy();
	});

	it('renders reminders', () => {
		const { getAllByText } = renderComponent();
		const elements = getAllByText('Add Call Notes');
		expect(elements.length).toBeGreaterThan(0);
	});
});
