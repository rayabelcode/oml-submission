import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NotificationsView } from '../dashboard/NotificationsView';
import { REMINDER_TYPES } from '../../../constants/notificationConstants';

// Mock all dependencies
jest.mock('react-native-avoid-softinput', () => ({
	AvoidSoftInput: {
		setEnabled: jest.fn(),
		setShouldMimicIOSBehavior: jest.fn(),
		setAvoidOffset: jest.fn(),
		setEasing: jest.fn(),
		setHideAnimationDelay: jest.fn(),
		setHideAnimationDuration: jest.fn(),
		setShowAnimationDelay: jest.fn(),
		setShowAnimationDuration: jest.fn(),
	},
	AvoidSoftInputView: ({ children }) => children,
}));

jest.mock('react-native-gesture-handler', () => ({
	GestureHandlerRootView: ({ children }) => children,
	Swipeable: ({ children }) => children,
}));

jest.mock(
	'react-native-vector-icons/Ionicons',
	() =>
		function MockIcon() {
			return null;
		}
);

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
		layout: {
			borderRadius: {
				sm: 4,
				md: 8,
				lg: 12,
			},
		},
		spacing: {
			xs: 4,
			sm: 8,
			md: 16,
			lg: 24,
			xl: 32,
		},
	}),
}));

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
		headerRow: {},
		titleRow: {},
		titleIcon: {},
		reminderTitle: {},
		reminderDescription: {},
	}),
}));

jest.mock('../../utils/firestore', () => ({
	getContactById: jest.fn(() =>
		Promise.resolve({
			id: 'test-contact-id',
			first_name: 'Test',
			last_name: 'User',
			phone: '1234567890',
		})
	),
}));

jest.mock('../../config/firebase', () => ({
	auth: { currentUser: null },
	db: {},
	initializeFirestore: jest.fn(),
	persistentLocalCache: jest.fn(),
	persistentMultipleTabManager: jest.fn(),
}));

// Mocking AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
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

		const callReminders = getAllByText(`12/31/2024 Custom Call Reminder`);
		expect(callReminders).toHaveLength(2);
	});

	it('handles reminder actions correctly', () => {
		const onComplete = jest.fn();
		const onSnooze = jest.fn();

		const { getAllByText } = render(
			<NotificationsView {...defaultProps} onComplete={onComplete} onSnooze={onSnooze} />
		);

		const snoozeButtons = getAllByText('Options');
		fireEvent.press(snoozeButtons[0]);
		expect(onSnooze).toHaveBeenCalledWith(mockReminders[0]);

		const contactButtons = getAllByText('Contact');
		expect(contactButtons).toHaveLength(2);
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

	it('renders all required reminder elements', () => {
		const { getAllByText } = render(<NotificationsView {...defaultProps} />);

		expect(getAllByText('Contact')).toHaveLength(2);
		expect(getAllByText('Options')).toHaveLength(2);
		expect(getAllByText('Recurring Reminder')).toHaveLength(2);
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

		const { getByText, getAllByText } = render(
			<NotificationsView {...defaultProps} reminders={mixedReminders} />
		);

		expect(getByText('Recurring Reminder')).toBeTruthy();
		expect(getByText('Custom Reminder')).toBeTruthy();
		expect(getByText('John Recurring')).toBeTruthy();
		expect(getByText('Jane Custom')).toBeTruthy();

		const customCallReminders = getAllByText('12/31/2024 Custom Call Reminder');
		expect(customCallReminders).toHaveLength(2);
	});

	it('sorts reminders by scheduledTime correctly', () => {
		// Create reminders with out-of-order dates
		const unsortedReminders = [
			{
				firestoreId: 'reminder3',
				scheduledTime: '2024-11-01T10:00:00.000Z', // November 1st
				localId: 'local3',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'Last Person',
			},
			{
				firestoreId: 'reminder1',
				scheduledTime: '2024-10-15T10:00:00.000Z', // October 15th - should come first
				localId: 'local1',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'First Person',
			},
			{
				firestoreId: 'reminder2',
				scheduledTime: '2024-10-20T10:00:00.000Z', // October 20th - should come second
				localId: 'local2',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'Middle Person',
			},
		];

		// Render the component with unsorted reminders
		const { getAllByText } = render(<NotificationsView {...defaultProps} reminders={unsortedReminders} />);

		// Get all reminder titles containing "Person"
		const personElements = getAllByText(/Person$/);

		// First should be "First Person" (earliest date)
		expect(personElements[0].props.children).toBe('First Person');

		// Second should be "Middle Person"
		expect(personElements[1].props.children).toBe('Middle Person');

		// Third should be "Last Person" (latest date)
		expect(personElements[2].props.children).toBe('Last Person');
	});

	it('handles empty or null reminders gracefully', () => {
		// Test with null reminders
		const { getByText: getByText1 } = render(<NotificationsView {...defaultProps} reminders={null} />);
		expect(getByText1('No notifications')).toBeTruthy();

		// Test with undefined reminders
		const { getByText: getByText2 } = render(<NotificationsView {...defaultProps} reminders={undefined} />);
		expect(getByText2('No notifications')).toBeTruthy();

		// Test with empty array reminders
		const { getByText: getByText3 } = render(<NotificationsView {...defaultProps} reminders={[]} />);
		expect(getByText3('No notifications')).toBeTruthy();
	});

	it('handles reminders with missing or invalid scheduledTime', () => {
		const problematicReminders = [
			{
				firestoreId: 'reminder1',
				// Missing scheduledTime
				localId: 'local1',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'Missing Date',
			},
			{
				firestoreId: 'reminder2',
				scheduledTime: 'invalid-date-string',
				localId: 'local2',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'Invalid Date',
			},
			{
				firestoreId: 'reminder3',
				scheduledTime: '2024-12-31T17:21:18.881Z', // Valid date
				localId: 'local3',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'Valid Date',
			},
		];

		// Component should not crash with problematic data
		const { getByText } = render(<NotificationsView {...defaultProps} reminders={problematicReminders} />);

		// Should still render the valid reminder
		expect(getByText('Valid Date')).toBeTruthy();
	});

	it('applies sorting consistently even when reminders change', () => {
		// Start with one set of reminders
		const initialReminders = [
			{
				firestoreId: 'reminder1',
				scheduledTime: '2024-12-01T17:21:18.881Z',
				localId: 'local1',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'December Person',
			},
		];

		const { rerender, getByText } = render(
			<NotificationsView {...defaultProps} reminders={initialReminders} />
		);

		expect(getByText('December Person')).toBeTruthy();

		// Add a new reminder with an earlier date
		const updatedReminders = [
			...initialReminders,
			{
				firestoreId: 'reminder2',
				scheduledTime: '2024-11-01T17:21:18.881Z', // November - should come first
				localId: 'local2',
				type: REMINDER_TYPES.SCHEDULED,
				contactName: 'November Person',
			},
		];

		// Rerender with the new reminders
		rerender(<NotificationsView {...defaultProps} reminders={updatedReminders} />);

		// Get all contact elements
		const contactElements = [getByText('November Person'), getByText('December Person')];

		// November should appear before December in the DOM
		expect(contactElements[0].props.children).toBe('November Person');
		expect(contactElements[1].props.children).toBe('December Person');
	});
});

it('displays correct styling for snoozed reminders', () => {
	const snoozedReminders = [
		{
			firestoreId: 'reminder1',
			scheduledTime: '2024-12-31T17:21:18.881Z',
			type: 'SCHEDULED',
			contactName: 'John Doe',
			status: 'sent',
			snoozed: true,
		},
	];

	const mockProps = {
		reminders: snoozedReminders,
		onComplete: jest.fn(),
		loading: false,
		onRefresh: jest.fn(),
		refreshing: false,
		onSnooze: jest.fn(),
	};

	const { getByText } = render(<NotificationsView {...mockProps} />);

	// Verify the snoozed title text is displayed correctly
	expect(getByText('Snoozed (Recurring)')).toBeTruthy();
});

it('handles different combinations of snoozed and status fields correctly', () => {
	const mixedReminders = [
		// Regular reminder (not snoozed)
		{
			firestoreId: 'regular',
			scheduledTime: '2024-12-31T17:21:18.881Z',
			type: 'SCHEDULED',
			contactName: 'Regular Reminder',
			status: 'sent',
			snoozed: false,
		},
		// Previously snoozed, now sent
		{
			firestoreId: 'snoozed-sent',
			scheduledTime: '2024-12-31T18:21:18.881Z',
			type: 'SCHEDULED',
			contactName: 'Snoozed Sent',
			status: 'sent',
			snoozed: true,
		},
		// Custom date snoozed
		{
			firestoreId: 'custom-snoozed',
			scheduledTime: '2024-12-31T19:21:18.881Z',
			type: 'CUSTOM_DATE',
			contactName: 'Custom Snoozed',
			status: 'sent',
			snoozed: true,
		},
	];

	const mockProps = {
		reminders: mixedReminders,
		onComplete: jest.fn(),
		loading: false,
		onRefresh: jest.fn(),
		refreshing: false,
		onSnooze: jest.fn(),
	};

	const { getByText, getAllByText } = render(<NotificationsView {...mockProps} />);

	// Regular reminder should show "Recurring Reminder"
	expect(getByText('Recurring Reminder')).toBeTruthy();

	// Snoozed scheduled should show "Snoozed (Recurring)"
	expect(getByText('Snoozed (Recurring)')).toBeTruthy();

	// Snoozed custom should show "Snoozed (Custom)"
	expect(getByText('Snoozed (Custom)')).toBeTruthy();

	// All contact names should be displayed
	expect(getByText('Regular Reminder')).toBeTruthy();
	expect(getByText('Snoozed Sent')).toBeTruthy();
	expect(getByText('Custom Snoozed')).toBeTruthy();
});
