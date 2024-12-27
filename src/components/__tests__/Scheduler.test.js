import { SchedulingService } from '../../utils/scheduler';

// Mock Timestamp at the top of the test file
jest.mock('firebase/firestore', () => ({
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
		}),
		now: () => ({
			toDate: () => new Date(),
			seconds: Math.floor(Date.now() / 1000),
			nanoseconds: (Date.now() % 1000) * 1000000,
		}),
	},
}));

describe('SchedulingService', () => {
	test('schedules reminders correctly', async () => {
		// Mock user preferences
		const userPreferences = {
			preferredDays: ['monday', 'wednesday', 'friday'],
			preferredTimeRanges: [{ start: '09:00', end: '17:00' }],
		};

		// Mock existing reminders
		const existingReminders = [
			{
				date: {
					toDate: () => new Date('2024-01-15T10:00:00'),
				},
			},
			{
				date: {
					toDate: () => new Date('2024-01-15T14:00:00'),
				},
			},
		];

		const mockContact = {
			id: '123',
			scheduling: {
				priority: 'high',
				frequency: 'weekly',
			},
		};

		const scheduler = new SchedulingService(userPreferences, existingReminders, 'America/New_York');
		const lastContactDate = new Date('2024-01-08');

		const result = await scheduler.scheduleReminder(mockContact, lastContactDate, 'weekly');

		expect(result).toBeDefined();
		expect(result.contact_id).toBe('123');
		expect(result.score).toBeGreaterThan(0);
	});
});
