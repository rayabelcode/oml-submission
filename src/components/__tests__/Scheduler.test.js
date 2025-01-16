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

const mockUserPreferences = {
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
};

describe('Contact Spreading', () => {
	let schedulingService;

	beforeEach(() => {
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});
	it('should spread contacts across preferred days', async () => {
		const baseContact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['tuesday', 'wednesday', 'thursday'],
				},
				priority: 'normal',
				minimum_gap: 30,
			},
		};

		// Create three contacts with same preferences
		const contacts = Array.from({ length: 3 }, (_, i) => ({
			...baseContact,
			id: `test-id-${i}`,
		}));

		const lastContactDate = DateTime.now().toJSDate();
		const results = [];

		// Schedule all contacts
		for (const contact of contacts) {
			const result = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');
			results.push(result);
		}

		// Check that they're on different days
		const scheduledDays = new Set(results.map((r) => DateTime.fromJSDate(r.date.toDate()).weekday));
		expect(scheduledDays.size).toBe(3);
	});

	it('should respect user gap preferences over contact gaps', () => {
		const userPrefsWithGaps = {
			...mockUserPreferences,
			scheduling_preferences: {
				minimumGapMinutes: 20,
				optimalGapMinutes: 1440,
			},
		};

		const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

		// Create a reminder at 10:00
		schedulingService.reminders = [
			{
				date: {
					toDate: () =>
						DateTime.fromObject(
							{ year: 2024, month: 1, day: 1, hour: 10, minute: 0 },
							{ zone: 'America/New_York' }
						).toJSDate(),
				},
			},
		];

		// Try scheduling something 15 minutes later (should fail)
		const tooClose = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 15 },
			{ zone: 'America/New_York' }
		).toJSDate();

		// Try scheduling something 25 minutes later (should succeed)
		const farEnough = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 25 },
			{ zone: 'America/New_York' }
		).toJSDate();

		expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
		expect(schedulingService.hasTimeConflict(farEnough)).toBeFalsy();
	});

	it('should use default gap when user preferences are missing', () => {
		const schedulingService = new SchedulingService({}, [], 'America/New_York');

		// Create a reminder at 10:00
		schedulingService.reminders = [
			{
				date: {
					toDate: () =>
						DateTime.fromObject(
							{ year: 2024, month: 1, day: 1, hour: 10, minute: 0 },
							{ zone: 'America/New_York' }
						).toJSDate(),
				},
			},
		];

		// Try scheduling something 15 minutes later (should fail as default is 20)
		const tooClose = DateTime.fromObject(
			{ year: 2024, month: 1, day: 1, hour: 10, minute: 15 },
			{ zone: 'America/New_York' }
		).toJSDate();

		expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
	});

	it('should respect minimum gaps between contacts', async () => {
		const userPrefsWithGaps = {
			...mockUserPreferences,
			scheduling_preferences: {
				minimumGapMinutes: 120,
				optimalGapMinutes: 1440,
			},
		};

		const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '09:00', end: '17:00' },
					preferred_days: ['monday'],
				},
				priority: 'normal',
			},
		};

		const lastContactDate = DateTime.now().toJSDate();
		const result1 = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');
		const result2 = await schedulingService.scheduleReminder(contact, lastContactDate, 'weekly');

		const time1 = result1.date.toDate().getTime();
		const time2 = result2.date.toDate().getTime();
		const gap = Math.abs(time2 - time1) / (1000 * 60); // gap in minutes

		expect(gap).toBeGreaterThanOrEqual(120);
	});
});

describe('Custom Preferences', () => {
	let schedulingService;

	beforeEach(() => {
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});
	it('should use custom schedule when available', async () => {
		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: true,
				custom_preferences: {
					active_hours: { start: '12:00', end: '20:00' },
					preferred_days: ['saturday', 'sunday'],
				},
				relationship_type: 'friend',
			},
		};

		const result = await schedulingService.scheduleReminder(contact, DateTime.now().toJSDate(), 'weekly');

		const scheduledDateTime = DateTime.fromJSDate(result.date.toDate());
		expect(['6', '7']).toContain(scheduledDateTime.weekday.toString());
		expect(scheduledDateTime.hour).toBeGreaterThanOrEqual(12);
		expect(scheduledDateTime.hour).toBeLessThan(20);
	});

	it('should fall back to relationship type preferences when no custom schedule', async () => {
		const contact = {
			id: 'test-id',
			scheduling: {
				custom_schedule: false,
				relationship_type: 'work',
			},
		};

		const result = await schedulingService.scheduleReminder(contact, DateTime.now().toJSDate(), 'weekly');

		const scheduledDateTime = DateTime.fromJSDate(result.date.toDate());
		expect(scheduledDateTime.weekday).toBeLessThanOrEqual(5); // Monday-Friday
		expect(scheduledDateTime.hour).toBeGreaterThanOrEqual(9);
		expect(scheduledDateTime.hour).toBeLessThan(17);
	});
});

describe('SchedulingService', () => {
	let schedulingService;

	beforeEach(() => {
		jest.clearAllMocks();
		schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
	});

	describe('Basic Functionality', () => {
		it('should initialize with correct preferences', () => {
			expect(schedulingService.userPreferences).toBeDefined();
			expect(schedulingService.globalExcludedTimes).toBeDefined();
		});

		it('should handle missing preferences gracefully', () => {
			const serviceWithNoPrefs = new SchedulingService(null, [], 'America/New_York');
			expect(serviceWithNoPrefs.userPreferences).toBeNull();
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
			const mockContact = {
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
				},
			};

			// Use a specific Monday for consistent testing
			const monday = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1 }, // This is a Monday
				{ zone: 'America/New_York' }
			);

			// Test during excluded period (23:00-07:00)
			const nightTime = monday.set({ hour: 23, minute: 30 }).toJSDate();
			const earlyMorning = monday.set({ hour: 6, minute: 30 }).toJSDate();
			const dayTime = monday.set({ hour: 10, minute: 0 }).toJSDate();

			// Debug info
			console.log('Testing excluded times:', {
				contact: mockContact,
				preferences: schedulingService.getPreferencesForContact(mockContact),
				globalExcludedTimes: schedulingService.globalExcludedTimes,
				testTime: DateTime.fromJSDate(nightTime).toFormat('cccc HH:mm'),
				weekday: DateTime.fromJSDate(nightTime).weekdayLong.toLowerCase(),
			});

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
			schedulingService.reminders = [];

			const baseDate = DateTime.now().set({ hour: 9, minute: 0 }).toJSDate();
			const promises = [];

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

			for (let i = 0; i < times.length; i++) {
				for (let j = i + 1; j < times.length; j++) {
					const gap = Math.abs(times[i] - times[j]) / (1000 * 60);
					expect(gap).toBeGreaterThanOrEqual(30);
				}
			}
		});

		it('should handle maximum scheduling attempts', async () => {
			const mockContact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
					minimum_gap: 15,
				},
			};

			// Fill ALL possible slots for a single day
			const targetDate = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1, hour: 9 }, // Start at 9 AM
				{ zone: 'America/New_York' }
			);

			schedulingService.reminders = [];

			// Fill every 15-minute slot from 9 AM to 5 PM
			for (let minutes = 0; minutes < (17 - 9) * 60; minutes += 15) {
				const slotTime = targetDate.plus({ minutes });
				schedulingService.reminders.push({
					date: {
						toDate: () => slotTime.toJSDate(),
						_seconds: Math.floor(slotTime.toSeconds()),
						_nanoseconds: 0,
					},
				});
			}

			console.log('Maximum scheduling test:', {
				totalSlots: schedulingService.reminders.length,
				firstSlot: DateTime.fromJSDate(schedulingService.reminders[0].date.toDate()).toFormat('HH:mm'),
				lastSlot: DateTime.fromJSDate(
					schedulingService.reminders[schedulingService.reminders.length - 1].date.toDate()
				).toFormat('HH:mm'),
				sampleSlots: schedulingService.reminders
					.slice(0, 4)
					.map((r) => DateTime.fromJSDate(r.date.toDate()).toFormat('HH:mm')),
			});

			// Try to find a slot - should fail as all slots are filled
			await expect(async () => {
				await schedulingService.findAvailableTimeSlot(targetDate.toJSDate(), mockContact);
			}).rejects.toThrow('No available time slots found within working hours');
		});
		it('should handle minimum gap requirements strictly', () => {
			const userPrefsWithGaps = {
				...mockUserPreferences,
				scheduling_preferences: {
					minimumGapMinutes: 30,
					optimalGapMinutes: 1440,
				},
			};

			const schedulingService = new SchedulingService(userPrefsWithGaps, [], 'America/New_York');

			const baseTime = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			schedulingService.reminders = [
				{
					date: {
						toDate: () => baseTime,
					},
				},
			];

			const tooClose = new Date(baseTime.getTime() + 29 * 60 * 1000); // 29 minutes
			const justRight = new Date(baseTime.getTime() + 30 * 60 * 1000); // 30 minutes

			expect(schedulingService.hasTimeConflict(tooClose)).toBeTruthy();
			expect(schedulingService.hasTimeConflict(justRight)).toBeFalsy();
		});
	});

	describe('Performance', () => {
		const createMockContact = (id) => ({
			id: `test-id-${id}`,
			scheduling: {
				relationship_type: 'friend',
				priority: 'normal',
				custom_preferences: {
					active_hours: { start: '09:00', end: '23:00' },
				},
			},
		});

		beforeEach(() => {
			schedulingService.reminders = [];
		});

		it('should handle batch scheduling efficiently', async () => {
			const startTime = performance.now();
			const batchSize = 10;
			const promises = [];

			for (let i = 0; i < batchSize; i++) {
				const contact = createMockContact(i);
				const requestedTime = DateTime.now()
					.plus({ days: i })
					.set({ hour: 9 + (i % 4), minute: 0 })
					.toJSDate();

				promises.push(schedulingService.scheduleReminder(contact, requestedTime, 'daily'));
			}

			const results = await Promise.all(promises);
			const endTime = performance.now();
			const timePerOperation = (endTime - startTime) / batchSize;

			console.log('Batch processing performance:', {
				totalTime: `${(endTime - startTime).toFixed(2)}ms`,
				operationsPerSecond: `${(1000 / timePerOperation).toFixed(2)}`,
				timePerOperation: `${timePerOperation.toFixed(2)}ms`,
				batchSize,
			});

			expect(timePerOperation).toBeLessThan(50);
			expect(results.length).toBe(batchSize);
		});

		it('should maintain performance with increasing workload', async () => {
			const workloads = [5, 10, 15];
			const timings = [];

			for (let size of workloads) {
				schedulingService.reminders = [];
				await new Promise((resolve) => setTimeout(resolve, 1));

				const startTime = performance.now();
				const promises = [];

				for (let i = 0; i < size; i++) {
					const contact = createMockContact(i);
					const requestedTime = DateTime.now()
						.plus({ days: Math.floor(i / 4) })
						.set({ hour: 9 + (i % 4) * 2, minute: 0 })
						.toJSDate();

					promises.push(schedulingService.scheduleReminder(contact, requestedTime, 'daily'));
				}

				await Promise.all(promises);
				const endTime = performance.now();
				timings.push({ size, time: Math.max(endTime - startTime, 0.1) });
			}

			console.log(
				'Scaling performance:',
				timings.map(({ size, time }) => ({
					workloadSize: size,
					totalTime: `${time.toFixed(2)}ms`,
					timePerOperation: `${(time / size).toFixed(2)}ms`,
				}))
			);

			const baselineTimePerOp = Math.max(timings[0].time / timings[0].size, 0.1);
			const maxAllowedDeviation = 2.0;

			for (let i = 1; i < timings.length; i++) {
				const timePerOp = timings[i].time / timings[i].size;
				expect(timePerOp).toBeLessThan(baselineTimePerOp * maxAllowedDeviation);
			}
		});

		it('should handle concurrent modifications efficiently', async () => {
			const iterations = 10;
			const concurrentOps = 2;
			const startTime = performance.now();

			for (let i = 0; i < iterations; i++) {
				schedulingService.reminders = [];
				const operations = [];

				operations.push(
					schedulingService.scheduleReminder(
						createMockContact(`new-${i}`),
						DateTime.now()
							.plus({ days: i, hours: i * 2 })
							.toJSDate(),
						'daily'
					)
				);

				await Promise.all(operations);
			}

			const endTime = performance.now();
			const totalTime = endTime - startTime;

			console.log('Concurrent operations performance:', {
				totalTime: `${totalTime.toFixed(2)}ms`,
				operationsPerSecond: `${((iterations * concurrentOps) / (totalTime / 1000)).toFixed(2)}`,
				averageTime: `${(totalTime / (iterations * concurrentOps)).toFixed(2)}ms`,
			});

			expect(totalTime / iterations).toBeLessThan(100);
		});
	});

	describe('Conflict Resolution', () => {
		it('should resolve conflicts using preferred day strategy', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'high',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			schedulingService.reminders = [
				{
					date: {
						toDate: () => DateTime.now().set({ hour: 10, minute: 0 }).toJSDate(),
					},
				},
			];

			const conflictDate = DateTime.now().set({ hour: 10, minute: 15 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			expect(schedulingService.hasTimeConflict(resolvedDate)).toBeFalsy();
			expect(schedulingService.isTimeBlocked(resolvedDate, contact)).toBeFalsy();
		});

		it('should resolve conflicts by shifting within day', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'normal',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Block morning hours
			schedulingService.reminders = Array.from({ length: 8 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + Math.floor(i / 2), minute: (i % 2) * 30 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 9, minute: 30 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			const resolvedTime = DateTime.fromJSDate(resolvedDate);
			expect(resolvedTime.hour).toBeGreaterThan(13);
		});

		it('should resolve conflicts by expanding time range', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'low',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Fill normal hours
			schedulingService.reminders = Array.from({ length: 16 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + i, minute: 0 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			const resolvedDate = await schedulingService.resolveConflict(conflictDate, contact);

			expect(resolvedDate).toBeDefined();
			const resolvedTime = DateTime.fromJSDate(resolvedDate);
			expect(resolvedTime.hour).toBeGreaterThanOrEqual(8);
			expect(resolvedTime.hour).toBeLessThanOrEqual(18);
		});

		it('should throw error when no resolution is possible', async () => {
			const contact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'friend',
					priority: 'normal',
					custom_preferences: {
						active_hours: { start: '09:00', end: '17:00' },
					},
				},
			};

			// Fill all possible slots
			schedulingService.reminders = Array.from({ length: 32 }, (_, i) => ({
				date: {
					toDate: () =>
						DateTime.now()
							.set({ hour: 9 + Math.floor(i / 4), minute: (i % 4) * 15 })
							.toJSDate(),
				},
			}));

			const conflictDate = DateTime.now().set({ hour: 12, minute: 0 }).toJSDate();
			await expect(schedulingService.resolveConflict(conflictDate, contact)).rejects.toThrow(
				'Maximum scheduling attempts exceeded'
			);
		});
	});

	describe('User Experience', () => {
		let schedulingService;

		beforeEach(() => {
			schedulingService = new SchedulingService(mockUserPreferences, [], 'America/New_York');
		});

		it('should provide user-friendly options when all slots are filled', async () => {
			const mockContact = {
				id: 'test-id',
				scheduling: {
					relationship_type: 'work',
					custom_schedule: false,
					minimum_gap: 15,
				},
			};

			// Start on a Monday
			const monday = DateTime.fromObject(
				{ year: 2024, month: 1, day: 1 }, // Monday
				{ zone: 'America/New_York' }
			);

			schedulingService.reminders = [];

			// Fill EVERY slot for the entire week
			for (let day = 0; day < 5; day++) {
				// Monday through Friday
				const currentDay = monday.plus({ days: day });

				// Fill every slot from 9 AM to 5 PM
				for (let hour = 9; hour < 17; hour++) {
					for (let minute = 0; minute < 60; minute += 15) {
						const slotTime = currentDay.set({ hour, minute });
						schedulingService.reminders.push({
							date: {
								toDate: () => slotTime.toJSDate(),
								_seconds: Math.floor(slotTime.toSeconds()),
								_nanoseconds: 0,
							},
						});
					}
				}
			}

			// Fill the next week too to prevent finding slots there
			const nextMonday = monday.plus({ days: 7 });
			for (let day = 0; day < 5; day++) {
				const currentDay = nextMonday.plus({ days: day });
				for (let hour = 9; hour < 17; hour++) {
					for (let minute = 0; minute < 60; minute += 15) {
						const slotTime = currentDay.set({ hour, minute });
						schedulingService.reminders.push({
							date: {
								toDate: () => slotTime.toJSDate(),
								_seconds: Math.floor(slotTime.toSeconds()),
								_nanoseconds: 0,
							},
						});
					}
				}
			}

			console.log('User Experience Test:', {
				totalSlots: schedulingService.reminders.length,
				firstDaySlots: schedulingService.reminders
					.filter((r) => {
						const d = DateTime.fromJSDate(r.date.toDate());
						return d.toFormat('yyyy-MM-dd') === monday.toFormat('yyyy-MM-dd');
					})
					.map((r) => DateTime.fromJSDate(r.date.toDate()).toFormat('HH:mm')),
				firstDay: monday.toFormat('cccc, LLLL d'),
				nextWeekSlots: schedulingService.reminders.filter((r) => {
					const d = DateTime.fromJSDate(r.date.toDate());
					return d.toFormat('yyyy-MM-dd') === nextMonday.toFormat('yyyy-MM-dd');
				}).length,
			});

			const result = await schedulingService.scheduleReminder(
				mockContact,
				monday.set({ hour: 10, minute: 0 }).toJSDate(),
				'daily'
			);

			// Verify the user-friendly response
			expect(result.status).toBe('SLOTS_FILLED');
			expect(result.message).toBe('This day is fully booked. Would you like to:');
			expect(result.options).toEqual(['Try the next available day', 'Schedule for next week']);
		});
	});
});
