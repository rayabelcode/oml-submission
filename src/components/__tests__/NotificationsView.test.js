import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NotificationsView } from '../dashboard/NotificationsView';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';

// Mock GestureHandler
jest.mock('react-native-gesture-handler', () => ({
	GestureHandlerRootView: ({ children }) => children,
	Swipeable: ({ children }) => children,
}));

// Mock Ionicons
jest.mock(
	'react-native-vector-icons/Ionicons',
	() =>
		function MockIcon(props) {
			return null;
		}
);

// Mock ThemeContext
jest.mock('../../context/ThemeContext', () => ({
	useTheme: () => ({
		colors: {
			primary: '#000',
			secondary: '#666',
			success: '#4CAF50',
			danger: '#ff0000',
			text: {
				primary: '#000',
				secondary: '#666',
			},
			background: {
				primary: '#fff',
				secondary: '#f5f5f5',
				tertiary: '#e0e0e0',
			},
			border: '#ddd',
		},
	}),
}));

// Mock styles
jest.mock('../../styles/screens/dashboard', () => ({
	useStyles: () => ({
		contactsList: {},
		message: {},
		card: {},
		cardContent: {},
		cardActions: {},
		actionButton: {},
		actionText: {},
		notificationsContainer: {},
		cardName: {},
		cardDate: {},
		actionButtonSeparator: {},
		notesContainer: {},
		notesInput: {},
		submitButton: {},
		submitButtonText: {},
		submitButtonDisabled: {},
	}),
}));

describe('NotificationsView', () => {
	const mockReminders = [
		{
			firestoreId: 'reminder1',
			scheduledTime: '2024-12-31T17:21:18.881Z',
			localId: 'local1',
			type: REMINDER_TYPES.SCHEDULED,
			contactName: 'John Doe',
		},
		{
			firestoreId: 'reminder2',
			scheduledTime: '2024-12-31T18:21:18.881Z',
			localId: 'local2',
			type: REMINDER_TYPES.SCHEDULED,
			contactName: 'Jane Smith',
		},
	];

	const defaultProps = {
		reminders: mockReminders,
		onComplete: jest.fn(),
		loading: false,
		onRefresh: jest.fn(),
		refreshing: false,
		onSnooze: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders loading state', () => {
		const { getByText } = render(<NotificationsView {...defaultProps} loading={true} />);
		expect(getByText('Loading notifications...')).toBeTruthy();
	});

	it('renders empty state', () => {
		const { getByText } = render(<NotificationsView {...defaultProps} reminders={[]} />);
		expect(getByText('No notifications')).toBeTruthy();
	});

	it('renders scheduled reminders correctly', () => {
		const { getAllByText, getByText } = render(<NotificationsView {...defaultProps} />);

		// Check for Recurring Call label
		const recurringCallLabels = getAllByText('Recurring Call');
		expect(recurringCallLabels).toHaveLength(2);

		// Check for specific reminder texts
		expect(getByText(/Call John Doe.*Dec 31, 2024/)).toBeTruthy();
		expect(getByText(/Call Jane Smith.*Dec 31, 2024/)).toBeTruthy();
	});

	it('handles reminder actions correctly', () => {
		const onComplete = jest.fn();
		const onSnooze = jest.fn();

		const { getAllByText } = render(
			<NotificationsView {...defaultProps} onComplete={onComplete} onSnooze={onSnooze} />
		);

		// Test Complete action
		const completeButtons = getAllByText('Complete');
		fireEvent.press(completeButtons[0]);
		expect(onComplete).toHaveBeenCalledWith(mockReminders[0].firestoreId);

		// Test Snooze action
		const snoozeButtons = getAllByText('Snooze');
		fireEvent.press(snoozeButtons[0]);
		expect(onSnooze).toHaveBeenCalledWith(mockReminders[0]);
	});

	it('renders all required reminder elements', () => {
		const { getAllByText } = render(<NotificationsView {...defaultProps} />);

		// Check for action buttons
		expect(getAllByText('Complete')).toHaveLength(2);
		expect(getAllByText('Snooze')).toHaveLength(2);

		// Check for reminder labels
		expect(getAllByText('Recurring Call')).toHaveLength(2);
	});

	it('renders custom date reminders correctly', () => {
		const customDateReminders = [
			{
				firestoreId: 'reminder3',
				scheduledTime: '2024-12-31T17:21:18.881Z',
				localId: 'local3',
				type: REMINDER_TYPES.CUSTOM_DATE,
				contactName: 'Bob Custom',
			},
		];

		const { getByText } = render(<NotificationsView {...defaultProps} reminders={customDateReminders} />);

		// Check for Custom Call label
		expect(getByText('Custom Call')).toBeTruthy();
		expect(getByText(/Call Bob Custom.*Dec 31, 2024/)).toBeTruthy();
	});

	it('renders mixed reminder types correctly', () => {
		const mixedReminders = [
			{
				firestoreId: 'reminder1',
				scheduledTime: '2024-12-31T17:21:18.881Z',
				localId: 'local1',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'John Recurring',
			},
			{
				firestoreId: 'reminder2',
				scheduledTime: '2024-12-31T18:21:18.881Z',
				localId: 'local2',
				type: REMINDER_TYPES.CUSTOM_DATE,
				contactName: 'Jane Custom',
			},
		];

		const { getByText } = render(<NotificationsView {...defaultProps} reminders={mixedReminders} />);

		expect(getByText('Recurring Call')).toBeTruthy();
		expect(getByText('Custom Call')).toBeTruthy();
		expect(getByText(/Call John Recurring.*Dec 31, 2024/)).toBeTruthy();
		expect(getByText(/Call Jane Custom.*Dec 31, 2024/)).toBeTruthy();
	});
});
