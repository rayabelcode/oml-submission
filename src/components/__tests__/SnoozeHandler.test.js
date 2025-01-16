import { jest } from '@jest/globals';
import { DateTime } from 'luxon';
import { SnoozeHandler } from '../../utils/snoozeHandler';

// Supress console.error
beforeAll(() => {
	jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
	jest.restoreAllMocks();
});

// Constants
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

// Mocks
jest.mock('../../utils/schedulingHistory', () => ({
	schedulingHistory: {
		initialize: jest.fn(),
		analyzeContactPatterns: jest.fn().mockResolvedValue({
			successRates: {
				byHour: {
					14: { successRate: 0.9, attempts: 10 },
					15: { successRate: 0.8, attempts: 8 },
					10: { successRate: 0.7, attempts: 5 },
				},
			},
			recentAttempts: 23,
			confidence: 0.8,
		}),
		trackSnooze: jest.fn(),
		trackSkip: jest.fn(),
		trackSuccessfulAttempt: jest.fn(),
	},
}));

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
	getContactById: jest.fn().mockResolvedValue({
		scheduling: { frequency: 'monthly' },
	}),
}));

// Imports
import { updateContactScheduling, getUserPreferences, getActiveReminders } from '../../utils/firestore';
import { schedulingHistory } from '../../utils/schedulingHistory';

describe('SnoozeHandler', () => {
	let snoozeHandler;
	const mockUserId = 'test-user-id';
	const mockContactId = 'test-contact-id';
	const mockTimezone = 'America/New_York';

	beforeEach(() => {
		jest.clearAllMocks();
		snoozeHandler = new SnoozeHandler(mockUserId, mockTimezone);
		snoozeHandler.clearPatternCache();
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

	// Pattern Based Scheduling
	describe('Pattern-based Scheduling', () => {
		beforeEach(() => {
			jest.clearAllMocks();
			snoozeHandler = new SnoozeHandler(mockUserId, mockTimezone);
		});

		it('uses pattern analysis for optimal time selection', async () => {
			await snoozeHandler.initialize();
			const currentTime = DateTime.fromObject({ hour: 9 });

			const optimalTime = await snoozeHandler.findOptimalTime(mockContactId, currentTime, 'tomorrow');

			// Should find a time within 3 hours of current time
			expect(optimalTime).toBeDefined();
			expect(Math.abs(optimalTime.hour - currentTime.hour)).toBeLessThanOrEqual(3);

			// Test handleTomorrow integration
			const result = await snoozeHandler.handleTomorrow(mockContactId, currentTime);
			const scheduledTime = DateTime.fromJSDate(result);

			// Should be roughly one day later (using Math.round to handle DST and timezone differences)
			const dayDiff = scheduledTime.diff(currentTime, 'days').days;
			expect(Math.round(dayDiff)).toBe(1);

			// Should be within working hours
			expect(scheduledTime.hour).toBeGreaterThanOrEqual(9);
			expect(scheduledTime.hour).toBeLessThanOrEqual(17);
		});

		it('falls back to default timing when no patterns available', async () => {
			schedulingHistory.analyzeContactPatterns.mockResolvedValueOnce(null);

			await snoozeHandler.initialize();
			const currentTime = DateTime.fromObject({ hour: 14 });
			const result = await snoozeHandler.handleLaterToday(mockContactId, currentTime);

			const minutesAdded = DateTime.fromJSDate(result).diff(currentTime, 'minutes').minutes;
			expect(minutesAdded).toBeGreaterThanOrEqual(150);
			expect(minutesAdded).toBeLessThanOrEqual(210);
		});

		it('tracks snooze patterns', async () => {
			await snoozeHandler.initialize();
			await snoozeHandler.handleLaterToday(mockContactId);

			expect(schedulingHistory.trackSnooze).toHaveBeenCalledWith(
				mockContactId,
				expect.any(DateTime),
				expect.any(DateTime),
				'later_today'
			);
		});

		it('tracks skip patterns', async () => {
			await snoozeHandler.initialize();
			await snoozeHandler.handleSkip(mockContactId);

			expect(schedulingHistory.trackSkip).toHaveBeenCalledWith(mockContactId, expect.any(DateTime));
		});
	});
});
