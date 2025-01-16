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
            border: '#ccc'
        }
    }),
    spacing: { md: 8, lg: 16, xl: 24 },
    layout: { borderRadius: { lg: 8 } }
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
