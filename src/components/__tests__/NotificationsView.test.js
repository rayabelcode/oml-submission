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
			warning: '#FF9500',
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
			reminderTypes: {
				follow_up: '#1C2733',
				scheduled: '#1C291C',
				custom_date: '#291C33',
			},
		},
		theme: 'light',
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

		const recurringReminders = getAllByText('Recurring Reminder');
		expect(recurringReminders).toHaveLength(2);

		expect(getByText('John Doe')).toBeTruthy();
		expect(getByText('Jane Smith')).toBeTruthy();

		const callReminders = getAllByText('12/31/2024 (weekly) Call Reminder');
		expect(callReminders).toHaveLength(2);
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

		expect(getAllByText('Recurring Reminder')).toHaveLength(2);
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

		expect(getByText('Custom Reminder')).toBeTruthy();
		expect(getByText('Bob Custom')).toBeTruthy();
		expect(getByText('12/31/2024 Custom Call Reminder')).toBeTruthy();
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

		expect(getByText('Recurring Reminder')).toBeTruthy();
		expect(getByText('Custom Reminder')).toBeTruthy();
		expect(getByText('John Recurring')).toBeTruthy();
		expect(getByText('Jane Custom')).toBeTruthy();
		expect(getByText('12/31/2024 (weekly) Call Reminder')).toBeTruthy();
		expect(getByText('12/31/2024 Custom Call Reminder')).toBeTruthy();
	});
});
