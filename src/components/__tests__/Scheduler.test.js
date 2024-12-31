import { SchedulingService } from '../../utils/scheduler';

describe('SchedulingService', () => {
	const mockUserPreferences = {
		scheduling_preferences: {
			global_excluded_times: [
				{
					days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
					start: '23:00',
					end: '07:00',
				},
			],
			relationship_types: {
				work: {
					active_hours: {
						start: '09:00',
						end: '17:00',
					},
					excluded_times: [
						{
							days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
							start: '12:00',
							end: '13:00',
						},
					],
					preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
				},
				friend: {
					active_hours: {
						start: '17:00',
						end: '21:00',
					},
					excluded_times: [],
					preferred_days: ['friday', 'saturday', 'sunday'],
				},
			},
		},
	};

	test('schedules work contact during business hours', async () => {
		const existingReminders = [];
		const mockWorkContact = {
			id: 'work123',
			relationship_type: 'work',
			scheduling: {
				priority: 'normal',
				frequency: 'weekly',
			},
		};

		const scheduler = new SchedulingService(mockUserPreferences, existingReminders, 'America/New_York');
		const lastContactDate = new Date('2024-01-08'); // A Monday

		const result = await scheduler.scheduleReminder(mockWorkContact, lastContactDate, 'weekly');

		const scheduledTime = result.date.toDate();
		const hours = scheduledTime.getHours();
		const day = scheduledTime.getDay();

		// Verify work contact scheduling rules
		expect(hours).toBeGreaterThanOrEqual(9); // After 9 AM
		expect(hours).toBeLessThanOrEqual(17); // Before 5 PM
		expect(day).toBeGreaterThanOrEqual(1); // Monday
		expect(day).toBeLessThanOrEqual(5); // Friday
		expect(hours).not.toBe(12); // Not during lunch hour
	});

	test('schedules friend contact during evening/weekend hours', async () => {
		const existingReminders = [];
		const mockFriendContact = {
			id: 'friend123',
			relationship_type: 'friend',
			scheduling: {
				priority: 'normal',
				frequency: 'weekly',
			},
		};

		const scheduler = new SchedulingService(mockUserPreferences, existingReminders, 'America/New_York');
		const lastContactDate = new Date('2024-01-08');

		const result = await scheduler.scheduleReminder(mockFriendContact, lastContactDate, 'weekly');

		const scheduledTime = result.date.toDate();
		const hours = scheduledTime.getHours();
		const day = scheduledTime.getDay();

		// Verify friend contact scheduling rules
		expect(hours).toBeGreaterThanOrEqual(17); // After 5 PM
		expect(hours).toBeLessThanOrEqual(21); // Before 9 PM
		expect([0, 5, 6]).toContain(day); // Sunday, Friday, or Saturday
	});

	test('respects global excluded times', async () => {
		const existingReminders = [];
		const mockContact = {
			id: 'test123',
			relationship_type: 'work',
			scheduling: {
				priority: 'normal',
				frequency: 'weekly',
			},
		};

		const scheduler = new SchedulingService(mockUserPreferences, existingReminders, 'America/New_York');
		const lastContactDate = new Date('2024-01-08');

		const result = await scheduler.scheduleReminder(mockContact, lastContactDate, 'weekly');

		const scheduledTime = result.date.toDate();
		const hours = scheduledTime.getHours();

		// Verify global excluded times are respected
		expect(hours).not.toBeLessThan(7); // Not before 7 AM
		expect(hours).not.toBeGreaterThan(23); // Not after 11 PM
	});

	test('handles missing relationship preferences gracefully', async () => {
		const mockUserPrefsNoRelationships = {
			scheduling_preferences: { global_excluded_times: [] },
		};

		const mockContact = {
			id: 'test123',
			relationship_type: 'work',
			scheduling: { priority: 'normal', frequency: 'weekly' },
		};

		const scheduler = new SchedulingService(mockUserPrefsNoRelationships, [], 'America/New_York');
		const result = await scheduler.scheduleReminder(mockContact, new Date('2024-01-08'), 'weekly');

		expect(result).toBeDefined();
		expect(result.date).toBeDefined();
	});

	test('handles undefined relationship type', async () => {
		const mockContact = {
			id: 'test123',
			scheduling: { priority: 'normal', frequency: 'weekly' },
		};

		const scheduler = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		const result = await scheduler.scheduleReminder(mockContact, new Date('2024-01-08'), 'weekly');

		expect(result).toBeDefined();
		expect(result.date).toBeDefined();
	});
});
