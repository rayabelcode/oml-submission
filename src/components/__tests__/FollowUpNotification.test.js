import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FollowUpNotification } from '../../utils/FollowUpNotification';
import { completeFollowUp } from '../../utils/firestore';

jest.mock('../../utils/firestore', () => ({
	completeFollowUp: jest.fn(),
}));

describe('FollowUpNotification', () => {
	const mockReminder = {
		id: 'test-reminder-id',
		contact_name: 'John Doe',
		call_duration: 300, // 5 minutes
	};

	const mockOnComplete = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders correctly', () => {
		const { getByText, getByPlaceholderText } = render(
			<FollowUpNotification reminder={mockReminder} onComplete={mockOnComplete} />
		);

		expect(getByText('Add Call Notes')).toBeTruthy();
		expect(getByText('Call with John Doe (5 minutes)')).toBeTruthy();
		expect(getByPlaceholderText('Add notes about your call...')).toBeTruthy();
	});

	it('handles note input', () => {
		const { getByPlaceholderText } = render(
			<FollowUpNotification reminder={mockReminder} onComplete={mockOnComplete} />
		);

		const input = getByPlaceholderText('Add notes about your call...');
		fireEvent.changeText(input, 'Test notes');
		expect(input.props.value).toBe('Test notes');
	});

	it('completes follow-up with notes', async () => {
		completeFollowUp.mockResolvedValueOnce(true);

		const { getByText, getByPlaceholderText } = render(
			<FollowUpNotification reminder={mockReminder} onComplete={mockOnComplete} />
		);

		const input = getByPlaceholderText('Add notes about your call...');
		fireEvent.changeText(input, 'Test notes');

		const saveButton = getByText('Save Notes');
		fireEvent.press(saveButton);

		await waitFor(() => {
			expect(completeFollowUp).toHaveBeenCalledWith(mockReminder.id, 'Test notes');
			expect(mockOnComplete).toHaveBeenCalledWith(mockReminder.id);
		});
	});

	it('handles skip without notes', async () => {
		completeFollowUp.mockResolvedValueOnce(true);

		const { getByText } = render(
			<FollowUpNotification reminder={mockReminder} onComplete={mockOnComplete} />
		);

		const skipButton = getByText('Skip');
		fireEvent.press(skipButton);

		await waitFor(() => {
			expect(completeFollowUp).toHaveBeenCalledWith(mockReminder.id, '');
			expect(mockOnComplete).toHaveBeenCalledWith(mockReminder.id);
		});
	});
});
