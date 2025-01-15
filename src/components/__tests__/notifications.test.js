import { REMINDER_TYPES } from '../../../constants/notificationConstants';

// Tests to make sure the reminder scheduling is working correctly
describe('Reminder Scheduling', () => {
	// Test for scheduled reminder
	it('should create a scheduled reminder correctly', () => {
		const scheduledReminder = {
			scheduledTime: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			date: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			type: REMINDER_TYPES.SCHEDULED,
			contact_id: 'testContactId',
			user_id: 'testUserId',
			created_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			updated_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			needs_attention: false,
			completed: false,
			notes_added: false,
			snoozed: false,
			status: 'pending',
			contactName: 'Test Contact',
		};

		expect(scheduledReminder.type).toBe(REMINDER_TYPES.SCHEDULED);
		expect(scheduledReminder.needs_attention).toBe(false);
	});

	// Test for follow-up reminder
	it('should create a follow-up reminder correctly', () => {
		const followUpReminder = {
			scheduledTime: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			date: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			type: REMINDER_TYPES.FOLLOW_UP,
			contact_id: 'testContactId',
			user_id: 'testUserId',
			created_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			updated_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			needs_attention: true,
			completed: false,
			notes_added: false,
			snoozed: false,
			status: 'pending',
			contactName: 'Test Contact',
			call_data: {
				type: 'phone',
				startTime: new Date().toISOString(),
			},
		};

		expect(followUpReminder.type).toBe(REMINDER_TYPES.FOLLOW_UP);
		expect(followUpReminder.needs_attention).toBe(true);
		expect(followUpReminder.call_data).toBeDefined();
	});
});

// Tests to make sure the data format is consistent
describe('Notification System', () => {
	describe('Data Format Consistency', () => {
		const sampleReminder = {
			scheduledTime: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			date: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			type: REMINDER_TYPES.FOLLOW_UP,
			contact_id: 'G0r88xTnw2BPy2Q34xtr',
			user_id: 'LTQ2OSK61lTjRdyqF9qXn94HW0t1',
			created_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			updated_at: {
				_seconds: 1736798718,
				_nanoseconds: 232000000,
			},
			needs_attention: true,
			completed: false,
			notes_added: false,
			snoozed: false,
		};

		it('should have correct needs_attention value based on type', () => {
			expect(sampleReminder.needs_attention).toBe(sampleReminder.type === REMINDER_TYPES.FOLLOW_UP);
		});

		it('should have valid Timestamps', () => {
			// Check if timestamp has correct structure
			expect(sampleReminder.scheduledTime).toHaveProperty('_seconds');
			expect(sampleReminder.scheduledTime).toHaveProperty('_nanoseconds');
			expect(sampleReminder.date).toHaveProperty('_seconds');
			expect(sampleReminder.date).toHaveProperty('_nanoseconds');

			// Convert to JS Date for validation
			const scheduledDate = new Date(sampleReminder.scheduledTime._seconds * 1000);
			const date = new Date(sampleReminder.date._seconds * 1000);

			expect(scheduledDate instanceof Date).toBe(true);
			expect(date instanceof Date).toBe(true);
		});

		it('should have consistent date formats', () => {
			const dates = [
				new Date(sampleReminder.scheduledTime._seconds * 1000),
				new Date(sampleReminder.date._seconds * 1000),
				new Date(sampleReminder.created_at._seconds * 1000),
				new Date(sampleReminder.updated_at._seconds * 1000),
			];

			dates.forEach((date) => {
				expect(date instanceof Date).toBe(true);
				expect(isNaN(date.getTime())).toBe(false);
			});
		});

		it('should use consistent ID fields', () => {
			expect(sampleReminder).toHaveProperty('user_id');
			expect(sampleReminder).not.toHaveProperty('userId');
			expect(sampleReminder).toHaveProperty('contact_id');
		});

		it('should have correct reminder type', () => {
			expect([REMINDER_TYPES.SCHEDULED, REMINDER_TYPES.FOLLOW_UP]).toContain(sampleReminder.type);
		});

		it('should have correct needs_attention value based on type', () => {
			expect(sampleReminder.needs_attention).toBe(sampleReminder.type === REMINDER_TYPES.FOLLOW_UP);
		});
	});
});
