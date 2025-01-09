import { jest } from '@jest/globals';
import { SchedulingService } from '../../utils/scheduler';
import { DateTime } from 'luxon';

jest.mock('firebase/firestore', () => ({
	Timestamp: {
		fromDate: (date) => ({
			toDate: () => date,
			_seconds: Math.floor(date.getTime() / 1000),
			_nanoseconds: (date.getTime() % 1000) * 1000000,
		}),
		now: () => {
			const now = new Date();
			return {
				toDate: () => now,
				_seconds: Math.floor(now.getTime() / 1000),
				_nanoseconds: (now.getTime() % 1000) * 1000000,
			};
		},
	},
}));

describe('SchedulingService', () => {
	let schedulingService;
	const mockUserPreferences = {
		scheduling_preferences: {
			relationship_types: {
				friend: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['monday', 'wednesday', 'friday'],
					excluded_times: [],
				},
				work: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
					excluded_times: [
						{
							days: ['monday', 'wednesday', 'friday'],
							start: '12:00',
							end: '13:00',
						},
					],
				},
			},
			global_excluded_times: [
				{
					days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
					start: '23:00',
					end: '07:00',
				},
			],
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});

	describe('Basic Functionality', () => {
		it('should initialize with correct preferences', () => {
			expect(schedulingService.preferences).toBeDefined();
			expect(schedulingService.relationshipPreferences).toBeDefined();
			expect(schedulingService.globalExcludedTimes).toBeDefined();
		});

		it('should handle missing preferences gracefully', () => {
			const serviceWithNoPrefs = new SchedulingService(null, [], 'America/New_York');
			expect(serviceWithNoPrefs.relationshipPreferences).toEqual({});
			expect(serviceWithNoPrefs.globalExcludedTimes).toEqual([]);
		});
	});

	describe('Date Calculations', () => {
		it('should calculate preliminary date correctly', () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			const result = schedulingService.calculatePreliminaryDate(startDate, 'weekly');
			expect(result.getTime()).toBe(new Date('2024-01-08T12:00:00Z').getTime());
		});

		it('should handle invalid frequency', () => {
			const startDate = new Date('2024-01-01T12:00:00Z');
			expect(() => {
				schedulingService.calculatePreliminaryDate(startDate, 'invalid');
			}).toThrow('Invalid frequency: invalid');
		});
	});

	describe('Time Blocking', () => {
		const mockContact = {
			scheduling: {
				relationship_type: 'work',
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
				},
			},
		};

		it('should block default iOS reminder times', () => {
			const defaultTime = new Date('2024-01-01T09:00:00');
			expect(schedulingService.isTimeBlocked(defaultTime, mockContact)).toBeTruthy();

			const nonBlockedTime = new Date('2024-01-01T10:00:00');
			expect(schedulingService.isTimeBlocked(nonBlockedTime, mockContact)).toBeFalsy();
		});

		it('should respect global excluded times', () => {
			const nightTime = DateTime.fromObject(
				{ hour: 23, minute: 30 },
				{ zone: 'America/New_York' }
			).toJSDate();

			const earlyMorning = DateTime.fromObject(
				{ hour: 6, minute: 30 },
				{ zone: 'America/New_York' }
			).toJSDate();

			const dayTime = DateTime.fromObject({ hour: 10, minute: 0 }, { zone: 'America/New_York' }).toJSDate();

			expect(schedulingService.isTimeBlocked(nightTime, mockContact)).toBeTruthy();
			expect(schedulingService.isTimeBlocked(earlyMorning, mockContact)).toBeTruthy();
			expect(schedulingService.isTimeBlocked(dayTime, mockContact)).toBeFalsy();
		});

		it('should handle work hours correctly', () => {
			const workContact = {
				scheduling: {
					relationship_type: 'work',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Set to Monday at 12:30 PM
			const lunchTime = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1, hour: 12, minute: 30 },
				{ zone: 'America/New_York' }
			).toJSDate();

			expect(schedulingService.isTimeBlocked(lunchTime, workContact)).toBeTruthy();
		});
	});

	describe('Edge Cases', () => {
		const mockContact = {
			id: 'test-id',
			scheduling: {
				relationship_type: 'friend',
				priority: 'high',
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
				},
			},
		};

		it('should handle DST transitions', () => {
			const dstTransitionDate = DateTime.fromObject(
				{ year: 2024, month: 3, day: 10, hour: 1, minute: 30 },
				{ zone: 'America/New_York' }
			);

			const result = DateTime.fromJSDate(
				schedulingService.calculatePreliminaryDate(dstTransitionDate.toJSDate(), 'weekly')
			).setZone('America/New_York');

			console.log('DST transition test:', {
				original: dstTransitionDate.toLocaleString(DateTime.DATETIME_FULL),
				result: result.toLocaleString(DateTime.DATETIME_FULL),
			});

			expect(result.hour).toBe(2);
			expect(result.minute).toBe(30);
		});

		it('should handle timezone edge cases', () => {
			const tzService = new SchedulingService(mockUserPreferences, [], 'Asia/Tokyo');

			const baseDate = new Date('2024-01-01T23:00:00');
			const result = tzService.findAvailableTimeSlot(baseDate, mockContact);

			console.log('Timezone test:', {
				original: baseDate.toLocaleString(),
				result: DateTime.fromJSDate(result).setZone('Asia/Tokyo').toLocaleString(DateTime.DATETIME_FULL),
			});

			const resultDateTime = DateTime.fromJSDate(result).setZone('Asia/Tokyo');
			expect(resultDateTime.hour).toBeGreaterThanOrEqual(9);
			expect(resultDateTime.hour).toBeLessThan(17);
		});

		it('should handle invalid timezone gracefully', () => {
			const invalidTzService = new SchedulingService(mockUserPreferences, [], 'Invalid/Timezone');
			const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			expect(invalidTzService.timeZone).toBe(systemTz);
		});

		it('should handle concurrent scheduling requests', async () => {
			schedulingService.reminders = []; // Clear any existing reminders

			const baseDate = DateTime.now().set({ hour: 9, minute: 0 }).toJSDate();
			const promises = [];

			// Create 10 different time slots spread across the day
			for (let i = 0; i < 10; i++) {
				const requestedTime = DateTime.fromJSDate(baseDate)
					.plus({ hours: Math.floor(i / 2), minutes: (i % 2) * 30 })
					.toJSDate();

				const contact = {
					...mockContact,
					id: `test-id-${i}`,
					scheduling: {
						relationship_type: 'friend',
						priority: 'normal',
						custom_preferences: {
							active_hours: { start: '09:00', end: '17:00' },
						},
					},
				};

				promises.push(schedulingService.scheduleReminder(contact, requestedTime, 'daily'));
			}

			const results = await Promise.all(promises);

			const times = results.map((r) => r.date.toDate().getTime());
			const uniqueTimes = new Set(times);

			expect(uniqueTimes.size).toBe(10);

			// Verify minimum gaps
			for (let i = 0; i < times.length; i++) {
				for (let j = i + 1; j < times.length; j++) {
					const gap = Math.abs(times[i] - times[j]) / (1000 * 60);
					expect(gap).toBeGreaterThanOrEqual(30);
				}
			}
		});

		it('should handle maximum scheduling attempts', async () => {
			const workingHourStart = DateTime.now().set({ hour: 9, minute: 0, second: 0, millisecond: 0 });

			schedulingService.reminders = [];

			// Fill every 15-minute slot from 9 AM to 5 PM
			const slotsPerHour = 4; // 15-minute intervals
			const workingHours = 8; // 9 AM to 5 PM
			const totalSlots = slotsPerHour * workingHours;

			for (let i = 0; i < totalSlots; i++) {
				const reminderTime = workingHourStart.plus({ minutes: i * 15 });
				schedulingService.reminders.push({
					date: {
						toDate: () => reminderTime.toJSDate(),
						_seconds: Math.floor(reminderTime.toSeconds()),
						_nanoseconds: 0,
					},
				});
			}

			console.log('Maximum scheduling test:', {
				totalReminders: schedulingService.reminders.length,
				timeRange: `${workingHourStart.toFormat('HH:mm')} - ${workingHourStart
					.plus({ hours: 8 })
					.toFormat('HH:mm')}`,
				slots: schedulingService.reminders.map((r) => DateTime.fromJSDate(r.date.toDate()).toFormat('HH:mm')),
			});

			await expect(
				schedulingService.scheduleReminder(mockContact, workingHourStart.toJSDate(), 'daily')
			).rejects.toThrow('No available time slots found within working hours');
		});

		it('should handle minimum gap requirements strictly', () => {
			const baseTime = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			schedulingService.reminders = [
				{
					date: { toDate: () => baseTime },
				},
			];

			const tooClose = new Date(baseTime.getTime() + 29 * 60 * 1000);
			const justRight = new Date(baseTime.getTime() + 30 * 60 * 1000);

			expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
			expect(schedulingService.hasTimeConflict(justRight)).toBeFalsy();
		});
	});
});
