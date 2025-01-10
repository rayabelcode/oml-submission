import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ScheduleTab from '../contacts/tabs/ScheduleTab';

describe('ScheduleTab', () => {
	const mockContact = {
		id: 'test-id',
		scheduling: {
			frequency: 'weekly',
			custom_preferences: {
				preferred_days: ['monday', 'wednesday'],
			},
		},
	};

	test('renders frequency options correctly', () => {
		const { getByText } = render(<ScheduleTab contact={mockContact} setSelectedContact={() => {}} />);

		expect(getByText('Weekly')).toBeTruthy();
		expect(getByText('Monthly')).toBeTruthy();
	});

	test('handles frequency selection', async () => {
		const setSelectedContact = jest.fn();
		const { getByText } = render(
			<ScheduleTab contact={mockContact} setSelectedContact={setSelectedContact} />
		);

		fireEvent.press(getByText('Monthly'));
		await waitFor(() => {
			expect(setSelectedContact).toHaveBeenCalled();
		});
	});
});
