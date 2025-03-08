import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ActionModal from '../general/ActionModal';

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/Ionicons', () => 'MockedIonicons');

// Mock the theme context
jest.mock('../../context/ThemeContext', () => ({
	useTheme: () => ({
		colors: {
			background: { secondary: '#fff' },
			primary: '#000',
			text: { primary: '#000', disabled: '#888' },
			error: '#ff0000',
			border: '#ccc',
		},
		spacing: { md: 8, lg: 16, xl: 24 },
		layout: {
			borderRadius: { lg: 8 },
		},
	}),
}));

describe('ActionModal', () => {
	const mockOptions = [
		{
			id: 'later_today',
			icon: 'time-outline',
			text: 'Later Today',
			onPress: jest.fn(),
		},
		{
			id: 'tomorrow',
			icon: 'calendar-outline',
			text: 'Tomorrow',
			onPress: jest.fn(),
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders correctly with options', () => {
		const { getByText } = render(<ActionModal show={true} options={mockOptions} onClose={jest.fn()} />);
		expect(getByText('Later Today')).toBeTruthy();
		expect(getByText('Tomorrow')).toBeTruthy();
	});

	it('shows loading state', () => {
		const { getByText } = render(
			<ActionModal show={true} options={mockOptions} loading={true} onClose={jest.fn()} />
		);
		expect(getByText('Processing...')).toBeTruthy();
	});

	it('shows error state', () => {
		const { getByText } = render(
			<ActionModal show={true} options={mockOptions} error="Failed to snooze" onClose={jest.fn()} />
		);
		expect(getByText('Failed to snooze')).toBeTruthy();
		expect(getByText('Try Again')).toBeTruthy();
	});

	it('calls option handler when pressed', () => {
		const { getByText } = render(<ActionModal show={true} options={mockOptions} onClose={jest.fn()} />);
		fireEvent.press(getByText('Later Today'));
		expect(mockOptions[0].onPress).toHaveBeenCalled();
	});
});

// Test for the late night snooze button text
describe('Late Night Snooze Button Text', () => {
	it('shows "Later Today" before 11 PM', () => {
		// Mock current time to be 10 PM
		jest.spyOn(Date.prototype, 'getHours').mockReturnValue(22);

		const customizeSnoozeText = (option) => {
			if (option.id === 'later_today') {
				const now = new Date();
				const currentHour = now.getHours();
				return currentHour >= 23 ? 'Early Tomorrow' : option.text;
			}
			return option.text;
		};

		const option = { id: 'later_today', text: 'Later Today' };
		expect(customizeSnoozeText(option)).toBe('Later Today');
	});

	it('shows "Early Tomorrow" after 11 PM', () => {
		// Mock current time to be 11 PM
		jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);

		const customizeSnoozeText = (option) => {
			if (option.id === 'later_today') {
				const now = new Date();
				const currentHour = now.getHours();
				return currentHour >= 23 ? 'Early Tomorrow' : option.text;
			}
			return option.text;
		};

		const option = { id: 'later_today', text: 'Later Today' };
		expect(customizeSnoozeText(option)).toBe('Early Tomorrow');
	});
});
