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

		const callButtons = getAllByText('Call');
		expect(callButtons).toHaveLength(2);
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

        expect(getAllByText('Call')).toHaveLength(2);
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
});
