import { jest } from '@jest/globals';
import { DateTime } from 'luxon';
import { SnoozeHandler } from '../../utils/snoozeHandler';

const REMINDER_STATUS = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	SNOOZED: 'snoozed',
	SKIPPED: 'skipped',
};

const SNOOZE_OPTIONS = [
	{
		id: 'later_today',
		icon: 'time-outline',
		text: 'Later Today',
		hours: 3,
	},
	{
		id: 'tomorrow',
		icon: 'calendar-outline',
		text: 'Tomorrow',
		days: 1,
	},
	{
		id: 'next_week',
		icon: 'calendar-outline',
		text: 'Next Week',
		days: 7,
	},
	{
		id: 'skip',
		icon: 'close-circle-outline',
		text: 'Skip This Call',
		type: 'skip',
	},
];

const MAX_SNOOZE_ATTEMPTS = 4;

jest.mock('../../utils/scheduler', () => ({
	SchedulingService: jest.fn().mockImplementation(() => ({
		findAvailableTimeSlot: jest.fn((date) => date),
		initialize: jest.fn(),
	})),
}));

jest.mock('../../utils/firestore', () => ({
	updateContactScheduling: jest.fn(),
	getUserPreferences: jest.fn(),
	getActiveReminders: jest.fn(),
}));

import { updateContactScheduling, getUserPreferences, getActiveReminders } from '../../utils/firestore';

describe('SnoozeHandler', () => {
	let snoozeHandler;
	const mockUserId = 'test-user-id';
	const mockContactId = 'test-contact-id';
	const mockTimezone = 'America/New_York';

	beforeEach(() => {
		jest.clearAllMocks();
		snoozeHandler = new SnoozeHandler(mockUserId, mockTimezone);
	});

	describe('Later Today Handling', () => {
		const testCases = [
			{
				name: 'regular hours (2 PM)',
				time: DateTime.fromObject({ hour: 14 }),
				expectedRange: { min: 150, max: 210 },
			},
			{
				name: 'early evening (6 PM)',
				time: DateTime.fromObject({ hour: 18 }),
				expectedRange: { min: 120, max: 150 },
			},
			{
				name: 'evening (8 PM)',
				time: DateTime.fromObject({ hour: 20 }),
				expectedRange: { min: 50, max: 80 },
			},
			{
				name: 'late night (11 PM)',
				time: DateTime.fromObject({ hour: 23 }),
				expectedRange: { min: 20, max: 40 },
			},
			{
				name: 'after midnight (1 AM)',
				time: DateTime.fromObject({ hour: 1 }),
				expectedRange: { min: 20, max: 40 },
			},
		];

		testCases.forEach(({ name, time, expectedRange }) => {
			it(`calculates correct delay range during ${name}`, async () => {
				await snoozeHandler.initialize();
				const result = await snoozeHandler.handleLaterToday(mockContactId, time);

				const minutesAdded = DateTime.fromJSDate(result).diff(time, 'minutes').minutes;

				expect(minutesAdded).toBeGreaterThanOrEqual(expectedRange.min);
				expect(minutesAdded).toBeLessThanOrEqual(expectedRange.max);
			});
		});

		it('respects gap requirements', async () => {
			await snoozeHandler.initialize();
			const mockSchedulingService = snoozeHandler.schedulingService;

			await snoozeHandler.handleLaterToday(mockContactId);

			expect(mockSchedulingService.findAvailableTimeSlot).toHaveBeenCalled();
		});

		it('updates contact scheduling with correct status', async () => {
			await snoozeHandler.handleLaterToday(mockContactId);

			expect(updateContactScheduling).toHaveBeenCalledWith(
				mockContactId,
				expect.objectContaining({
					last_snooze_type: 'later_today',
					status: REMINDER_STATUS.SNOOZED,
					snooze_count: { increment: 1 },
				})
			);
		});
	});

	describe('Tomorrow Handling', () => {
		it('schedules for next day at same time', async () => {
			const currentTime = DateTime.fromObject({ hour: 14 });
			await snoozeHandler.initialize();

			const result = await snoozeHandler.handleTomorrow(mockContactId, currentTime);

			const dayDiff = DateTime.fromJSDate(result).diff(currentTime, 'days').days;

			expect(Math.round(dayDiff)).toBe(1);
		});

		it('updates contact scheduling with tomorrow status', async () => {
			await snoozeHandler.handleTomorrow(mockContactId);

			expect(updateContactScheduling).toHaveBeenCalledWith(
				mockContactId,
				expect.objectContaining({
					last_snooze_type: 'tomorrow',
					status: REMINDER_STATUS.SNOOZED,
					snooze_count: { increment: 1 },
				})
			);
		});
	});

	describe('Next Week Handling', () => {
		it('schedules for next week at same time', async () => {
			const currentTime = DateTime.fromObject({ hour: 14 });
			await snoozeHandler.initialize();

			const result = await snoozeHandler.handleNextWeek(mockContactId, currentTime);

			const weekDiff = DateTime.fromJSDate(result).diff(currentTime, 'weeks').weeks;

			expect(Math.round(weekDiff)).toBe(1);
		});

		it('updates contact scheduling with next week status', async () => {
			await snoozeHandler.handleNextWeek(mockContactId);

			expect(updateContactScheduling).toHaveBeenCalledWith(
				mockContactId,
				expect.objectContaining({
					last_snooze_type: 'next_week',
					status: REMINDER_STATUS.SNOOZED,
					snooze_count: { increment: 1 },
				})
			);
		});
	});

	describe('Skip Handling', () => {
		it('updates contact with skip status', async () => {
			await snoozeHandler.handleSkip(mockContactId);

			expect(updateContactScheduling).toHaveBeenCalledWith(
				mockContactId,
				expect.objectContaining({
					custom_next_date: null,
					last_snooze_type: 'skip',
					status: REMINDER_STATUS.SKIPPED,
				})
			);
		});
	});

	describe('General Snooze Handling', () => {
		it('handles invalid snooze option', async () => {
			await expect(snoozeHandler.handleSnooze(mockContactId, 'invalid_option')).rejects.toThrow(
				'Invalid snooze option'
			);
		});

		it('routes to correct handler based on option', async () => {
			const spy = jest.spyOn(snoozeHandler, 'handleLaterToday');
			await snoozeHandler.handleSnooze(mockContactId, 'later_today');
			expect(spy).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('handles initialization failure gracefully', async () => {
			getUserPreferences.mockRejectedValueOnce(new Error('Network error'));
			await expect(snoozeHandler.initialize()).rejects.toThrow('Network error');
		});

		it('handles scheduling service failure', async () => {
			await snoozeHandler.initialize();
			snoozeHandler.schedulingService.findAvailableTimeSlot.mockRejectedValueOnce(
				new Error('No slots available')
			);

			await expect(snoozeHandler.handleLaterToday(mockContactId)).rejects.toThrow('No slots available');
		});

		it('handles updateContactScheduling failure', async () => {
			updateContactScheduling.mockRejectedValueOnce(new Error('Update failed'));

			await expect(snoozeHandler.handleSkip(mockContactId)).rejects.toThrow('Update failed');
		});
	});
});
